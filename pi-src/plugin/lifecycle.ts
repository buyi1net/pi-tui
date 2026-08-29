import {
	SettingsManager,
	VERSION,
	getAgentDir,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	Text,
	type EditorTheme,
	type TUI,
	type TuiMainScreenRenderState,
} from "@earendil-works/pi-tui";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { PiProviderUsageController } from "../adapter/provider-usage.ts";
import { PiTuiHeader } from "../renderer/header.ts";
import { resolveGlyphs } from "../renderer/icons.ts";
import {
	ProjectStatusController,
	parseGitStatusV2,
} from "../status/project-status.ts";
import {
	RuntimeStatusController,
	detectRuntimeStatus,
} from "../status/runtime-status.ts";
import { TurnTimerController } from "../status/status-segments.ts";
import { resolveStatusSettings } from "../status/status-config.ts";
import { collectSessionStatus } from "../status/session-status.ts";
import {
	TurnTelemetryTracker,
	createTurnDurationEntryData,
	createTurnTelemetryEntryData,
	formatTurnTelemetry,
	readLatestTurnDuration,
	readTurnTelemetryEntryData,
	TURN_DURATION_ENTRY_TYPE,
	TURN_TELEMETRY_ENTRY_TYPE,
	type PersistedTurnDuration,
	type PersistedTurnTelemetry,
} from "../status/turn-telemetry.ts";
import {
	AutoCompactionStatusController,
	watchAgentSettings,
} from "../status/auto-compaction.ts";
import {
	loadPiTuiConfig,
	piTuiConfigPath,
	type LoadedPiTuiConfig,
} from "./settings-config.ts";
import { getTerminalTransitionGate, type TerminalTransitionGate } from "./transition-gate.ts";
import { ensureFirstPackage } from "./package-order.ts";
import {
	flashVisibleScreen,
	isInteractiveLaunch,
	restoreVisibleMainScreen,
	TRANSITION_SETTLE_MS,
	type VisibleScreenOutput,
} from "./screen-transition.ts";
import { PiUiEditor, formatModel } from "./editor.ts";
import { ProjectStatusFooter } from "./footer.ts";

export interface PiTuiPluginDependencies {
	agentDir?: string;
	env?: Readonly<Record<string, string | undefined>>;
	loadConfig?: (path: string) => LoadedPiTuiConfig;
	readAutoCompactionEnabled?: (ctx: ExtensionContext, agentDir: string) => boolean;
	watchAutoCompactionSettings?: (agentDir: string, onChange: () => void) => () => void;
	transitionGate?: TerminalTransitionGate | null;
}

/**
 * 插件装配与生命周期：安装/卸载 UI、创建并接线各状态控制器、订阅会话事件。
 * 视图组件（editor/footer/设置向导）只通过参数接收数据与回调，不反向依赖本文件。
 */
export function registerPiTuiLifecycle(
	pi: ExtensionAPI,
	output: VisibleScreenOutput = process.stdout,
	dependencies: PiTuiPluginDependencies = {},
): void {
	const env = dependencies.env ?? process.env;
	const agentDir = dependencies.agentDir ?? getAgentDir();
	const configPath = piTuiConfigPath(agentDir);
	const readConfig = dependencies.loadConfig ?? loadPiTuiConfig;
	const watchAutoCompactionSettings = dependencies.watchAutoCompactionSettings ?? watchAgentSettings;
	const readAutoCompactionEnabled = dependencies.readAutoCompactionEnabled ?? ((ctx: ExtensionContext) => {
		try {
			return SettingsManager.create(ctx.cwd, agentDir, {
				projectTrusted: ctx.isProjectTrusted?.() ?? false,
			}).getCompactionEnabled();
		} catch {
			return false;
		}
	});

	let loadedConfig = readConfig(configPath);
	let currentConfig = loadedConfig.config;
	let configWarningsShown = false;
	let active = false;
	let cleanupEditor: (() => void) | undefined;
	let cleanupFooter: (() => void) | undefined;
	let cleanupHeader: (() => void) | undefined;
	let projectStatus: ProjectStatusController | undefined;
	let runtimeStatus: RuntimeStatusController | undefined;
	let providerUsage: PiProviderUsageController | undefined;
	let turnTimer: TurnTimerController | undefined;
	let autoCompactionStatus: AutoCompactionStatusController | undefined;
	let cleanupSpinner: (() => void) | undefined;
	const turnTelemetry = new TurnTelemetryTracker();
	const getTurnTelemetryGlyphs = () => resolveGlyphs("auto", env);
	let installedTui: TUI | undefined;
	// 状态查询启动状态提升到模块级：installUi 的闭包在多次安装/卸载与 /reload
	// （jiti 缓存使新旧闭包共存）后可能失步，闭包局部守卫会导致查询永不启动。
	let activeFooter: ProjectStatusFooter | undefined;
	let statusQueriesStarted = false;
	let deferredStatusImmediate: ReturnType<typeof setImmediate> | undefined;
	let modelSwitchRepaintImmediate: ReturnType<typeof setImmediate> | undefined;
	const cancelModelSwitchRepaint = (): void => {
		if (!modelSwitchRepaintImmediate) return;
		clearImmediate(modelSwitchRepaintImmediate);
		modelSwitchRepaintImmediate = undefined;
	};
	const scheduleModelSwitchRepaint = (): void => {
		if (modelSwitchRepaintImmediate) return;
		modelSwitchRepaintImmediate = setImmediate(() => {
			modelSwitchRepaintImmediate = undefined;
			const tui = installedTui;
			// 模型事件可能早于宿主关闭选择器；等当前宿主调用栈结束后，
			// 只对仍然活跃且未处于 reload 过渡的主屏做可见区安全重绘。
			if (!active || !tui || transitionGate?.isHolding()) return;
			restoreVisibleMainScreen(tui);
		});
		modelSwitchRepaintImmediate.unref?.();
	};
	// 编辑框 factory 链：原子重装时“恢复目标”必须仍是本插件首次安装前的 factory，
	// 不能错记成自己上一次的 ownFactory（否则真卸载时会重建已废弃的旧编辑框）。
	type EditorFactory = NonNullable<ReturnType<ExtensionContext["ui"]["getEditorComponent"]>>;
	let originalEditorFactory: EditorFactory | undefined;
	let lastOwnEditorFactory: EditorFactory | undefined;
	// 当前已安装的编辑框实例：闭包外持有，原子重装时 dispose 旧实例（自动补全
	// Overlay 挂在 TUI 上，不 dispose 会残留）。
	let installedEditorRef: PiUiEditor | undefined;
	const transitionGate: TerminalTransitionGate | undefined = dependencies.transitionGate === null
		? undefined
		: dependencies.transitionGate ?? (
			output === process.stdout && isInteractiveLaunch() ? getTerminalTransitionGate() : undefined
		);
	const requestStatusRender = () => {
		if (transitionGate?.isHolding()) return;
		installedTui?.requestRender();
	};
	let transitionRevealEnabled = true;
	let transitionRevealTimer: ReturnType<typeof setTimeout> | undefined;
	// Footer 首帧回报：模块级，供揭示门槛读取（installUi 闭包外）。
	const layoutState = { footerHeight: 0 };
	// 模块级状态在同进程内跨安装共享（jiti 单次加载）；每次注册新插件实例时
	// 复位，避免上一个实例的启动状态卡住下一个。
	statusQueriesStarted = false;
	if (deferredStatusImmediate) {
		clearImmediate(deferredStatusImmediate);
		deferredStatusImmediate = undefined;
	}
	const startStatusQueries = (): void => {
		if (statusQueriesStarted || !active) return;
		statusQueriesStarted = true;
		activeFooter?.startStatusQueries();
		void providerUsage?.start();
	};
	const scheduleStatusQueries = (): void => {
		if (statusQueriesStarted || deferredStatusImmediate) return;
		deferredStatusImmediate = setImmediate(() => {
			deferredStatusImmediate = undefined;
			startStatusQueries();
		});
		deferredStatusImmediate.unref?.();
	};
	// installUi 完成后若已有待启动查询（帧回调先于安装尾执行），立即补排一次。
	const ensureStatusQueriesScheduled = (): void => {
		if (!statusQueriesStarted) scheduleStatusQueries();
	};
	const scheduleTransitionReveal = (tui: TUI): void => {
		if (!transitionRevealEnabled || !transitionGate?.isHolding()) return;
		// 揭示门槛：Editor 稳定帧 + Footer 已出过首帧。只等 Editor 会让揭示帧
		// 缺 Footer（dock 尚未调用 Footer 渲染），揭示后 Footer 补帧造成二次跳变。
		if (layoutState.footerHeight < 1) return;
		if (transitionRevealTimer) clearTimeout(transitionRevealTimer);
		transitionRevealTimer = setTimeout(() => {
			transitionRevealTimer = undefined;
			if (!transitionRevealEnabled || !transitionGate.isHolding()) return;
			if (layoutState.footerHeight < 1) return;
			transitionGate.reveal(tui);
			startStatusQueries();
		}, TRANSITION_SETTLE_MS);
		transitionRevealTimer.unref?.();
	};
	transitionGate?.hold();

	pi.registerEntryRenderer?.<PersistedTurnTelemetry>(
		TURN_TELEMETRY_ENTRY_TYPE,
		(entry, _options, theme) => {
			const telemetry = readTurnTelemetryEntryData(entry.data);
			if (!telemetry) return undefined;
			return new Text(formatTurnTelemetry(telemetry, theme, getTurnTelemetryGlyphs()), 1, 0);
		},
	);
	pi.registerEntryRenderer?.<PersistedTurnDuration>(TURN_DURATION_ENTRY_TYPE, () => undefined);

	const disposeInstalledControllers = (): void => {
		cancelModelSwitchRepaint();
		installedEditorRef?.dispose();
		installedEditorRef = undefined;
		activeFooter = undefined;
		turnTimer?.dispose();
		autoCompactionStatus?.dispose();
		providerUsage?.dispose();
		projectStatus?.dispose();
		runtimeStatus?.dispose();
		turnTimer = undefined;
		autoCompactionStatus = undefined;
		providerUsage = undefined;
		projectStatus = undefined;
		runtimeStatus = undefined;
		cleanupFooter = undefined;
		cleanupHeader = undefined;
		cleanupEditor = undefined;
		cleanupSpinner = undefined;
		installedTui = undefined;
	};

	const installUi = (ctx: ExtensionContext): void => {
		if (active) {
			// 原子重装：查询标志重置，由本次安装的新控制器重新启动。
			statusQueriesStarted = false;
			// 原子重装（设置保存后）：只 dispose 控制器，不把组件恢复成 Pi 默认——
			// “恢复默认→再装自定义”的往返会让 dock 高度抖动，把 transcript 行推进
			// 滚动缓冲形成残影；组件由本次安装直接覆盖，高度最多变化一次。
			active = false;
			disposeInstalledControllers();
		}
		transitionRevealEnabled = true;
		if (transitionRevealTimer) clearTimeout(transitionRevealTimer);
		transitionRevealTimer = undefined;
		const currentFactory = ctx.ui.getEditorComponent();
		// 恢复目标：当前生效的是自己上次的 factory 时沿用最初的 factory。
		const previousFactory = currentFactory !== undefined && currentFactory === lastOwnEditorFactory
			? originalEditorFactory
			: currentFactory;
		originalEditorFactory = previousFactory;
		const statusSettings = resolveStatusSettings(env, {
			preset: currentConfig.status.preset,
			segments: currentConfig.status.segments,
		});
		const autoCompaction = currentConfig.appearance.editor && statusSettings.footerUsage.includes("context")
			? new AutoCompactionStatusController(
				() => readAutoCompactionEnabled(ctx, agentDir),
				(onChange) => watchAutoCompactionSettings(agentDir, onChange),
				requestStatusRender,
			)
			: undefined;
		autoCompactionStatus = autoCompaction;
		const getGlyphs = () => resolveGlyphs("auto", env);
		const timer = statusSettings.editorLeft.includes("duration")
			? new TurnTimerController(
				requestStatusRender,
				1_000,
				Date.now,
				readLatestTurnDuration(ctx.sessionManager?.getEntries?.() ?? []),
			)
			: undefined;
		const usage = statusSettings.editorLeft.some((segment) =>
			segment === "provider" || segment === "balance" || segment === "subscription"
		)
			? new PiProviderUsageController(ctx, requestStatusRender, {
				refreshMs: currentConfig.data.providerRefreshMs,
				accessConfig: currentConfig.data.providerAccess,
			})
			: undefined;
		const runtime = statusSettings.footerPrimary.includes("runtime")
			? new RuntimeStatusController(ctx.cwd, async (cwd, signal) =>
				detectRuntimeStatus(
					cwd,
					async (command, args, commandCwd, commandSignal) => {
						const result = await pi.exec(command, [...args], {
							cwd: commandCwd,
							signal: commandSignal,
							timeout: 2500,
						});
						return {
							stdout: result.stdout,
							stderr: result.stderr,
							code: result.code,
							killed: result.killed,
						};
					},
					signal,
					env,
				),
			)
			: undefined;
		let activeTui: TUI | undefined;
		let preClearState: TuiMainScreenRenderState | undefined;
		let headerInstalled = false;
		let installedEditor: PiUiEditor | undefined;
		let installedFooter: ProjectStatusFooter | undefined;
		const controller = statusSettings.footerPrimary.includes("git")
			? new ProjectStatusController(ctx.cwd, async (cwd, signal) => {
			try {
				const result = await pi.exec(
					"git",
					[
						"--no-optional-locks",
						"status",
						"--porcelain=v2",
						"--branch",
						"--show-stash",
						"--untracked-files=normal",
						"--ignore-submodules=dirty",
					],
					{ cwd, signal, timeout: 2000 },
				);
				if (result.killed || result.code !== 0) return undefined;
				const status = parseGitStatusV2(result.stdout);
				if (!status.detached || !status.oid) return status;

				const tags = await pi.exec(
					"git",
					[
						"--no-optional-locks",
						"tag",
						"--points-at",
						status.oid,
						"--sort=refname",
					],
					{ cwd, signal, timeout: 2000 },
				);
				if (tags.killed || tags.code !== 0) return status;
				const exactTag = tags.stdout
					.split("\n")
					.map((tag) => tag.trim())
					.filter(Boolean)[0];
				return exactTag ? { ...status, exactTag } : status;
			} catch {
				return undefined;
			}
			})
			: undefined;
		const ownFactory = (tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
			activeTui = tui;
			installedTui = tui;
			// 实例级拦截：挂到宿主真实 terminal（prototype patch 因 jiti 双副本无效）。
			transitionGate?.hookTerminal(tui.terminal);
			const editor = new PiUiEditor(
				tui,
				theme,
				keybindings,
				ctx,
				getGlyphs,
				statusSettings,
				() => layoutState.footerHeight,
				usage ? () => usage.getState() : undefined,
				{
					onReloadSubmit: () => {
						transitionRevealEnabled = false;
						transitionGate?.hold(tui, { clearVisibleScreen: true });
					},
					onFrameRendered: () => {
						// 闸门存在但已不在 holding（曾被提前释放或已揭示）时，
						// 旧逻辑两个分支都不执行，状态查询永不启动；这里兜底直启。
						if (transitionGate?.isHolding() && transitionRevealEnabled) scheduleTransitionReveal(tui);
						else scheduleStatusQueries();
					},
				},
				timer ? () => timer.getSnapshot() : undefined,
			);
			installedEditor?.dispose();
			installedEditor = editor;
			installedEditorRef = editor;
			if (!transitionGate) preClearState = flashVisibleScreen(tui, output);
			return editor;
		};
		lastOwnEditorFactory = ownFactory;

		try {
			if (currentConfig.appearance.editor) ctx.ui.setEditorComponent(ownFactory);
			// Pi 正式 TUI 提供 setHeader；精简宿主桩或旧宿主没有该能力时跳过 Header。
			if (currentConfig.appearance.header && typeof ctx.ui.setHeader === "function") {
				ctx.ui.setHeader((tui) => new PiTuiHeader(
					() => ({
						version: VERSION,
						model: formatModel(ctx),
						thinking: ctx.thinkingLevel ?? "off",
						cwd: ctx.cwd,
					}),
					() => ctx.ui.theme,
					getGlyphs,
					tui.requestRender.bind(tui),
				));
				headerInstalled = true;
			}
			ctx.ui.setFooter((tui, theme, footerData) => {
				activeTui ??= tui;
				installedTui = tui;
				activeFooter = installedFooter = new ProjectStatusFooter(
					tui,
					theme,
					footerData,
					controller,
					() => transitionGate?.hold(tui),
					getGlyphs,
					statusSettings,
					runtime,
					ctx.cwd,
					(height) => { layoutState.footerHeight = height; },
					requestStatusRender,
					() => timer?.getSnapshot() ?? { state: "idle", elapsedMs: 0 },
					() => collectSessionStatus(ctx.sessionManager),
					() => ctx.getContextUsage(),
					() => ctx.model?.contextWindow,
					() => autoCompaction?.getSnapshot() ?? false,
				);
				// 闸门 holding 期间 dock 不跑、Footer 首帧不产生，揭示门槛会永久等待。
				// 工厂内主动渲染一次回报高度，解锁揭示；dock 接管后的渲染不受影响。
				if (transitionGate?.isHolding()) {
					installedFooter.render(Math.max(1, tui.terminal.columns));
				}
				return installedFooter;
			});
			if (currentConfig.advanced.spinner === "hidden") {
				ctx.ui.setWorkingVisible?.(false);
			} else {
				ctx.ui.setWorkingVisible?.(true);
				ctx.ui.setWorkingIndicator?.(
					currentConfig.advanced.spinner === "static" ? { frames: ["●"] } : undefined,
				);
			}
			if (!transitionGate && activeTui && preClearState) {
				restoreVisibleMainScreen(activeTui, preClearState, true);
			}
		} catch (error) {
			if (deferredStatusImmediate) clearImmediate(deferredStatusImmediate);
			deferredStatusImmediate = undefined;
			installedEditor?.dispose();
			autoCompaction?.dispose();
			if (autoCompactionStatus === autoCompaction) autoCompactionStatus = undefined;
			controller?.dispose();
			runtime?.dispose();
			timer?.dispose();
			usage?.dispose();
			ctx.ui.setWorkingIndicator?.();
			ctx.ui.setWorkingVisible?.(true);
			try {
				ctx.ui.setFooter(undefined);
			} finally {
				try {
					if (headerInstalled) ctx.ui.setHeader(undefined);
				} finally {
					if (currentConfig.appearance.editor && ctx.ui.getEditorComponent() === ownFactory) {
						ctx.ui.setEditorComponent(previousFactory);
					}
				}
			}
			if (activeTui && preClearState) {
				restoreVisibleMainScreen(activeTui, preClearState);
			}
			if (transitionGate?.isHolding()) {
				if (activeTui) transitionGate.reveal(activeTui);
				else transitionGate.release(true);
			}
			throw error;
		}

		projectStatus = controller;
		runtimeStatus = runtime;
		providerUsage = usage;
		turnTimer = timer;
		cleanupEditor = currentConfig.appearance.editor ? () => {
			installedEditor?.dispose();
			installedEditor = undefined;
			if (ctx.ui.getEditorComponent() === ownFactory) {
				ctx.ui.setEditorComponent(previousFactory);
			}
		} : undefined;
		cleanupFooter = () => ctx.ui.setFooter(undefined);
		cleanupHeader = headerInstalled ? () => ctx.ui.setHeader(undefined) : undefined;
		cleanupSpinner = () => {
			ctx.ui.setWorkingIndicator?.();
			ctx.ui.setWorkingVisible?.(true);
		};
		active = true;
		ensureStatusQueriesScheduled();
		// 没有自定义 Editor 时没有首帧回调可用：先释放闸门再同步启动状态查询。
		if (!currentConfig.appearance.editor) {
			if (transitionGate?.isHolding()) {
				if (activeTui) transitionGate.reveal(activeTui);
				else transitionGate.release(false);
			}
			startStatusQueries();
		}

		const previousCleanupFooter = cleanupFooter;
		cleanupFooter = () => {
			if (deferredStatusImmediate) clearImmediate(deferredStatusImmediate);
			deferredStatusImmediate = undefined;
			statusQueriesStarted = false;
			previousCleanupFooter?.();
		};
	};

	const uninstallUi = (): void => {
		if (
			!active && !projectStatus && !runtimeStatus && !providerUsage && !turnTimer && !autoCompactionStatus &&
			!cleanupEditor && !cleanupFooter && !cleanupHeader && !cleanupSpinner
		) return;
		active = false;
		cancelModelSwitchRepaint();
		const controller = projectStatus;
		const runtime = runtimeStatus;
		const usage = providerUsage;
		const timer = turnTimer;
		const autoCompaction = autoCompactionStatus;
		const restoreFooter = cleanupFooter;
		const restoreHeader = cleanupHeader;
		const restoreEditor = cleanupEditor;
		const restoreSpinner = cleanupSpinner;
		projectStatus = undefined;
		runtimeStatus = undefined;
		providerUsage = undefined;
		turnTimer = undefined;
		autoCompactionStatus = undefined;
		cleanupFooter = undefined;
		cleanupHeader = undefined;
		cleanupEditor = undefined;
		cleanupSpinner = undefined;
		installedTui = undefined;

		timer?.dispose();
		autoCompaction?.dispose();
		usage?.dispose();
		controller?.dispose();
		runtime?.dispose();
		try {
			restoreFooter?.();
		} finally {
			try {
				restoreHeader?.();
			} finally {
				try {
					restoreEditor?.();
				} finally {
					restoreSpinner?.();
				}
			}
		}
	};

	let pendingOrderNotice: ReturnType<typeof setTimeout> | undefined;
	pi.on("session_start", (event, ctx) => {
		// 包顺序自调：调整只做一次（下次启动已在前），失败静默。notify 延迟
		// 到揭示完成后（约 1s）再发，避免闸门 holding 期间被最终帧覆盖。
		if (event.reason !== "reload") {
			if (ensureFirstPackage(agentDir, env).adjusted && !pendingOrderNotice) {
				pendingOrderNotice = setTimeout(() => {
					pendingOrderNotice = undefined;
					ctx.ui.notify?.("已将 pi-tui 调整到启动首位，重启 Pi 后生效", "info");
				}, 2_500);
				pendingOrderNotice.unref?.();
			}
		}
		if (ctx.mode !== "tui") {
			transitionGate?.release(true);
			return;
		}
		// 冷启动时模块加载阶段的 hold() 清屏与宿主原生首帧存在竞态：扩展初始化
		// 早于原生帧落屏，先清后画等于没清，原生编辑框会一直挂到 reveal。
		// session_start 时宿主 UI 已完全启动，补一次清屏徃定擦掉原生帧，
		// 闸门继续拦帧到插件界面原子揭示（与 OpenTUI 的过渡页策略对齐）。
		if (!active && transitionGate?.isHolding()) {
			transitionGate.hold(installedTui, { clearVisibleScreen: true });
		}
		if (active) {
			transitionRevealEnabled = true;
			installedTui?.requestRender(true);
			return;
		}
		if (!configWarningsShown && loadedConfig.warnings.length > 0) {
			configWarningsShown = true;
			ctx.ui.notify(loadedConfig.warnings.join("\n"), "warning");
		}
		installUi(ctx);
	});

	pi.on("tool_execution_end", () => {
		projectStatus?.requestRefresh();
		runtimeStatus?.requestRefresh();
	});
	pi.on("model_select", (event) => {
		void providerUsage?.refresh(event.model, true);
		requestStatusRender();
		scheduleModelSwitchRepaint();
	});

	pi.on("turn_start", (event) => {
		if (currentConfig.data.telemetry) turnTelemetry.handle(event);
	});
	pi.on("message_start", (event) => {
		if (currentConfig.data.telemetry) turnTelemetry.handle(event);
	});
	pi.on("message_update", (event) => {
		if (currentConfig.data.telemetry) turnTelemetry.handle(event);
	});
	pi.on("message_end", (event) => {
		if (currentConfig.data.telemetry) turnTelemetry.handle(event);
		requestStatusRender();
	});
	pi.on("turn_end", (event) => {
		if (currentConfig.data.telemetry) turnTelemetry.handle(event);
	});
	pi.on("session_info_changed", requestStatusRender);
	pi.on("session_compact", requestStatusRender);
	pi.on("session_tree", requestStatusRender);

	pi.on("agent_start", (event) => {
		if (currentConfig.data.telemetry) turnTelemetry.handle(event);
		turnTimer?.start();
	});

	pi.on("agent_end", () => {
		const elapsedMs = turnTimer?.end();
		if (elapsedMs !== undefined) {
			pi.appendEntry(TURN_DURATION_ENTRY_TYPE, createTurnDurationEntryData(elapsedMs));
		}
	});

	pi.on("agent_settled", (event, ctx) => {
		void providerUsage?.refresh(ctx.model);
		if (!currentConfig.data.telemetry) return;
		const telemetry = turnTelemetry.handle(event);
		if (!telemetry || ctx.mode !== "tui") return;
		turnTimer?.restore(telemetry.totalMs);
		pi.appendEntry(TURN_TELEMETRY_ENTRY_TYPE, createTurnTelemetryEntryData(telemetry));
	});

	pi.on("session_shutdown", (event) => {
		turnTelemetry.reset();
		uninstallUi();
		if (event.reason === "quit") transitionGate?.release(false);
	});
}
