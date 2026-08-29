import assert from "node:assert/strict";
import test from "node:test";
import type {
	ExtensionContext,
	SessionEntry,
	Theme,
} from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { resolveGlyphs } from "../renderer/icons.ts";
import {
	buildEditorUsageSegments,
	collectSessionStatus,
	formatTokenCount,
	renderSessionStatusLine,
	type SessionStatusSnapshot,
} from "../status/session-status.ts";

function usage(
	input: number,
	output: number,
	cacheRead: number,
	cacheWrite: number,
	cost: number,
) {
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		cost: { total: cost },
	};
}

function makeSessionManager(
	entries: SessionEntry[],
	branchEntries: SessionEntry[] = entries,
): ExtensionContext["sessionManager"] {
	return {
		getSessionId: () => "12345678-90ab-cdef-1234-567890abcdef",
		getSessionName: () => "主线\x1b[31m\n开发\x1b[39m",
		getEntries: () => entries,
		getBranch: () => branchEntries,
	} as ExtensionContext["sessionManager"];
}

const fullSnapshot: SessionStatusSnapshot = {
	sessionId: "12345678-90ab-cdef-1234-567890abcdef",
	sessionName: "主线开发",
	inputTokens: 12_345,
	outputTokens: 678,
	cacheReadTokens: 8_000,
	cacheWriteTokens: 2_000,
	cacheHitPercent: 80,
	cost: 0.125,
	turns: 1,
	compactions: 2,
};

test("上下文遥测尚未建立时使用模型窗口显示稳定零值", () => {
	const theme = { fg: (_color: string, text: string) => text } as Theme;
	const segments = buildEditorUsageSegments({
		sessionId: "new-session",
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cost: 0,
		turns: 0,
		compactions: 0,
	}, undefined, 1_000_000, theme, resolveGlyphs("unicode", {}), ["tokens", "cache", "context"]);

	assert.deepEqual(segments.map((segment) => segment.text), ["↑0 ↓0 R0k · CH0%", "🪟 0k/1M", "📦 Off"]);
});

test("会话轮数显示在 Context 前，压缩状态合并展示", () => {
	const theme = { fg: (_color: string, text: string) => text } as Theme;
	const enabled = buildEditorUsageSegments(
		fullSnapshot,
		{ tokens: 59_000, contextWindow: 1_000_000, percent: 5.9 },
		1_000_000,
		theme,
		resolveGlyphs("unicode", {}),
		["context"],
		true,
	);
	const disabled = buildEditorUsageSegments(
		fullSnapshot,
		{ tokens: 59_000, contextWindow: 1_000_000, percent: 5.9 },
		1_000_000,
		theme,
		resolveGlyphs("unicode", {}),
		["context"],
		false,
	);

	assert.deepEqual(enabled.map((segment) => segment.text), ["💬 T1", "🪟 59k/1M", "📦 Auto（C2）"]);
	assert.deepEqual(enabled.map((segment) => segment.priority), [6, 0, 5]);
	assert.deepEqual(disabled.map((segment) => segment.text), ["💬 T1", "🪟 59k/1M", "📦 Off（C2）"]);

	const countsWithoutAuto = buildEditorUsageSegments(
		fullSnapshot,
		{ tokens: 59_000, contextWindow: 1_000_000, percent: 5.9 },
		1_000_000,
		theme,
		resolveGlyphs("unicode", {}),
		["tokens", "cache", "context"],
		false,
	);
	assert.deepEqual(
		countsWithoutAuto.map((segment) => segment.text),
		["↑12k ↓678 R8.0k · CH80%", "💬 T1", "🪟 59k/1M", "📦 Off（C2）"],
	);
});

test("统计组内 ↑↓ R 默认灰色，仅命中率 CH 保留档位色", () => {
	const calls: Array<[string, string]> = [];
	const theme = {
		fg: (color: string, text: string) => {
			calls.push([color, text]);
			return text;
		},
	} as unknown as Theme;
	const base: SessionStatusSnapshot = {
		sessionId: "session-id",
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cost: 0,
		turns: 0,
		compactions: 0,
	};

	buildEditorUsageSegments(base, undefined, 1_000_000, theme, resolveGlyphs("unicode", {}), ["cache"]);
	buildEditorUsageSegments({ ...base, cacheHitPercent: 80, cacheReadTokens: 8_000 }, undefined, 1_000_000, theme, resolveGlyphs("unicode", {}), ["cache"]);
	buildEditorUsageSegments(base, { tokens: 600_000, contextWindow: 1_000_000, percent: 60 }, 1_000_000, theme, resolveGlyphs("unicode", {}), ["context"]);

	assert.ok(calls.some(([color, text]) => color === "muted" && text === "R0k"));
	assert.ok(calls.some(([color, text]) => color === "muted" && text === "CH0%"));
	assert.ok(calls.some(([color, text]) => color === "muted" && text === "R8.0k"));
	assert.ok(calls.some(([color, text]) => color === "accent" && text === "CH80%"));
	assert.ok(calls.some(([color, text]) => color === "muted" && text === "🪟 0k/1M"));
	assert.ok(calls.some(([color, text]) => color === "warning" && text === "🪟 600k/1M"));
	assert.ok(!calls.some(([color, text]) => color === "accent" && /^↑|^↓/.test(text)));
	assert.ok(!calls.some(([color, text]) => color === "success" && /^↓/.test(text)));
});

test("会话遥测累计全部计费条目，Cache 命中率取最新 assistant", () => {
	const entries = [
		{
			type: "message",
			message: { role: "assistant", content: [], usage: usage(100, 20, 300, 100, 0.1) },
		},
		{
			type: "message",
			message: { role: "toolResult", usage: usage(10, 5, 0, 0, 0.01) },
		},
		{ type: "compaction", usage: usage(20, 10, 30, 40, 0.02) },
		{ type: "branch_summary", usage: usage(5, 2, 3, 4, 0.005) },
		{
			type: "message",
			message: { role: "assistant", content: [], usage: usage(200, 30, 0, 500, 0.2) },
		},
		{ type: "message", message: { role: "user", content: "继续" } },
	] as SessionEntry[];

	assert.deepEqual(collectSessionStatus(makeSessionManager(entries)), {
		sessionId: "12345678-90ab-cdef-1234-567890abcdef",
		sessionName: "主线 开发",
		inputTokens: 335,
		outputTokens: 67,
		cacheReadTokens: 333,
		cacheWriteTokens: 644,
		cacheHitPercent: 0,
		cost: 0.335,
		turns: 1,
		compactions: 1,
	});
});

test("轮数和压缩次数只统计当前会话分支", () => {
	const allEntries = [
		{ type: "message", message: { role: "user", content: "旧分支" } },
		{ type: "compaction", summary: "旧分支摘要" },
	] as SessionEntry[];
	const branchEntries = [
		{ type: "message", message: { role: "user", content: "当前问题" } },
		{ type: "message", message: { role: "assistant", content: [] } },
		{ type: "compaction", summary: "当前摘要" },
	] as SessionEntry[];

	const snapshot = collectSessionStatus(makeSessionManager(allEntries, branchEntries));
	assert.equal(snapshot.turns, 1);
	assert.equal(snapshot.compactions, 1);
});

test("Token 数量沿用 Pi 原生 Footer 的紧凑格式", () => {
	assert.equal(formatTokenCount(999), "999");
	assert.equal(formatTokenCount(1_000), "1.0k");
	assert.equal(formatTokenCount(9_999), "10.0k");
	assert.equal(formatTokenCount(10_000), "10k");
	assert.equal(formatTokenCount(999_999), "1000k");
	assert.equal(formatTokenCount(1_000_000), "1.0M");
	assert.equal(formatTokenCount(10_000_000), "10M");
});

test("完整遥测行按配置顺序展示 Session、Token、Cache 和费用", () => {
	const theme = { fg: (_color: string, text: string) => text } as Theme;
	const line = renderSessionStatusLine(
		fullSnapshot,
		160,
		theme,
		resolveGlyphs("unicode", {}),
		["session", "tokens", "cache", "cost"],
	);

	assert.equal(
		line,
		"● 主线开发 · ↑ 12k ↓ 678 · ↻ R8.0k W2.0k CH80.0% · ¤ $0.125",
	);
});

test("遥测缺失或为零时不显示伪造的 Token、Cache 和费用", () => {
	const theme = { fg: (_color: string, text: string) => text } as Theme;
	assert.equal(
		renderSessionStatusLine(
			{
				sessionId: "",
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				cost: 0,
				turns: 0,
				compactions: 0,
			},
			80,
			theme,
			resolveGlyphs("unicode", {}),
			["session", "tokens", "cache", "cost"],
		),
		"",
	);
});

test("ASCII 遥测行不重复美元符号且不残留 Unicode glyph", () => {
	const theme = { fg: (_color: string, text: string) => text } as Theme;
	const line = renderSessionStatusLine(
		fullSnapshot,
		160,
		theme,
		resolveGlyphs("ascii", {}),
		["session", "tokens", "cache", "cost"],
	);

	assert.equal(
		line,
		"session 主线开发 · in 12k out 678 · cache R8.0k W2.0k CH80.0% · $0.125",
	);
	assert.doesNotMatch(line, /\$ \$/);
});

test("ANSI 语义色和宽度降级在 24 至 160 列内保持单行", () => {
	const colors: string[] = [];
	const theme = {
		fg: (color: string, text: string) => {
			colors.push(color);
			return `\x1b[35m${text}\x1b[39m`;
		},
	} as Theme;

	for (const width of [24, 48, 64, 80, 120, 160]) {
		const line = renderSessionStatusLine(
			fullSnapshot,
			width,
			theme,
			resolveGlyphs("unicode", {}),
			["session", "tokens", "cache", "cost"],
		);
		assert.ok(visibleWidth(line) <= width, `width=${width}`);
		assert.doesNotMatch(stripTerminalSequences(line), /\r|\n/);
	}
	assert.ok(colors.includes("accent"));
	assert.ok(colors.includes("success"));
	assert.ok(colors.includes("muted"));
	assert.ok(colors.includes("warning"));
});
