import assert from "node:assert/strict";
import test from "node:test";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences } from "@earendil-works/pi-tui";
import type { UsageSnapshot } from "../../packages/usage-core/index.ts";
import type { UsageRuntimeState } from "../../packages/usage-node/index.ts";
import {
	buildEditorProviderSegments,
	formatResetCountdown,
} from "../status/provider-status.ts";

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as Theme;

function state(snapshot: UsageSnapshot, status: UsageRuntimeState["status"] = "ready"): UsageRuntimeState {
	return { status, provider: snapshot.provider, snapshot };
}

test("API 计费成功后生成编辑框左上角的供应商与余额段", () => {
	const api = state({
		provider: { id: "deepseek", brandName: "DeepSeek" },
		billingMode: "api",
		balance: { amount: 32.4, currency: "CNY" },
		windows: [],
		fetchedAt: 1,
		freshness: "fresh",
	});

	assert.equal(stripTerminalSequences(buildEditorProviderSegments(api, theme)?.provider.text ?? ""), "DeepSeek");
	assert.equal(buildEditorProviderSegments(api, theme)?.balance?.text, "¥32.40");
	assert.equal(buildEditorProviderSegments(api, theme)?.subscription, null);
});

test("订阅计费只生成额度窗口行，不伪造余额", () => {
	const subscription = state({
		provider: { id: "zhipu", brandName: "Zhipu" },
		billingMode: "subscription",
		balance: null,
		windows: [
			{ label: "5h", remainingPercent: 83, resetMs: 7_261_000 },
			{ label: "7d", remainingPercent: 59, resetMs: null },
		],
		fetchedAt: 1,
		freshness: "fresh",
	});

	assert.equal(stripTerminalSequences(buildEditorProviderSegments(subscription, theme)?.provider.text ?? ""), "Zhipu");
	assert.equal(buildEditorProviderSegments(subscription, theme)?.balance, null);
	const segment = buildEditorProviderSegments(subscription, theme, 1_000)?.subscription;
	assert.equal(stripTerminalSequences(segment?.text ?? ""), "5h 83% 2h1m · 7d 59%");
	assert.equal(stripTerminalSequences(segment?.compactText ?? ""), "5h 83% · 7d 59%");
});

test("订阅窗口整组按剩余额度使用绿蓝黄红四档颜色，百分比保持加粗", () => {
	const colorCalls: Array<{ color: string; text: string }> = [];
	const boldCalls: string[] = [];
	const recordingTheme = {
		fg: (color: string, text: string) => {
			colorCalls.push({ color, text });
			return text;
		},
		bold: (text: string) => {
			boldCalls.push(text);
			return text;
		},
	} as Theme;
	const subscription = state({
		provider: { id: "zhipu", brandName: "Zhipu" },
		billingMode: "subscription",
		balance: null,
		windows: [
			{ label: "5h", remainingPercent: 60, resetMs: null },
			{ label: "7d", remainingPercent: 31, resetMs: null },
			{ label: "1d", remainingPercent: 30, resetMs: null },
			{ label: "1h", remainingPercent: 10, resetMs: null },
		],
		fetchedAt: 1,
		freshness: "fresh",
	});

	assert.equal(
		stripTerminalSequences(buildEditorProviderSegments(subscription, recordingTheme, 1)?.subscription?.text ?? ""),
		"5h 60% · 7d 31% · 1d 30% · 1h 10%",
	);
	assert.deepEqual(
		// text 与 compactText 各渲染一遍窗口，颜色记录翻倍；断言前四个即 text 版
		colorCalls.filter(({ text }) => /^(?:5h|7d|1d|1h) \d+%$/.test(text)).slice(0, 4),
		[
			{ color: "success", text: "5h 60%" },
			{ color: "accent", text: "7d 31%" },
			{ color: "warning", text: "1d 30%" },
			{ color: "error", text: "1h 10%" },
		],
	);
	assert.deepEqual(boldCalls.slice(0, 4), ["60%", "31%", "30%", "10%"]);
	assert.ok(colorCalls.some(({ color, text }) => color === "muted" && text === " · "));
});

test("混合计费同时生成独立余额段和订阅窗口", () => {
	const hybrid = state({
		provider: { id: "apikey.fun", brandName: "ApiKey" },
		billingMode: "hybrid",
		balance: { amount: 8.5, currency: "USD" },
		windows: [{ label: "1d", remainingPercent: 25, resetMs: null }],
		fetchedAt: 1,
		freshness: "fresh",
	});

	assert.equal(stripTerminalSequences(buildEditorProviderSegments(hybrid, theme)?.provider.text ?? ""), "ApiKey");
	assert.equal(buildEditorProviderSegments(hybrid, theme)?.balance?.text, "$8.50");
	assert.equal(
		stripTerminalSequences(buildEditorProviderSegments(hybrid, theme)?.subscription?.text ?? ""),
		"1d 25%",
	);
});

test("旧快照不进入界面，订阅段窄屏紧凑形态去掉重置时间", () => {
	const stale = state({
		provider: { id: "zhipu", brandName: "Zhipu" },
		billingMode: "subscription",
		balance: null,
		windows: [{ label: "5h", remainingPercent: 83, resetMs: 7_261_000 }],
		fetchedAt: 1,
		freshness: "stale",
	}, "stale");

	assert.equal(buildEditorProviderSegments(stale, theme), null);

	const ready = state({ ...stale.snapshot!, freshness: "fresh" });
	const segment = buildEditorProviderSegments(ready, theme, 1_000)?.subscription;
	assert.equal(stripTerminalSequences(segment?.text ?? ""), "5h 83% 2h1m");
	assert.equal(stripTerminalSequences(segment?.compactText ?? ""), "5h 83%");
});

test("重置倒计时按分钟、小时和天压缩", () => {
	assert.equal(formatResetCountdown(null, 0), "");
	assert.equal(formatResetCountdown(30_000, 0), "1m");
	assert.equal(formatResetCountdown(7_260_000, 0), "2h1m");
	assert.equal(formatResetCountdown(176_400_000, 0), "2d1h");
});

test("查询中、失败和不支持时不占位，成功品牌名不能注入终端控制序列", () => {
	const loading: UsageRuntimeState = {
		status: "loading",
		provider: { id: "relay", brandName: "Relay\u001b[2J\nInjected" },
		snapshot: null,
	};
	assert.equal(buildEditorProviderSegments(loading, theme), null);
	assert.equal(buildEditorProviderSegments({ ...loading, status: "error" }, theme), null);
	assert.equal(buildEditorProviderSegments({ ...loading, status: "unsupported" }, theme), null);

	const ready = state({
		provider: loading.provider!,
		billingMode: "hybrid",
		balance: { amount: 1, currency: "USD" },
		windows: [{ label: "7d", remainingPercent: 87, resetMs: null }],
		fetchedAt: 1,
		freshness: "fresh",
	});
	const text = buildEditorProviderSegments(ready, theme)?.provider.text ?? "";
	assert.equal(stripTerminalSequences(text), "Relay Injected");
	assert.doesNotMatch(stripTerminalSequences(text), /\u001b|\n/);
	assert.doesNotMatch(stripTerminalSequences(text), /\[2J/);
	assert.equal(
		stripTerminalSequences(buildEditorProviderSegments(ready, theme)?.subscription?.text ?? ""),
		"7d 87%",
	);
});

test("Pi 渲染旧快照时仍清理并限制额度窗口标签", () => {
	const ready = state({
		provider: { id: "relay", brandName: "Relay" },
		billingMode: "subscription",
		balance: null,
		windows: [{
			label: "5h\u001b[2J\nInjected-abcdefghijklmnopqrstuvwxyz",
			remainingPercent: 80,
			resetMs: null,
		}],
		fetchedAt: 1,
		freshness: "fresh",
	});

	const segment = buildEditorProviderSegments(ready, theme, 1_000)?.subscription;
	const line = stripTerminalSequences(segment?.text ?? "");
	assert.equal(line, "5h Injected-abcdefghijkl 80%");
	assert.doesNotMatch(line, /\u001b|\r|\n|\[2J/);
});

test("编辑框供应商品牌使用独立珊瑚橙并适配深浅主题和终端色彩模式", () => {
	const snapshot: UsageSnapshot = {
		provider: { id: "deepseek", brandName: "DeepSeek" },
		billingMode: "api",
		balance: null,
		windows: [],
		fetchedAt: 1,
		freshness: "fresh",
	};
	const darkTruecolor = {
		name: "tokyo-night",
		getColorMode: () => "truecolor",
		fg: (_color: string, text: string) => text,
	} as Theme;
	const lightTruecolor = {
		name: "catppuccin-latte",
		getColorMode: () => "truecolor",
		fg: (_color: string, text: string) => text,
	} as Theme;
	const dark256 = {
		name: "tokyo-night",
		getColorMode: () => "256color",
		fg: (_color: string, text: string) => text,
	} as Theme;

	assert.equal(buildEditorProviderSegments(state(snapshot), darkTruecolor)?.provider.text, "\u001b[38;2;217;119;87mDeepSeek\u001b[39m");
	assert.equal(buildEditorProviderSegments(state(snapshot), lightTruecolor)?.provider.text, "\u001b[38;2;168;78;51mDeepSeek\u001b[39m");
	assert.equal(buildEditorProviderSegments(state(snapshot), dark256)?.provider.text, "\u001b[38;5;173mDeepSeek\u001b[39m");
});
