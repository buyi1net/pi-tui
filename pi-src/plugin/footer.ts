import type { ContextUsage, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import {
	truncateToWidth,
	visibleWidth,
	type Component,
	type TUI,
} from "@earendil-works/pi-tui";
import type { UsageRuntimeState } from "../../packages/usage-node/index.ts";
import { formatLeadingIcon, resolveGlyphs, type IconGlyphs } from "../renderer/icons.ts";
import {
	renderProjectStatusLine,
	sanitizeStyledSingleLine,
} from "../status/project-status.ts";
import { RuntimeStatusController } from "../status/runtime-status.ts";
import { ProjectStatusController } from "../status/project-status.ts";
import type { TurnTimerSnapshot } from "../status/status-segments.ts";
import {
	buildEditorUsageSegments,
	renderStatusLineSegments,
	type SessionStatusSnapshot,
} from "../status/session-status.ts";
import {
	resolveStatusSettings,
	type ResolvedStatusSettings,
} from "../status/status-config.ts";

const FOOTER_PADDING_X = 1;

export class ProjectStatusFooter implements Component {
	private readonly theme: Theme;
	private readonly footerData: ReadonlyFooterDataProvider;
	private readonly projectStatus: ProjectStatusController | undefined;
	private readonly cwd: string;
	private readonly beforeDispose: (() => void) | undefined;
	private readonly getGlyphs: () => IconGlyphs;
	private readonly settings: ResolvedStatusSettings;
	private readonly runtimeStatus: RuntimeStatusController | undefined;
	private readonly reportHeight: ((height: number) => void) | undefined;
	private readonly requestStatusRender: () => void;
	private readonly getTimer: () => TurnTimerSnapshot;
	private readonly getSessionStatus: () => SessionStatusSnapshot;
	private readonly getContextUsage: () => ContextUsage | undefined;
	private readonly getContextWindow: () => number | undefined;
	private readonly getAutoCompactionEnabled: () => boolean;
	private statusQueriesStarted = false;
	private disposed = false;

	constructor(
		tui: TUI,
		theme: Theme,
		footerData: ReadonlyFooterDataProvider,
		projectStatus: ProjectStatusController | undefined,
		beforeDispose?: () => void,
		getGlyphs: () => IconGlyphs = () => resolveGlyphs("unicode"),
		settings: ResolvedStatusSettings = resolveStatusSettings({}),
		runtimeStatus?: RuntimeStatusController,
		cwd = process.cwd(),
		reportHeight?: (height: number) => void,
		requestStatusRender: () => void = () => tui.requestRender(),
		getTimer: () => TurnTimerSnapshot = () => ({ state: "idle", elapsedMs: 0 }),
		getSessionStatus: () => SessionStatusSnapshot = () => ({
			sessionId: "",
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			cost: 0,
			turns: 0,
			compactions: 0,
		}),
		getContextUsage: () => ContextUsage | undefined = () => undefined,
		getContextWindow: () => number | undefined = () => undefined,
		getAutoCompactionEnabled: () => boolean = () => false,
	) {
		this.theme = theme;
		this.footerData = footerData;
		this.projectStatus = projectStatus;
		this.beforeDispose = beforeDispose;
		this.getGlyphs = getGlyphs;
		this.settings = settings;
		this.runtimeStatus = runtimeStatus;
		this.cwd = cwd;
		this.reportHeight = reportHeight;
		this.requestStatusRender = requestStatusRender;
		this.getTimer = getTimer;
		this.getSessionStatus = getSessionStatus;
		this.getContextUsage = getContextUsage;
		this.getContextWindow = getContextWindow;
		this.getAutoCompactionEnabled = getAutoCompactionEnabled;
	}

	startStatusQueries(): void {
		if (this.disposed || this.statusQueriesStarted) return;
		this.statusQueriesStarted = true;
		this.projectStatus?.connect(this.footerData, this.requestStatusRender);
		this.runtimeStatus?.connect(this.requestStatusRender);
	}

	invalidate(): void {}

	render(width: number): string[] {
		const glyphs = this.getGlyphs();
		const paddingX = width >= FOOTER_PADDING_X * 2 + 1 ? FOOTER_PADDING_X : 0;
		const contentWidth = Math.max(1, width - paddingX * 2);
		const projectLine = renderProjectStatusLine(
			{
				// 无控制器（Git 段未启用或查询未接线）时占位为待查询，
				// 保证 Footer 结构从首帧起定型。
				...(this.projectStatus?.getSnapshot()
					?? { cwd: this.cwd, branch: null, refreshState: this.projectStatus ? "idle" as const : undefined }),
				runtime: this.runtimeStatus?.getSnapshot(),
				duration: this.getTimer(),
			},
			contentWidth,
			this.theme,
			undefined,
			glyphs,
			this.settings.footerPrimary,
		);
		// 第二行：会话遥测（↑↓ R/CH ctx），行首 usage 图标作视觉锚点。
		// 上下文未就绪时不展示零值 token 段，但保留 Context、auto、轮数与压缩次数。
		const contextUsage = this.getContextUsage();
		const usageSegments = buildEditorUsageSegments(
			this.getSessionStatus(),
			contextUsage,
			this.getContextWindow(),
			this.theme,
			glyphs,
			contextUsage === undefined
				? this.settings.footerUsage.filter((segment) => segment === "context")
				: this.settings.footerUsage,
			this.getAutoCompactionEnabled(),
		);
		// 行首图标属于状态行的一部分，必须先从可用宽度中扣除；最后的截断
		// 只是防御性兜底，避免宽字符或第三方状态文本再次把整行顶出终端。
		const usageIconText = formatLeadingIcon(glyphs.usage);
		const usageIconWidth = visibleWidth(usageIconText);
		const usageSegmentsWidth = Math.max(0, contentWidth - usageIconWidth);
		const renderedUsageSegments = usageSegmentsWidth > 0
			? renderStatusLineSegments(usageSegments, usageSegmentsWidth, this.theme.fg("muted", " · "))
			: "";
		const usageLine = usageSegments.length > 0
			? truncateToWidth(
				`${this.theme.fg("muted", usageIconText)}${renderedUsageSegments}`,
				contentWidth,
			)
			: "";
		const showExtensions = this.settings.footerExtra.includes("extensions");
		const statuses = showExtensions
			? [...this.footerData.getExtensionStatuses().entries()]
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([, status]) => sanitizeStyledSingleLine(status))
				.filter(Boolean)
			: [];
		const lines = projectLine ? [projectLine] : [];
		if (usageLine) lines.push(usageLine);
		if (statuses.length > 0) {
			lines.push(truncateToWidth(statuses.join(" · "), contentWidth, this.theme.fg("dim", "…")));
		}
		this.reportHeight?.(lines.length);
		return paddingX > 0 ? lines.map((line) => `${" ".repeat(paddingX)}${line}`) : lines;
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.beforeDispose?.();
		this.reportHeight?.(0);
		this.projectStatus?.disconnect();
		this.runtimeStatus?.disconnect();
	}
}
