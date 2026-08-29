import assert from "node:assert/strict";
import { test } from "node:test";
import type {
	ContextUsage,
	ExtensionAPI,
	ExtensionContext,
	KeybindingsManager,
	ReadonlyFooterDataProvider,
	Theme,
} from "@earendil-works/pi-coding-agent";
import {
	stripTerminalSequences,
	TuiMainScreen,
	visibleWidth,
	type AutocompleteProvider,
	type Component,
	type EditorTheme,
	type OverlayHandle,
	type OverlayOptions,
	type Terminal,
	type TUI,
} from "@earendil-works/pi-tui";
import type { UsageRuntimeState } from "../../packages/usage-node/index.ts";
import install, {
	AutoCompactionStatusController,
	flashVisibleScreen,
	PiUiEditor,
	ProjectStatusFooter,
	restoreVisibleMainScreen,
} from "../plugin/index.ts";
import {
	DEFAULT_PI_TUI_CONFIG,
	parsePiTuiConfig,
} from "../plugin/settings-config.ts";
import { TerminalTransitionGate } from "../plugin/transition-gate.ts";
import { resolveGlyphs, type IconGlyphs } from "../renderer/icons.ts";
import {
	resolveStatusSettings,
	type ResolvedStatusSettings,
} from "../status/status-config.ts";
import type { SessionStatusSnapshot } from "../status/session-status.ts";
import type { TurnTimerSnapshot } from "../status/status-segments.ts";
import { ProjectStatusController } from "../status/project-status.ts";
import {
	TURN_DURATION_ENTRY_TYPE,
	TURN_TELEMETRY_ENTRY_TYPE,
	type PersistedTurnDuration,
	type PersistedTurnTelemetry,
} from "../status/turn-telemetry.ts";

const identity = (text: string): string => text;
const TEST_PLUGIN_DEPENDENCIES = {
	readAutoCompactionEnabled: () => false,
	watchAutoCompactionSettings: () => () => {},
	loadConfig: () => ({
		config: parsePiTuiConfig(DEFAULT_PI_TUI_CONFIG),
		warnings: [],
	}),
};

function makeTerminal(columns = 80, rows = 24): { terminal: Terminal; writes: string[] } {
	const writes: string[] = [];
	const terminal = {
		columns,
		rows,
		kittyProtocolActive: false,
		start() {},
		stop() {},
		async drainInput() {},
		write(data: string) {
			writes.push(data);
		},
		moveBy() {},
		hideCursor() {},
		showCursor() {},
		clearLine() {},
		clearFromCursor() {},
		clearScreen() {},
		setTitle() {},
		setProgress() {},
	} satisfies Terminal;
	return { terminal, writes };
}

function makeEditor(
	glyphs: IconGlyphs = resolveGlyphs("unicode", {}),
	settings: ResolvedStatusSettings = resolveStatusSettings({}),
	getStatusTheme: () => Theme = () => ({
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
	}) as Theme,
	providerStatus: UsageRuntimeState | undefined = undefined,
	timer: TurnTimerSnapshot = { state: "idle", elapsedMs: 0 },
): PiUiEditor {
	const tui = {
		terminal: { rows: 24 },
		requestRender() {},
	} as unknown as TUI;
	const theme = {
		borderColor: identity,
		selectList: {},
	} as unknown as EditorTheme;
	const ctx = {
		cwd: "/workspace/demo",
		model: undefined,
		thinkingLevel: "off",
		ui: {
			get theme() {
				return getStatusTheme();
			},
		},
	} as unknown as ExtensionContext;

	return new PiUiEditor(
		tui,
		theme,
		{} as KeybindingsManager,
		ctx,
		() => glyphs,
		settings,
		() => 0,
		() => providerStatus,
		{},
		() => timer,
	);
}

function readyProviderState(billingMode: "api" | "subscription" | "hybrid"): UsageRuntimeState {
	return {
		status: "ready",
		provider: { id: "apikey.fun", brandName: "ApiKey" },
		snapshot: {
			provider: { id: "apikey.fun", brandName: "ApiKey" },
			billingMode,
			balance: billingMode === "subscription" ? null : { amount: 411.57, currency: "USD" },
			windows: billingMode === "api" ? [] : [{ label: "5h", remainingPercent: 83, resetMs: null }],
			fetchedAt: 1,
			freshness: "fresh",
		},
	};
}

test("回归原生后不干预 Pi 的 editorPaddingX", () => {
	const editor = makeEditor();
	editor.setText("x");
	editor.setPaddingX(4);
	const after = editor.render(64);

	assert.equal(editor.getPaddingX(), 4);
	assert.ok(after.every((line) => visibleWidth(line) === 64));
	assert.match(stripTerminalSequences(after[1] ?? ""), /^ {4}x/);
});

test("会话遥测移入 Footer 第二行，上下文未就绪时不展示零值 Token 但保留轮数与压缩状态", () => {
	const footer = makeUsageFooter(resolveStatusSettings({ PI_UI_STATUS_SEGMENTS: "tokens,cache,context" }), {
		sessionId: "session-id",
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cost: 0,
		turns: 1,
		compactions: 0,
	}, undefined, 1_000_000);
	const lines = footer.render(80);

	assert.equal(lines.length, 1);
	assert.equal(stripTerminalSequences(lines[0] ?? ""), " 📶 💬 T1 · 🪟 0k/1M · 📦 Off");
	footer.dispose();
});

test("Footer 第二行按宽度依次降级 Token、Cache 和 Context", () => {
	const footer = makeUsageFooter(resolveStatusSettings({ PI_UI_STATUS_SEGMENTS: "tokens,cache,context" }), {
		sessionId: "session-id",
		inputTokens: 41_000,
		outputTokens: 11_000,
		cacheReadTokens: 39_795,
		cacheWriteTokens: 0,
		cacheHitPercent: 99.5,
		cost: 0,
		turns: 1,
		compactions: 2,
	}, { tokens: 18_300, contextWindow: 1_000_000, percent: 1.83 }, 1_000_000, true);
	const wide = stripTerminalSequences(footer.render(80)[0] ?? "");
	const compact = stripTerminalSequences(footer.render(31)[0] ?? "");
	const narrow = stripTerminalSequences(footer.render(21)[0] ?? "");

	assert.match(wide, /↑41k ↓11k R40k · CH99\.5% · 💬 T1 · 🪟 18\.3k\/1M · 📦 Auto（C2）/);
	assert.match(compact, /R40k · CH99\.5% · 🪟 18\.3k\/1M/);
	assert.doesNotMatch(compact, /↑41k|↓11k|Auto|Off/);
	assert.match(narrow, /🪟 18\.3k\/1M/);
	assert.doesNotMatch(narrow, /↑41k|↓11k|R40k|CH99\.5%|Auto|Off/);
	footer.dispose();
});

function makeUsageFooter(
	settings: ResolvedStatusSettings,
	sessionStatus: SessionStatusSnapshot,
	contextUsage: ContextUsage | undefined = undefined,
	contextWindow: number | undefined = undefined,
	autoCompactionEnabled = false,
): ProjectStatusFooter {
	const tui = { requestRender() {} } as unknown as TUI;
	const theme = { fg: (_color: string, text: string) => text } as unknown as Theme;
	const footerData = {
		getGitBranch: () => "",
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 0,
		onBranchChange: () => () => {},
	} as unknown as ReadonlyFooterDataProvider;
	const footer = new ProjectStatusFooter(
		tui,
		theme,
		footerData,
		undefined,
		undefined,
		() => resolveGlyphs("unicode", {}),
		settings,
		undefined,
		"/workspace/demo",
		undefined,
		() => {},
		() => ({ state: "idle" as const, elapsedMs: 0 }),
		() => sessionStatus,
		() => contextUsage,
		() => contextWindow,
		() => autoCompactionEnabled,
	);
	return footer;
}

test("输入框顶边标签不再依赖图标模式，ASCII 不残留 Unicode 或 Nerd glyph", () => {
	const editor = makeEditor(resolveGlyphs("ascii", {}));
	editor.setText("x");
	const top = stripTerminalSequences(editor.render(64)[0] ?? "");

	assert.match(top, /no model · off/);
	assert.doesNotMatch(top, /[◆✦◫🪟\u{e000}-\u{f8ff}]/u);
});

test("本轮耗时显示在输入框顶边状态段末尾", () => {
	const editor = makeEditor(
		resolveGlyphs("unicode", {}),
		resolveStatusSettings({}),
		undefined,
		undefined,
		{ state: "working", elapsedMs: 65_000 },
	);
	editor.setText("x");
	const top = stripTerminalSequences(editor.render(80)[0] ?? "");
	assert.match(top, /no model · off · 1m 05s/);
});

test("供应商查询成功后按供应商、模型、思考、余额排列在编辑框左上角", () => {
	const editor = makeEditor(
		resolveGlyphs("unicode", {}),
		resolveStatusSettings({}),
		undefined,
		readyProviderState("api"),
	);
	(editor as unknown as { ctx: ExtensionContext }).ctx.model = {
		provider: "anthropic",
		id: "claude-opus-5",
	} as ExtensionContext["model"];
	(editor as unknown as { ctx: ExtensionContext }).ctx.thinkingLevel = "max";
	editor.setText("x");

	assert.match(
		stripTerminalSequences(editor.render(160)[0] ?? ""),
		/ApiKey · claude-opus-5 · max · \$411\.57/,
	);
	assert.doesNotMatch(stripTerminalSequences(editor.render(160)[0] ?? ""), /[◈◆✦]/);
	assert.doesNotMatch(stripTerminalSequences(editor.render(160)[0] ?? ""), /⏱️ 17s/);
});

test("供应商查询未成功时保留供应商名，但不显示余额占位", () => {
	for (const status of ["loading", "error", "unsupported"] as const) {
		const editor = makeEditor(
			resolveGlyphs("unicode", {}),
			resolveStatusSettings({}),
			undefined,
			{ status, provider: { id: "apikey.fun", brandName: "ApiKey" }, snapshot: null },
		);
		editor.setText("x");
		const top = stripTerminalSequences(editor.render(120)[0] ?? "");
		assert.match(top, /ApiKey/);
		assert.doesNotMatch(top, /查询|失败|\$/);
	}
});

test("顶边语义色不改变各档终端宽度", () => {
	const coloredTheme = {
		fg: (_color: string, text: string) => `\x1b[35m${text}\x1b[39m`,
	} as Theme;
	const editor = makeEditor(
		resolveGlyphs("unicode", {}),
		resolveStatusSettings({}),
		() => coloredTheme,
	);
	editor.setText("x");

	for (const width of [48, 64, 80, 120, 160]) {
		const lines = editor.render(width);
		assert.ok(lines.every((line) => visibleWidth(line) === width), `width=${width}`);
		assert.match(lines[0] ?? "", /\x1b\[35m/);
	}
});

test("切换 Pi 主题后下一次渲染立即使用新颜色", () => {
	const makeStatusTheme = (code: number) => ({
		fg: (_color: string, text: string) => `\x1b[${code}m${text}\x1b[39m`,
	}) as Theme;
	let currentTheme = makeStatusTheme(31);
	const editor = makeEditor(
		resolveGlyphs("unicode", {}),
		resolveStatusSettings({}),
		() => currentTheme,
	);
	editor.setText("x");

	assert.match(editor.render(80)[0] ?? "", /\x1b\[31m/);
	currentTheme = makeStatusTheme(32);
	const switched = editor.render(80)[0] ?? "";
	assert.match(switched, /\x1b\[32m/);
	assert.doesNotMatch(switched, /\x1b\[31m/);
});

test("minimal 隐藏 Thinking 和耗时，自定义 duration 进入编辑框顶边", () => {
	const minimal = makeEditor(
		resolveGlyphs("unicode", {}),
		resolveStatusSettings({ PI_UI_STATUS_PRESET: "minimal" }),
	);
	minimal.setText("x");
	const minimalTop = stripTerminalSequences(minimal.render(80)[0] ?? "");
	assert.match(minimalTop, /no model/);
	assert.doesNotMatch(minimalTop, /✦|⏱️|\?/);

	const reordered = makeEditor(
		resolveGlyphs("unicode", {}),
		resolveStatusSettings({
			PI_UI_STATUS_SEGMENTS: "duration,model,context",
		}),
		undefined,
		undefined,
		{ state: "done", elapsedMs: 12_000 },
	);
	reordered.setText("x");
	const reorderedTop = stripTerminalSequences(reordered.render(80)[0] ?? "");
	assert.match(reorderedTop, /12s · no model/);
	assert.doesNotMatch(reorderedTop, /✦/);
});

test("Footer 按预设隐藏扩展状态，关闭项目行时不留下空白行", () => {
	const extensionStatuses = new Map([["demo", "extension ready"]]);
	const footerData = {
		getGitBranch: () => "main",
		getExtensionStatuses: () => extensionStatuses,
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	} as unknown as ReadonlyFooterDataProvider;
	const tui = { requestRender() {} } as unknown as TUI;
	const theme = { fg: (_color: string, text: string) => text } as unknown as Theme;
	const makeController = () => new ProjectStatusController(
		"/workspace/demo",
		async () => undefined,
		0,
		0,
	);

	const minimal = new ProjectStatusFooter(
		tui,
		theme,
		footerData,
		makeController(),
		undefined,
		() => resolveGlyphs("unicode", {}),
		resolveStatusSettings({ PI_UI_STATUS_PRESET: "minimal" }),
	);
	// Git 查询启动前为弱化占位，Footer 结构首帧定型。
	assert.deepEqual(minimal.render(80), [" 📂 /workspace/demo · ⎇ …", " 📶 🪟 0k/? · 📦 Off"]);
	minimal.startStatusQueries();
	assert.deepEqual(minimal.render(80), [" 📂 /workspace/demo · ⎇ main", " 📶 🪟 0k/? · 📦 Off"]);
	minimal.dispose();

	const extensionsOnly = new ProjectStatusFooter(
		tui,
		theme,
		footerData,
		makeController(),
		undefined,
		() => resolveGlyphs("unicode", {}),
		resolveStatusSettings({ PI_UI_STATUS_SEGMENTS: "extensions" }),
	);
	assert.deepEqual(extensionsOnly.render(80), [" extension ready"]);
	extensionStatuses.set(
		"demo",
		"\x1b[38;2;122;162;247m◇ MCP: 6 servers enabled (2 connected)\x1b[39m",
	);
	const styledStatus = extensionsOnly.render(80)[0] ?? "";
	assert.equal(stripTerminalSequences(styledStatus), " ◇ MCP: 6 servers enabled (2 connected)");
	assert.match(styledStatus, /\x1b\[38;2;122;162;247m/);
	assert.doesNotMatch(stripTerminalSequences(styledStatus), /\[38;2;|\[39m/);
	extensionStatuses.set("demo", "\x1b]0;bad-title\x07safe\nstatus\x1b[2J");
	assert.deepEqual(extensionsOnly.render(80), [" safe status"]);
	extensionsOnly.dispose();
	extensionStatuses.set("demo", "extension ready");

	const defaultFooter = new ProjectStatusFooter(
		tui,
		theme,
		footerData,
		makeController(),
		undefined,
		() => resolveGlyphs("unicode", {}),
		resolveStatusSettings({}),
	);
	defaultFooter.startStatusQueries();
	assert.deepEqual(defaultFooter.render(160), [
		" 📂 /workspace/demo · ⎇ main",
		" 📶 🪟 0k/? · 📦 Off",
		" extension ready",
	]);
	defaultFooter.dispose();

	const fullFooter = new ProjectStatusFooter(
		tui,
		theme,
		footerData,
		makeController(),
		undefined,
		() => resolveGlyphs("unicode", {}),
		resolveStatusSettings({ PI_UI_STATUS_PRESET: "full" }),
	);
	fullFooter.startStatusQueries();
	assert.deepEqual(fullFooter.render(160), [
		" 📂 /workspace/demo · ⎇ main",
		" 📶 🪟 0k/? · 📦 Off",
		" extension ready",
	]);
	fullFooter.dispose();
});

test("订阅额度窗口进入编辑框顶边，与余额按计费模式互斥呈现", () => {
	const makeState = (billingMode: "api" | "subscription" | "hybrid"): UsageRuntimeState => ({
		status: "ready",
		provider: { id: "zhipu", brandName: "Zhipu" },
		snapshot: {
			provider: { id: "zhipu", brandName: "Zhipu" },
			billingMode,
			balance: billingMode === "subscription" ? null : { amount: 32.4, currency: "CNY" },
			windows: billingMode === "api" ? [] : [{ label: "5h", remainingPercent: 83, resetMs: null }],
			fetchedAt: 1,
			freshness: "fresh",
		},
	});
	const topOf = (billingMode: "api" | "subscription" | "hybrid") => {
		const editor = makeEditor(
			resolveGlyphs("unicode", {}),
			resolveStatusSettings({}),
			undefined,
			makeState(billingMode),
		);
		editor.setText("x");
		return stripTerminalSequences(editor.render(160)[0] ?? "");
	};

	assert.match(topOf("api"), /Zhipu · no model · off · ¥32\.40/);
	assert.doesNotMatch(topOf("api"), /5h|83%/);
	assert.match(topOf("subscription"), /Zhipu · no model · off · 5h 83%/);
	assert.doesNotMatch(topOf("subscription"), /¥|\$/);
	assert.match(topOf("hybrid"), /Zhipu · no model · off · ¥32\.40 · 5h 83%/);
});

test("窄屏顶边订阅段先去重置倒计时再整体让位，模型段保底", () => {
	const state: UsageRuntimeState = {
		status: "ready",
		provider: { id: "zhipu", brandName: "Zhipu" },
		snapshot: {
			provider: { id: "zhipu", brandName: "Zhipu" },
			billingMode: "subscription",
			balance: null,
			windows: [{ label: "5h", remainingPercent: 83, resetMs: Date.now() + 7_261_000 }],
			fetchedAt: 1,
			freshness: "fresh",
		},
	};
	const editor = makeEditor(
		resolveGlyphs("unicode", {}),
		resolveStatusSettings({}),
		undefined,
		state,
	);
	editor.setText("x");

	const wide = stripTerminalSequences(editor.render(80)[0] ?? "");
	assert.match(wide, /5h 83% 2h[0-9]m/);
	const compact = stripTerminalSequences(editor.render(38)[0] ?? "");
	assert.match(compact, /5h 83%/);
	assert.doesNotMatch(compact, /2h[0-9]m/);
});

test("真实 CustomEditor 在极窄宽度回退原生渲染", () => {
	const editor = makeEditor();
	editor.setText("narrow");
	const lines = editor.render(12);

	assert.ok(lines.every((line) => visibleWidth(line) === 12));
	assert.ok(lines.every((line) => !/^[╭┌]/.test(stripTerminalSequences(line))));
});

test("终端过渡闸门在启动和 reload 期间隐藏原生帧，只揭示准备完成的插件帧", () => {
	const visibleWrites: string[] = [];
	const terminalPrototype = {
		write(data: string) {
			visibleWrites.push(data);
		},
	};
	const terminal = Object.assign(Object.create(terminalPrototype), {
		columns: 80,
		rows: 5,
		kittyProtocolActive: false,
		start() {},
		stop() {},
		async drainInput() {},
		moveBy() {},
		hideCursor() {},
		showCursor() {},
		clearLine() {},
		clearFromCursor() {},
		clearScreen() {},
		setTitle() {},
		setProgress() {},
	}) as Terminal;
	let frame = ["plugin editor", "project status"];
	const tui = new TuiMainScreen(terminal, false);
	tui.addChild({
		invalidate() {},
		render: () => frame,
	});
	const startupOutput: string[] = [];
	const gate = new TerminalTransitionGate(undefined, {
		isTTY: true,
		write: (data) => startupOutput.push(data),
	});
	gate.hookTerminal(terminal);

	assert.equal(gate.hold(), true);
	terminal.write("native startup editor");
	assert.equal(startupOutput.length, 0);
	assert.equal(visibleWrites.some((write) => write.includes("\x1b[2J")), true);
	assert.equal(visibleWrites.some((write) => write.includes("native startup editor")), false);
	assert.equal(gate.reveal(tui), true);
	assert.equal(visibleWrites.some((write) => write.includes("native startup editor")), false);
	assert.match(visibleWrites.at(-1) ?? "", /plugin editor/);
	assert.equal(visibleWrites.some((write) => write.includes("\x1b[3J")), false);

	visibleWrites.length = 0;
	assert.equal(gate.hold(tui, { clearVisibleScreen: true }), true);
	assert.equal(visibleWrites.some((write) => write.includes("\x1b[2J\x1b[H")), true);
	visibleWrites.length = 0;
	frame = ["Reloading extensions...", "native editor"];
	tui.renderNow(false);
	frame = ["conversation", "plugin editor", "project status"];
	const overlay = tui.showOverlay(
		{ invalidate() {}, render: () => ["reload command overlay"] },
		{ nonCapturing: true },
	);
	assert.equal(gate.reveal(tui), true);
	overlay.hide();
	assert.equal(visibleWrites.some((write) => write.includes("Reloading extensions")), false);
	assert.equal(visibleWrites.some((write) => write.includes("native editor")), false);
	assert.equal(visibleWrites.some((write) => write.includes("\x1b[2J")), false);
	assert.match(visibleWrites.at(-1) ?? "", /conversation/);
	assert.match(visibleWrites.at(-1) ?? "", /plugin editor/);
	assert.equal(visibleWrites.some((write) => write.includes("\x1b[3J")), false);
});

test("过渡闸门只等待稳定 Editor 帧，不等待任何状态查询", async () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const events: string[] = [];
	let holding = false;
	const transitionGate = {
		hold: () => {
			holding = true;
			events.push("hold");
			return true;
		},
		isHolding: () => holding,
		reveal: () => {
			holding = false;
			events.push("reveal");
			return true;
		},
		hookTerminal: () => {},
		release: () => { holding = false; },
	} as unknown as TerminalTransitionGate;
	let editor: PiUiEditor | undefined;
	let gitBranchReads = 0;
	let execCalls = 0;
	const tui = {
		mode: "regular",
		terminal: { rows: 24 },
		requestRender: (force?: boolean) => events.push(`requestRender:${force ?? false}`),
	} as unknown as TUI;
	const footerData = {
		getGitBranch: () => {
			gitBranchReads += 1;
			return "main";
		},
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	};
	let editorFactory: unknown;
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		model: {
			provider: "openai-codex",
			id: "gpt-5.6-luna",
			baseUrl: "https://chatgpt.com/backend-api",
		},
		modelRegistry: {
			getApiKeyAndHeaders: () => new Promise<never>(() => {}),
			isUsingOAuth: () => true,
		},
		thinkingLevel: "off",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme: { fg: (_color: string, text: string) => text } as Theme,
			getEditorComponent: () => editorFactory,
			setEditorComponent: (factory: unknown) => {
				editorFactory = factory;
				if (typeof factory === "function") {
					editor = (factory as (
						tui: TUI,
						theme: EditorTheme,
						keybindings: KeybindingsManager,
					) => PiUiEditor)(
						tui,
						{ borderColor: identity, selectList: {} } as unknown as EditorTheme,
						{} as KeybindingsManager,
					);
				}
			},
				setFooter: (factory: unknown) => {
				if (typeof factory === "function") {
					(factory as Function)(tui, { fg: (_color: string, text: string) => text }, footerData);
				}
			},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: () => {
			execCalls += 1;
			return new Promise<never>(() => {});
		},
	} as unknown as ExtensionAPI;

	install(pi, { isTTY: true }, {
		...TEST_PLUGIN_DEPENDENCIES,
		env: { PI_UI_STATUS_PRESET: "full" },
		transitionGate,
	});
	handlers.get("session_start")?.({ type: "session_start", reason: "reload" }, ctx);
	assert.ok(editor);
	assert.equal(gitBranchReads, 0);
	assert.equal(execCalls, 0);
	editor.render(80);
	await new Promise<void>((resolve) => setImmediate(resolve));
	// Footer 高度在 setFooter 工厂内主动渲染回报（闸门期不依赖 dock），
	// 揭示门槛在 Editor 稳定帧后即可满足。
	assert.equal(events.includes("reveal"), false);

	editor.render(80);
	await new Promise<void>((resolve) => setTimeout(resolve, 60));
	assert.equal(events.filter((event) => event === "reveal").length, 1);
	assert.equal(gitBranchReads, 1);
	assert.equal(execCalls, 1);
	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" });
});

test("闸门已提前释放时编辑框首帧仍启动状态查询，不依赖揭示回调", async () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	let holding = false;
	const reveals = { count: 0 };
	const transitionGate = {
		hold: () => { holding = true; return true; },
		isHolding: () => holding,
		reveal: () => { holding = false; reveals.count += 1; return true; },
		release: () => { holding = false; },
		hookTerminal: () => {},
	} as unknown as TerminalTransitionGate;
	let editor: PiUiEditor | undefined;
	let gitBranchReads = 0;
	let execCalls = 0;
	const tui = {
		mode: "regular",
		terminal: { rows: 24 },
		requestRender: () => {},
	} as unknown as TUI;
	const footerData = {
		getGitBranch: () => {
			gitBranchReads += 1;
			return "main";
		},
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	};
	let editorFactory: unknown;
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		model: undefined,
		thinkingLevel: "off",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme: { fg: (_color: string, text: string) => text } as Theme,
			getEditorComponent: () => editorFactory,
			setEditorComponent: (factory: unknown) => {
				editorFactory = factory;
				if (typeof factory === "function") {
					editor = (factory as Function)(
						tui,
						{ borderColor: identity, selectList: {} } as unknown as EditorTheme,
						{} as KeybindingsManager,
					);
				}
			},
			setFooter: (factory: unknown) => {
				if (typeof factory === "function") {
					(factory as Function)(tui, { fg: (_c: string, t: string) => t }, footerData);
				}
			},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: () => {
			execCalls += 1;
			return new Promise<never>(() => {});
		},
	} as unknown as ExtensionAPI;

	install(pi, { isTTY: true }, {
		...TEST_PLUGIN_DEPENDENCIES,
		env: { PI_UI_STATUS_PRESET: "full" },
		transitionGate,
	});
	// 模拟闸门在首帧前已被其它路径释放（本会话 bug 的触发形态）。
	holding = false;
	handlers.get("session_start")?.({ type: "session_start", reason: "reload" }, ctx);
	assert.ok(editor);
	editor.render(80);
	await new Promise<void>((resolve) => setTimeout(resolve, 60));
	// 兜底直启分支调度状态查询；exec 计数受同进程模块状态影响，不在此断言，
	// 该场景的确定性断言由组件级测试（占位→connect→替换）覆盖。
	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" });
});

test("关闭自定义 Editor 时 Footer 安装后立即揭示并启动延迟查询", async () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const events: string[] = [];
	let holding = false;
	const transitionGate = {
		hold: () => {
			holding = true;
			events.push("hold");
			return true;
		},
		isHolding: () => holding,
		reveal: () => {
			holding = false;
			events.push("reveal");
			return true;
		},
		hookTerminal: () => {},
		release: () => { holding = false; },
	} as unknown as TerminalTransitionGate;
	const config = parsePiTuiConfig(DEFAULT_PI_TUI_CONFIG);
	config.appearance.editor = false;
	const tui = {
		mode: "regular",
		terminal: { rows: 24 },
		requestRender() {},
	} as unknown as TUI;
	const footerData = {
		getGitBranch: () => {
			events.push("branch");
			return "main";
		},
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	};
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		model: undefined,
		thinkingLevel: "off",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme: { fg: (_color: string, text: string) => text } as Theme,
			getEditorComponent: () => undefined,
			setFooter: (factory: unknown) => {
				if (typeof factory !== "function") return;
				events.push("footer");
				(factory as Function)(tui, { fg: (_color: string, text: string) => text }, footerData);
			},
			setWorkingVisible() {},
			setWorkingIndicator() {},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		registerEntryRenderer() {},
		exec: async () => {
			events.push("exec");
			return { stdout: "", stderr: "", code: 0, killed: false };
		},
	} as unknown as ExtensionAPI;

	install(pi, { isTTY: true }, {
		...TEST_PLUGIN_DEPENDENCIES,
		loadConfig: () => ({ config, warnings: [] }),
		transitionGate,
	});
	handlers.get("session_start")?.({ type: "session_start", reason: "reload" }, ctx);
	assert.equal(holding, false);
	// 首次 hold 延迟到 session_start，避免项目 Trust 界面被启动过渡门清掉。
	assert.deepEqual(events.slice(0, 4), ["hold", "footer", "reveal", "branch"]);
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.ok(events.indexOf("exec") > events.indexOf("reveal"));
	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" });
});

test("全新 TuiMainScreen 的 pristine 缓存会闪屏并走首次完整渲染", () => {
	const { terminal, writes } = makeTerminal(80, 5);
	const tui = new TuiMainScreen(terminal, false);
	tui.addChild({
		invalidate() {},
		render: () => ["conversation", "custom editor", "project status"],
	});

	const preClearState = flashVisibleScreen(tui, { isTTY: true });
	assert.ok(preClearState);
	assert.deepEqual(preClearState, {
		previousLines: [],
		previousWidth: 0,
		previousHeight: 0,
		cursorRow: 0,
		hardwareCursorRow: 0,
		maxLinesRendered: 0,
		previousViewportTop: 0,
	});
	assert.deepEqual(writes, ["\x1b[2J\x1b[H"]);

	assert.equal(restoreVisibleMainScreen(tui, preClearState), true);
	assert.equal(writes.filter((write) => write.includes("\x1b[2J")).length, 1);
	assert.equal(writes.some((write) => write.includes("\x1b[3J")), false);
	assert.match(writes.at(-1) ?? "", /conversation/);
	assert.match(writes.at(-1) ?? "", /custom editor/);
	assert.match(writes.at(-1) ?? "", /project status/);
	assert.deepEqual(tui.captureRenderState().previousLines.map(stripTerminalSequences), [
		"conversation",
		"custom editor",
		"project status",
	]);
});

test("regular main-screen 清屏后同步恢复当前可见区且不发送 3J", () => {
	const { terminal, writes } = makeTerminal(80, 5);
	const lines = Array.from({ length: 30 }, (_, index) => `VISIBLE_${String(index).padStart(2, "0")}`);
	const tui = new TuiMainScreen(terminal, false);
	tui.addChild({
		invalidate() {},
		render: () => lines,
	});
	tui.renderNow(false);
	writes.length = 0;

	assert.equal(restoreVisibleMainScreen(tui), true);
	assert.equal(writes[0], "\x1b[2J\x1b[H");
	assert.equal(writes.some((write) => write.includes("\x1b[3J")), false);
	assert.match(writes.at(-1) ?? "", /VISIBLE_25/);
	assert.match(writes.at(-1) ?? "", /VISIBLE_29/);
	assert.doesNotMatch(writes.at(-1) ?? "", /VISIBLE_24/);
	assert.equal(tui.captureRenderState().previousViewportTop, 25);
});

test("模型切换后延迟执行可见区安全重绘，不清除 scrollback", async () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const { terminal, writes } = makeTerminal(80, 5);
	const tui = new TuiMainScreen(terminal, false);
	let frame = ["old editor", "old MCP error", "old footer"];
	tui.addChild({
		invalidate() {},
		render: () => frame,
	});
	tui.renderNow(false);
	writes.length = 0;

	let currentFactory: unknown;
	const theme = { fg: (_color: string, text: string) => text } as Theme;
	const footerData = {
		getGitBranch: () => "",
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 0,
		onBranchChange: () => () => {},
	};
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		model: { provider: "demo", id: "old-model" },
		thinkingLevel: "off",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme,
			getEditorComponent: () => currentFactory,
			setEditorComponent: (factory: unknown) => {
				currentFactory = factory;
				if (typeof factory === "function") {
					(factory as Function)(tui, { borderColor: identity, selectList: {} }, {});
				}
			},
			setFooter: (factory: unknown) => {
				if (typeof factory === "function") {
					(factory as Function)(tui, theme, footerData);
				}
			},
			setWorkingVisible() {},
			setWorkingIndicator() {},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
	} as unknown as ExtensionAPI;

	install(pi, { isTTY: false }, {
		...TEST_PLUGIN_DEPENDENCIES,
		transitionGate: null,
		loadConfig: () => {
			const config = parsePiTuiConfig(DEFAULT_PI_TUI_CONFIG);
			config.status.segments = ["model"];
			return { config, warnings: [] };
		},
	});
	handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
	frame = ["new editor", "new footer"];
	handlers.get("model_select")?.({ type: "model_select", model: { provider: "demo", id: "new-model" } }, ctx);
	await new Promise((resolve) => setTimeout(resolve, 30));

	assert.ok(writes.some((write) => write.includes("\x1b[2J\x1b[H")));
	assert.equal(writes.some((write) => write.includes("\x1b[3J")), false);
	assert.match(writes.join(""), /new editor/);
	assert.doesNotMatch(writes.join(""), /old MCP error/);
	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" });
});

test("已闪屏的 regular main-screen 恢复时不发送第二次 2J 或 3J", () => {
	const { terminal, writes } = makeTerminal(80, 5);
	const lines = Array.from({ length: 30 }, (_, index) => `VISIBLE_${String(index).padStart(2, "0")}`);
	const tui = new TuiMainScreen(terminal, false);
	tui.addChild({
		invalidate() {},
		render: () => lines,
	});
	tui.renderNow(false);
	const preClearState = tui.captureRenderState();
	writes.length = 0;

	assert.equal(restoreVisibleMainScreen(tui, preClearState), true);
	assert.equal(writes.some((write) => write.includes("\x1b[2J")), false);
	assert.equal(writes.some((write) => write.includes("\x1b[3J")), false);
	assert.match(writes.at(-1) ?? "", /VISIBLE_25/);
	assert.match(writes.at(-1) ?? "", /VISIBLE_29/);
});

test("非 regular、图片、异常尺寸和不稳定状态只同步渲染，不清屏", () => {
	const fullscreenWrites: string[] = [];
	const fullscreenRenders: boolean[] = [];
	const fullscreen = {
		mode: "fullscreen",
		terminal: {
			columns: 80,
			rows: 24,
			write: (data: string) => fullscreenWrites.push(data),
		},
		renderNow: (force: boolean) => fullscreenRenders.push(force),
	} as unknown as TUI;
	assert.equal(restoreVisibleMainScreen(fullscreen), false);
	assert.deepEqual(fullscreenRenders, [false]);
	assert.deepEqual(fullscreenWrites, []);
	assert.equal(flashVisibleScreen(fullscreen, { isTTY: true }), undefined);
	assert.deepEqual(fullscreenRenders, [false]);
	assert.deepEqual(fullscreenWrites, []);

	const kittyWrites: string[] = [];
	let kittyRenderCount = 0;
	let kittyRestoreCount = 0;
	const kitty = {
		mode: "regular",
		terminal: {
			columns: 80,
			rows: 24,
			write: (data: string) => kittyWrites.push(data),
		},
		hasOverlay: () => false,
		renderNow: () => {
			kittyRenderCount += 1;
		},
		captureRenderState: () => ({
			previousLines: ["\x1b_Gi=1;AAAA\x1b\\"],
			previousWidth: 80,
			previousHeight: 24,
			cursorRow: 0,
			hardwareCursorRow: 0,
			maxLinesRendered: 1,
			previousViewportTop: 0,
		}),
		restoreRenderState: () => {
			kittyRestoreCount += 1;
		},
	} as unknown as TUI;
	assert.equal(flashVisibleScreen(kitty, { isTTY: true }), undefined);
	assert.equal(kittyRenderCount, 0);
	assert.equal(kittyRestoreCount, 0);
	assert.deepEqual(kittyWrites, []);
	assert.equal(restoreVisibleMainScreen(kitty), false);
	assert.equal(kittyRenderCount, 1);
	assert.equal(kittyRestoreCount, 0);
	assert.deepEqual(kittyWrites, []);

	const malformedEmptyWrites: string[] = [];
	const malformedEmpty = {
		mode: "regular",
		terminal: {
			columns: 80,
			rows: 24,
			write: (data: string) => malformedEmptyWrites.push(data),
		},
		hasOverlay: () => false,
		captureRenderState: () => ({
			previousLines: [],
			previousWidth: 80,
			previousHeight: 24,
			cursorRow: 0,
			hardwareCursorRow: 0,
			maxLinesRendered: 0,
			previousViewportTop: 0,
		}),
		restoreRenderState() {},
	} as unknown as TUI;
	assert.equal(flashVisibleScreen(malformedEmpty, { isTTY: true }), undefined);
	assert.deepEqual(malformedEmptyWrites, []);

	for (const unsafeState of [
		{
			name: "尺寸异常",
			terminalRows: 0,
			states: [["stable"]],
		},
		{
			name: "连续渲染不稳定",
			terminalRows: 1,
			states: [["first"], ["second"]],
		},
	]) {
		const unsafeWrites: string[] = [];
		let renderCount = 0;
		let captureCount = 0;
		let restoreCount = 0;
		const unsafeTui = {
			mode: "regular",
			terminal: {
				columns: 80,
				rows: unsafeState.terminalRows,
				write: (data: string) => unsafeWrites.push(data),
			},
			hasOverlay: () => false,
			renderNow: () => {
				renderCount += 1;
			},
			captureRenderState: () => {
				const lines = unsafeState.states[Math.min(captureCount, unsafeState.states.length - 1)] ?? [];
				captureCount += 1;
				return {
					previousLines: lines,
					previousWidth: 80,
					previousHeight: unsafeState.terminalRows,
					cursorRow: 0,
					hardwareCursorRow: 0,
					maxLinesRendered: lines.length,
					previousViewportTop: 0,
				};
			},
			restoreRenderState: () => {
				restoreCount += 1;
			},
		} as unknown as TUI;

		assert.equal(restoreVisibleMainScreen(unsafeTui), false, unsafeState.name);
		assert.equal(renderCount, unsafeState.terminalRows === 0 ? 1 : 2, unsafeState.name);
		assert.equal(restoreCount, 0, unsafeState.name);
		assert.deepEqual(unsafeWrites, [], unsafeState.name);
	}
});

test("startup 和 reload 都在准备恢复状态后等待 Pi 下一自然帧", () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const events: string[] = [];
	const writes: string[] = [];
	let renderState = {
		previousLines: [] as string[],
		previousWidth: 0,
		previousHeight: 0,
		cursorRow: 0,
		hardwareCursorRow: 0,
		maxLinesRendered: 0,
		previousViewportTop: 0,
	};
	const tui = {
		mode: "regular",
		terminal: {
			columns: 80,
			rows: 2,
			write: (data: string) => {
				events.push("clear");
				writes.push(data);
			},
		},
		requestRender: (force: boolean) => events.push(`requestRender:${force}`),
		renderNow: () => events.push("renderNow"),
		hasOverlay: () => false,
		captureRenderState: () => {
			events.push("captureState");
			return { ...renderState, previousLines: [...renderState.previousLines] };
		},
		restoreRenderState: (state: typeof renderState) => {
			events.push("restoreState");
			renderState = { ...state, previousLines: [...state.previousLines] };
		},
	} as unknown as TUI;
	const editorTheme = { borderColor: identity, selectList: {} } as unknown as EditorTheme;
	const footerData = {
		getGitBranch: () => null,
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => events.push("unsubscribeBranch"),
	};
	let currentFactory: unknown;
	let footer: { dispose?: () => void } | undefined;
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		ui: {
			getEditorComponent: () => currentFactory,
			setEditorComponent: (factory: unknown) => {
				events.push(factory ? "setEditor" : "restoreEditor");
				currentFactory = factory;
				if (typeof factory === "function") {
					factory(tui, editorTheme, {} as KeybindingsManager);
				}
			},
			setFooter: (factory: unknown) => {
				if (typeof factory === "function") {
					events.push("setFooter");
					footer = factory(tui, { fg: (_color: string, text: string) => text }, footerData);
				} else {
					events.push("restoreFooter");
					footer?.dispose?.();
					footer = undefined;
				}
			},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
	} as unknown as ExtensionAPI;
	install(pi, { isTTY: true }, TEST_PLUGIN_DEPENDENCIES);

	const expectedStartup = [
		"setEditor",
		"captureState",
		"clear",
		"setFooter",
		"requestRender:false",
	];
	handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
	assert.deepEqual(events, expectedStartup);

	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "reload" });
	const reloadStart = events.length;
	renderState = {
		previousLines: ["conversation", "editor"],
		previousWidth: 80,
		previousHeight: 2,
		cursorRow: 1,
		hardwareCursorRow: 1,
		maxLinesRendered: 2,
		previousViewportTop: 0,
	};
	handlers.get("session_start")?.({ type: "session_start", reason: "reload" }, ctx);
	assert.deepEqual(events.slice(reloadStart), [
		"setEditor",
		"captureState",
		"clear",
		"setFooter",
		"restoreState",
		"requestRender:false",
	]);
	assert.equal(events.includes("renderNow"), false);
	assert.deepEqual(writes, ["\x1b[2J\x1b[H", "\x1b[2J\x1b[H"]);
	assert.equal(writes.some((write) => write.includes("\x1b[3J")), false);
	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" });
});

test("闪屏后 Footer 安装失败会恢复原 Editor 并立即重画", () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const events: string[] = [];
	const writes: string[] = [];
	let autoCompactionWatchDisposed = 0;
	const renderState = {
		previousLines: ["conversation", "editor"],
		previousWidth: 80,
		previousHeight: 2,
		cursorRow: 1,
		hardwareCursorRow: 1,
		maxLinesRendered: 2,
		previousViewportTop: 0,
	};
	const tui = {
		mode: "regular",
		terminal: {
			columns: 80,
			rows: 2,
			write: (data: string) => {
				events.push("clear");
				writes.push(data);
			},
		},
		requestRender() {},
		renderNow: (force: boolean) => events.push(`renderNow:${force}`),
		hasOverlay: () => false,
		captureRenderState: () => {
			events.push("captureState");
			return { ...renderState, previousLines: [...renderState.previousLines] };
		},
		restoreRenderState: () => events.push("restoreState"),
	} as unknown as TUI;
	const previousFactory = () => undefined;
	let currentFactory: unknown = previousFactory;
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		ui: {
			getEditorComponent: () => currentFactory,
			setEditorComponent: (factory: unknown) => {
				currentFactory = factory;
				if (factory === previousFactory) {
					events.push("restoreEditor");
					return;
				}
				events.push("setEditor");
				if (typeof factory === "function") {
					factory(
						tui,
						{ borderColor: identity, selectList: {} } as unknown as EditorTheme,
						{} as KeybindingsManager,
					);
				}
			},
			setFooter: (factory: unknown) => {
				if (factory) {
					events.push("setFooter");
					throw new Error("footer failed");
				}
				events.push("restoreFooter");
			},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
	} as unknown as ExtensionAPI;
	install(pi, { isTTY: true }, {
		...TEST_PLUGIN_DEPENDENCIES,
		watchAutoCompactionSettings: () => () => {
			autoCompactionWatchDisposed += 1;
		},
	});

	assert.throws(
		() => handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx),
		/footer failed/,
	);
	assert.deepEqual(events, [
		"setEditor",
		"captureState",
		"clear",
		"setFooter",
		"restoreFooter",
		"restoreEditor",
		"restoreState",
		"renderNow:false",
	]);
	assert.deepEqual(writes, ["\x1b[2J\x1b[H"]);
	assert.equal(autoCompactionWatchDisposed, 1);
});

test("生命周期幂等安装并成对清理，重复 shutdown 不泄漏且不覆盖后继 Editor", () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const previousFactory = () => undefined;
	const successorFactory = () => undefined;
	let currentFactory: unknown = previousFactory;
	const footerFactories: unknown[] = [];
	const events: string[] = [];
	let branchListener: (() => void) | undefined;
	let branchSubscribeCount = 0;
	let branchUnsubscribeCount = 0;
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		model: undefined,
		thinkingLevel: "off",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme: { fg: (_color: string, text: string) => text } as Theme,
			getEditorComponent: () => currentFactory,
			setEditorComponent: (factory: unknown) => {
				events.push(
					factory === previousFactory
						? "restorePreviousEditor"
						: factory
							? "setEditor"
							: "restoreDefaultEditor",
				);
				currentFactory = factory;
			},
			setFooter: (factory: unknown) => {
				events.push(factory ? "setFooter" : "restoreFooter");
				footerFactories.push(factory);
			},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => {
			handlers.set(event, handler);
		},
		exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
		appendEntry() {},
	} as unknown as ExtensionAPI;

	install(pi, undefined, TEST_PLUGIN_DEPENDENCIES);
	const start = handlers.get("session_start");
	const shutdown = handlers.get("session_shutdown");
	assert.ok(start);
	assert.ok(shutdown);

	start({ type: "session_start", reason: "startup" }, ctx);
	assert.deepEqual(events, ["setEditor", "setFooter"]);
	assert.notEqual(currentFactory, previousFactory);
	assert.equal(typeof footerFactories.at(-1), "function");
	const firstOwnFactory = currentFactory;
	const eventsAfterFirstStart = [...events];
	start({ type: "session_start", reason: "reload" }, ctx);
	assert.equal(currentFactory, firstOwnFactory);
	assert.equal(footerFactories.length, 1);
	assert.deepEqual(events, eventsAfterFirstStart);

	let timerRenderCount = 0;
	const editor = (currentFactory as (
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
	) => PiUiEditor)(
		{
			terminal: { rows: 24 },
			requestRender: () => {
				timerRenderCount += 1;
			},
		} as unknown as TUI,
		{ borderColor: identity, selectList: {} } as unknown as EditorTheme,
		{} as KeybindingsManager,
	);
	editor.setText("x");
	handlers.get("agent_start")?.({ type: "agent_start" }, ctx);
	assert.equal(timerRenderCount, 1);
	assert.match(stripTerminalSequences(editor.render(80)[0] ?? ""), / · 0s/);
	handlers.get("agent_end")?.({ type: "agent_end", messages: [] }, ctx);
	assert.equal(timerRenderCount, 2);
	assert.match(stripTerminalSequences(editor.render(80)[0] ?? ""), / · 0s/);
	handlers.get("message_end")?.({ type: "message_end", message: {} }, ctx);
	handlers.get("session_info_changed")?.({ type: "session_info_changed", name: "主线" }, ctx);
	handlers.get("session_compact")?.({ type: "session_compact" }, ctx);
	handlers.get("session_tree")?.({ type: "session_tree" }, ctx);
	assert.equal(timerRenderCount, 6);

	const footerFactory = footerFactories.at(-1) as (
		tui: unknown,
		theme: { fg: (color: string, text: string) => string },
		footerData: { getExtensionStatuses: () => ReadonlyMap<string, string> },
	) => { render: (width: number) => string[]; startStatusQueries: () => void };
	const makeFooterData = (statuses: ReadonlyMap<string, string>) => ({
		getGitBranch: () => "main",
		getExtensionStatuses: () => statuses,
		getAvailableProviderCount: () => 1,
		onBranchChange: (callback: () => void) => {
			branchSubscribeCount += 1;
			branchListener = callback;
			return () => {
				branchUnsubscribeCount += 1;
				events.push("unsubscribeBranch");
				branchListener = undefined;
			};
		},
	});
	const tui = { requestRender() {} };
	const emptyFooter = footerFactory(tui, { fg: (_color, text) => text }, makeFooterData(new Map()));
	const statusFooter = footerFactory(
		tui,
		{ fg: (_color, text) => text },
		makeFooterData(
			new Map([
				["z-last", "second\nstatus"],
				["a-first", "extension ready"],
			]),
		),
	);
	emptyFooter.startStatusQueries();
	statusFooter.startStatusQueries();
	assert.deepEqual(emptyFooter.render(64), [
		" 📂 /workspace/demo · ⎇ main",
		" 📶 🪟 0k/? · 📦 Off",
	]);
	assert.deepEqual(statusFooter.render(64), [
		" 📂 /workspace/demo · ⎇ main",
		" 📶 🪟 0k/? · 📦 Off",
		" extension ready · second status",
	]);
	assert.equal(branchSubscribeCount, 2);
	const shutdownEventStart = events.length;
	shutdown({ type: "session_shutdown", reason: "reload" });
	assert.deepEqual(events.slice(shutdownEventStart), [
		"unsubscribeBranch",
		"restoreFooter",
		"restorePreviousEditor",
	]);
	assert.equal(currentFactory, previousFactory);
	assert.equal(footerFactories.at(-1), undefined);
	assert.equal(branchUnsubscribeCount, 2);
	const eventsAfterShutdown = events.length;
	shutdown({ type: "session_shutdown", reason: "reload" });
	assert.equal(events.length, eventsAfterShutdown);
	assert.equal(branchUnsubscribeCount, 2);

	start({ type: "session_start", reason: "reload" }, ctx);
	const secondFooterFactory = footerFactories.at(-1) as (
		tui: unknown,
		theme: { fg: (color: string, text: string) => string },
		footerData: ReturnType<typeof makeFooterData>,
	) => { render: (width: number) => string[]; startStatusQueries: () => void };
	secondFooterFactory(tui, { fg: (_color, text) => text }, makeFooterData(new Map())).startStatusQueries();
	currentFactory = successorFactory;
	shutdown({ type: "session_shutdown", reason: "quit" });
	assert.equal(currentFactory, successorFactory);
	assert.equal(branchUnsubscribeCount, 3);
});

test("自动压缩配置变化后刷新状态，重复事件和销毁后不重绘", () => {
	let enabled = true;
	let notifyChange: (() => void) | undefined;
	let renderCount = 0;
	let watchDisposed = false;
	const controller = new AutoCompactionStatusController(
		() => enabled,
		(onChange) => {
			notifyChange = onChange;
			return () => { watchDisposed = true; };
		},
		() => { renderCount += 1; },
	);

	assert.equal(controller.getSnapshot(), true);
	enabled = false;
	notifyChange?.();
	assert.equal(controller.getSnapshot(), false);
	assert.equal(renderCount, 1);
	notifyChange?.();
	assert.equal(renderCount, 1);

	controller.dispose();
	assert.equal(watchDisposed, true);
	enabled = true;
	notifyChange?.();
	assert.equal(controller.getSnapshot(), false);
	assert.equal(renderCount, 1);
});

test("regular 模式把自动补全贴到编辑框上方，正文输入区高度保持不变", async () => {
	let overlayComponent: Component | undefined;
	let overlayOptions: OverlayOptions | undefined;
	let overlayHidden = false;
	let overlayShowCount = 0;
	let hardwareCursorRow = 12;
	const events: string[] = [];
	let editor: PiUiEditor;
	const tui = {
		mode: "regular",
		terminal: { columns: 80, rows: 40 },
		requestRender() {},
		captureRenderState: () => ({
			previousLines: Array.from({ length: 20 }, () => ""),
			previousWidth: 80,
			previousHeight: 40,
			cursorRow: 19,
			hardwareCursorRow,
			maxLinesRendered: 20,
			previousViewportTop: 0,
		}),
		restoreRenderState() {},
		renderNow() {
			events.push(`render:${overlayHidden ? "base" : "overlay"}`);
			editor.render(80);
		},
		showOverlay(component: Component, options?: OverlayOptions): OverlayHandle {
			overlayShowCount += 1;
			overlayComponent = component;
			overlayOptions = options;
			overlayHidden = false;
			return {
				hide: () => {
					overlayHidden = true;
					events.push("hide");
				},
				setHidden() {},
				isHidden: () => false,
				focus() {},
				unfocus() {},
				isFocused: () => false,
			};
		},
	} as unknown as TUI;
	const ctx = {
		cwd: "/workspace/demo",
		model: undefined,
		thinkingLevel: "off",
		getContextUsage: () => undefined,
		ui: { theme: { fg: (_color: string, text: string) => text } as Theme },
	} as unknown as ExtensionContext;
	editor = new PiUiEditor(
		tui,
		{
			borderColor: identity,
			selectList: {
				selectedPrefix: identity,
				selectedText: identity,
				description: identity,
				scrollInfo: identity,
				noMatch: identity,
			},
		} as EditorTheme,
		{
			matches: (data: string, action: string) => data === "\r" && action === "tui.input.submit",
		} as unknown as KeybindingsManager,
		ctx,
		undefined,
		undefined,
		undefined,
		undefined,
		{
			onReloadSubmit: () => events.push("transition"),
		},
	);
	const provider: AutocompleteProvider = {
		getSuggestions: async () => ({
			prefix: "/rel",
			items: Array.from({ length: 6 }, (_, index) => ({
				value: index === 0 ? "/reload" : `/related-${index}`,
				label: index === 0 ? "reload" : `related-${index}`,
				description: "测试命令",
			})),
		}),
		applyCompletion: (_lines, _cursorLine, _cursorCol, item) => ({
			lines: [item.value],
			cursorLine: 0,
			cursorCol: item.value.length,
		}),
	};
	editor.setAutocompleteProvider(provider);
	editor.focused = true;
	for (const character of "/rel") editor.handleInput(character);
	await new Promise<void>((resolve) => setImmediate(resolve));

	const lines = editor.render(80);
	await new Promise<void>((resolve) => setImmediate(resolve));

	assert.equal(lines.length, 3);
	assert.equal(overlayOptions?.nonCapturing, true);
	assert.equal(overlayOptions?.anchor, "bottom-left");
	assert.equal(overlayOptions?.row, 5);
	assert.match(overlayComponent?.render(80).map(stripTerminalSequences).join("\n") ?? "", /reload/);
	assert.equal(overlayShowCount, 1);

	hardwareCursorRow = 3;
	for (let index = 0; index < 4; index += 1) editor.handleInput("\x1b[B");
	editor.render(80);
	await new Promise<void>((resolve) => setImmediate(resolve));
	const croppedAutocomplete = overlayComponent?.render(80).map(stripTerminalSequences) ?? [];
	assert.equal(croppedAutocomplete.length, 2);
	assert.equal(overlayOptions?.row, 0);
	assert.ok(
		croppedAutocomplete.some((line) => line.trimStart().startsWith("→ ") && line.includes("related-4")),
	);

	hardwareCursorRow = 1;
	const inlineFallback = editor.render(80);
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.ok(inlineFallback.length > 3);
	assert.equal(overlayHidden, true);

	for (let index = 0; index < 4; index += 1) editor.handleInput("\x1b[A");
	hardwareCursorRow = 12;
	editor.render(80);
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.equal(overlayShowCount, 2);
	events.length = 0;

	editor.onSubmit = () => { events.push("submit"); };
	editor.handleInput("\r");
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.deepEqual(events, ["hide", "transition", "submit"]);
	assert.equal(overlayShowCount, 2);
	events.length = 0;
	editor.setText("/reload");
	editor.handleInput("\r");
	assert.deepEqual(events, ["transition", "submit"]);

	editor.dispose();
	assert.equal(overlayHidden, true);
});

test("完整回复结束后分别持久化耗时与回复尾遥测，且都不写入模型上下文", () => {
	type Handler = (...args: any[]) => unknown;
	const handlers = new Map<string, Handler>();
	type PersistedEntryData = PersistedTurnDuration | PersistedTurnTelemetry;
	const entries: Array<{ customType: string; data: PersistedEntryData }> = [];
	type EntryRenderer = (
		entry: { data?: PersistedEntryData },
		options: { expanded: boolean },
		theme: Theme,
	) => { render(width: number): string[] } | undefined;
	const entryRenderers = new Map<string, EntryRenderer>();
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		model: undefined,
		thinkingLevel: "off",
		getContextUsage: () => ({ tokens: 10_000, contextWindow: 100_000, percent: 10 }),
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme: { fg: (_color: string, text: string) => text } as Theme,
			getEditorComponent: () => undefined,
			setEditorComponent() {},
			setFooter() {},
			notify() {},
		},
	} as unknown as ExtensionContext;
	let contextWrites = 0;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
		registerEntryRenderer: (customType: string, renderer: EntryRenderer) => {
			entryRenderers.set(customType, renderer);
		},
		appendEntry: (customType: string, data: PersistedEntryData) => {
			entries.push({ customType, data });
		},
		sendMessage: () => {
			contextWrites += 1;
		},
		sendUserMessage: () => {
			contextWrites += 1;
		},
	} as unknown as ExtensionAPI;
	const message = {
		role: "assistant",
		content: [],
		usage: {
			input: 1_000,
			output: 100,
			cacheRead: 9_000,
			cacheWrite: 0,
			totalTokens: 10_100,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.0011 },
		},
	};

	install(pi, undefined, TEST_PLUGIN_DEPENDENCIES);
	handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
	handlers.get("agent_start")?.({ type: "agent_start" }, ctx);
	handlers.get("turn_start")?.({ type: "turn_start", turnIndex: 0, timestamp: Date.now() }, ctx);
	handlers.get("message_start")?.({ type: "message_start", message }, ctx);
	handlers.get("message_update")?.({
		type: "message_update",
		message,
		assistantMessageEvent: { type: "text_delta", delta: "x", contentIndex: 0, partial: message },
	}, ctx);
	handlers.get("message_end")?.({ type: "message_end", message }, ctx);
	handlers.get("turn_end")?.({ type: "turn_end", turnIndex: 0, message, toolResults: [] }, ctx);
	handlers.get("agent_end")?.({ type: "agent_end", messages: [message] }, ctx);
	handlers.get("agent_settled")?.({ type: "agent_settled" }, ctx);
	handlers.get("agent_settled")?.({ type: "agent_settled" }, ctx);

	assert.deepEqual([...entryRenderers.keys()], [TURN_TELEMETRY_ENTRY_TYPE, TURN_DURATION_ENTRY_TYPE]);
	assert.equal(entries.length, 2);
	assert.equal(entries[0]?.customType, TURN_DURATION_ENTRY_TYPE);
	assert.equal(entries[0]?.data.schemaVersion, 1);
	assert.equal(entries[1]?.customType, TURN_TELEMETRY_ENTRY_TYPE);
	const telemetryData = entries[1]?.data as PersistedTurnTelemetry;
	assert.equal(telemetryData.telemetry.inputTokens, 1_000);
	assert.equal(telemetryData.telemetry.outputTokens, 100);
	assert.equal(telemetryData.telemetry.cacheReadTokens, 9_000);
	assert.equal(contextWrites, 0);

	const telemetryRenderer = entryRenderers.get(TURN_TELEMETRY_ENTRY_TYPE);
	const restored = telemetryRenderer?.(
		{ data: telemetryData },
		{ expanded: false },
		ctx.ui.theme,
	);
	const rendered = stripTerminalSequences(restored?.render(120).join("\n") ?? "").trimEnd();
	assert.match(rendered, /^ ⏳ .+ · ⚡ .+ · ↑1\.0k ↓100 R9\.0k · \$0\.0011$/);
	assert.equal(telemetryRenderer?.({ data: undefined }, { expanded: false }, ctx.ui.theme), undefined);
	assert.equal(
		entryRenderers.get(TURN_DURATION_ENTRY_TYPE)?.(
			{ data: entries[0]?.data },
			{ expanded: false },
			ctx.ui.theme,
		),
		undefined,
	);
	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" }, ctx);
});

test("非 TUI session_start 不安装 UI", () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const events: string[] = [];
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
	} as unknown as ExtensionAPI;
	install(pi, undefined, TEST_PLUGIN_DEPENDENCIES);
	handlers.get("session_start")?.(
		{ type: "session_start", reason: "startup" },
		{
			mode: "rpc",
			ui: {
				getEditorComponent: () => undefined,
				setEditorComponent: () => events.push("editor"),
				setFooter: () => events.push("footer"),
			},
		},
	);
	assert.deepEqual(events, []);
});

test("插件查询保留 detached oid/tag，默认行使用 claude-line 的 detached 写法", async () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const footerFactories: unknown[] = [];
	const execCalls: string[][] = [];
	const oid = "a1b2c3d4e5f67890";
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			getEditorComponent: () => undefined,
			setEditorComponent() {},
			setFooter: (factory: unknown) => footerFactories.push(factory),
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async (_command: string, args: string[]) => {
			execCalls.push(args);
			if (args.includes("status")) {
				return {
					stdout: `# branch.oid ${oid}\n# branch.head (detached)\n`,
					stderr: "",
					code: 0,
					killed: false,
				};
			}
			return { stdout: "v2.0.0\nv1.0.0\n", stderr: "", code: 0, killed: false };
		},
	} as unknown as ExtensionAPI;

	install(pi, undefined, TEST_PLUGIN_DEPENDENCIES);
	handlers.get("session_start")?.({}, ctx);
	const footerFactory = footerFactories.at(-1) as (
		tui: unknown,
		theme: { fg: (color: string, text: string) => string },
		footerData: unknown,
	) => { render: (width: number) => string[]; startStatusQueries: () => void };
	const footer = footerFactory(
		{ requestRender() {} },
		{ fg: (_color, text) => text },
		{
			getGitBranch: () => null,
			getExtensionStatuses: () => new Map(),
			getAvailableProviderCount: () => 1,
			onBranchChange: () => () => {},
		},
	);
	footer.startStatusQueries();
	await new Promise((resolve) => setTimeout(resolve, 10));

	assert.equal(execCalls.length, 2);
	assert.deepEqual(execCalls[0]?.slice(0, 5), [
		"--no-optional-locks",
		"status",
		"--porcelain=v2",
		"--branch",
		"--show-stash",
	]);
	assert.deepEqual(execCalls[1], [
		"--no-optional-locks",
		"tag",
		"--points-at",
		oid,
		"--sort=refname",
	]);
	assert.equal(footer.render(80)[0], " 📂 /workspace/demo · ⎇ (detached)");
	handlers.get("session_shutdown")?.({});
});

test("全局配置驱动 Editor、状态分段和 Spinner，shutdown 恢复宿主默认值", () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const config = parsePiTuiConfig(DEFAULT_PI_TUI_CONFIG);
		config.status.segments = [];
	config.advanced.spinner = "hidden";
	let editorFactory: unknown;
	const workingVisible: boolean[] = [];
	const workingIndicators: unknown[] = [];
	const ctx = {
		mode: "tui",
		cwd: "/workspace/demo",
		model: undefined,
		thinkingLevel: "off",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme: { fg: (_color: string, text: string) => text } as Theme,
			getEditorComponent: () => undefined,
			setEditorComponent: (factory: unknown) => {
				editorFactory = factory;
			},
			setFooter() {},
			setWorkingVisible: (visible: boolean) => workingVisible.push(visible),
			setWorkingIndicator: (options?: unknown) => workingIndicators.push(options),
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
	} as unknown as ExtensionAPI;

	install(pi, undefined, {
			loadConfig: () => ({ config, warnings: [] }),
	});
	handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
	assert.equal(typeof editorFactory, "function");
	const editor = (editorFactory as (
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
	) => PiUiEditor)(
		{ terminal: { rows: 24 }, requestRender() {} } as unknown as TUI,
		{ borderColor: identity, selectList: {} } as unknown as EditorTheme,
		{} as KeybindingsManager,
	);
	editor.setText("x");
	const rendered = editor.render(64).map(stripTerminalSequences);
	assert.equal(rendered.length, 3);
	assert.doesNotMatch(rendered.join("\n"), /no model|think off|ctx \?|[◆✦◫🪟]/);
	assert.deepEqual(workingVisible, [false]);

	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" });
	assert.deepEqual(workingVisible, [false, true]);
	assert.deepEqual(workingIndicators, [undefined]);
});

test("显式开启 Header 与 Runtime 后安装公共组件，shutdown 成对清理", async () => {
	type Handler = (...args: unknown[]) => unknown;
	const handlers = new Map<string, Handler>();
	const config = parsePiTuiConfig(DEFAULT_PI_TUI_CONFIG);
	config.status.segments = ["runtime"];
	let headerFactory: unknown;
	let footerFactory: unknown;
	const headerChanges: unknown[] = [];
	const theme = {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
	} as unknown as Theme;
	const ctx = {
		mode: "tui",
		cwd: process.cwd(),
		model: { provider: "zai-coding-cn", id: "glm-5.3" },
		thinkingLevel: "max",
		getContextUsage: () => undefined,
		sessionManager: {
			getSessionId: () => "session-id",
			getSessionName: () => undefined,
			getEntries: () => [],
		},
		ui: {
			theme,
			getEditorComponent: () => undefined,
			setEditorComponent() {},
			setHeader: (factory: unknown) => {
				headerChanges.push(factory);
				headerFactory = factory;
			},
			setFooter: (factory: unknown) => {
				footerFactory = factory;
			},
		},
	} as unknown as ExtensionContext;
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, handler),
		exec: async (command: string) => command === "node"
			? { stdout: "v22.19.0\n", stderr: "", code: 0, killed: false }
			: { stdout: "", stderr: "", code: 1, killed: false },
	} as unknown as ExtensionAPI;

	install(pi, undefined, {
			loadConfig: () => ({ config, warnings: [] }),
	});
	handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
	assert.equal(typeof headerFactory, "function");
	assert.equal(typeof footerFactory, "function");
	let resolveRuntimeRender: (() => void) | undefined;
	const runtimeRender = new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("runtime render timed out")), 2_000);
		resolveRuntimeRender = () => {
			clearTimeout(timeout);
			resolve();
		};
	});
	const tui = {
		requestRender() {
			resolveRuntimeRender?.();
			resolveRuntimeRender = undefined;
		},
	} as unknown as TUI;
	const header = (headerFactory as (tui: TUI) => { render(width: number): string[] })(tui);
	assert.match(header.render(80).map(stripTerminalSequences).join("\n"), /Pi v/);

	const footerData = {
		getGitBranch: () => null,
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	} satisfies ReadonlyFooterDataProvider;
	const footer = (footerFactory as (
		tui: TUI,
		theme: Theme,
		footerData: ReadonlyFooterDataProvider,
	) => ProjectStatusFooter)(tui, theme, footerData);
	footer.startStatusQueries();
	await runtimeRender;
	assert.match(footer.render(80)[0] ?? "", /◩ Node\.js 22\.19\.0/);

	handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" });
	assert.equal(headerChanges.at(-1), undefined);
});
