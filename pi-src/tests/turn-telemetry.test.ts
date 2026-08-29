import assert from "node:assert/strict";
import test from "node:test";
import type {
	AgentSettledEvent,
	AgentStartEvent,
	CustomEntry,
	MessageEndEvent,
	MessageStartEvent,
	MessageUpdateEvent,
	Theme,
	TurnEndEvent,
	TurnStartEvent,
} from "@earendil-works/pi-coding-agent";
import { buildSessionContext } from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences } from "@earendil-works/pi-tui";
import { resolveGlyphs } from "../renderer/icons.ts";
import {
	createTurnDurationEntryData,
	createTurnTelemetryEntryData,
	formatTurnTelemetry,
	readLatestTurnDuration,
	readTurnDurationEntryData,
	readTurnTelemetryEntryData,
	TURN_DURATION_ENTRY_TYPE,
	TURN_TELEMETRY_ENTRY_TYPE,
	TurnTelemetryTracker,
	type PersistedTurnDuration,
	type PersistedTurnTelemetry,
	type TurnTelemetrySnapshot,
} from "../status/turn-telemetry.ts";

function assistantMessage(
	input: number,
	output: number,
	totalTokens: number,
	cost: number,
	cacheRead = 0,
	cacheWrite = 0,
) {
	return {
		role: "assistant",
		content: [],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "test-model",
		usage: {
			input,
			output,
			cacheRead,
			cacheWrite,
			totalTokens,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: cost,
			},
		},
		stopReason: "stop",
		timestamp: 0,
	} as unknown as MessageStartEvent["message"];
}

function textDelta(message: MessageStartEvent["message"], delta = "x"): MessageUpdateEvent {
	return {
		type: "message_update",
		message,
		assistantMessageEvent: {
			type: "text_delta",
			contentIndex: 0,
			delta,
			partial: message,
		},
	} as MessageUpdateEvent;
}

test("完整 Agent run 聚合多轮模型调用，并从 TPS 中排除工具执行间隔", () => {
	let now = 0;
	const tracker = new TurnTelemetryTracker(() => now);
	const first = assistantMessage(1_000, 120, 1_120, 0.00112, 9_000, 1_000);
	const second = assistantMessage(2_000, 80, 2_080, 0.00208, 18_000, 2_000);

	tracker.handle({ type: "agent_start" } as AgentStartEvent);
	now = 100;
	tracker.handle({ type: "turn_start", turnIndex: 0, timestamp: now } as TurnStartEvent);
	tracker.handle({ type: "message_start", message: first } as MessageStartEvent);
	now = 600;
	tracker.handle(textDelta(first));
	now = 1_800;
	tracker.handle(textDelta(first));
	now = 3_000;
	tracker.handle(textDelta(first));
	now = 3_200;
	tracker.handle(textDelta(first));
	now = 4_100;
	tracker.handle({ type: "message_end", message: first } as MessageEndEvent);
	now = 4_200;
	tracker.handle({ type: "turn_end", turnIndex: 0, message: first, toolResults: [] } as TurnEndEvent);

	// 800ms 的工具执行间隔不应计入 generationMs。
	now = 5_000;
	tracker.handle({ type: "turn_start", turnIndex: 1, timestamp: now } as TurnStartEvent);
	tracker.handle({ type: "message_start", message: second } as MessageStartEvent);
	now = 5_500;
	tracker.handle(textDelta(second));
	now = 7_000;
	tracker.handle({ type: "message_end", message: second } as MessageEndEvent);
	now = 7_100;
	tracker.handle({ type: "turn_end", turnIndex: 1, message: second, toolResults: [] } as TurnEndEvent);
	now = 8_000;
	const snapshot = tracker.handle({ type: "agent_settled" } as AgentSettledEvent);

	assert.deepEqual({ ...snapshot, costUsd: 0.0032 }, {
		tokensPerSecond: 40,
		ttftMs: 500,
		totalMs: 8_000,
		inputTokens: 3_000,
		outputTokens: 200,
		cacheReadTokens: 27_000,
		cacheWriteTokens: 3_000,
		generationMs: 5_000,
		costUsd: 0.0032,
	});
	assert.ok(Math.abs((snapshot?.costUsd ?? 0) - 0.0032) < Number.EPSILON);
});

test("空 delta 不触发 TTFT，provider 只在结束时给 output 仍可形成统计", () => {
	let now = 0;
	const tracker = new TurnTelemetryTracker(() => now);
	const message = assistantMessage(10, 5, 15, 0);

	tracker.handle({ type: "agent_start" } as AgentStartEvent);
	tracker.handle({ type: "turn_start", turnIndex: 0, timestamp: 0 } as TurnStartEvent);
	tracker.handle({ type: "message_start", message } as MessageStartEvent);
	now = 500;
	tracker.handle(textDelta(message, ""));
	now = 2_000;
	tracker.handle({ type: "message_end", message } as MessageEndEvent);
	now = 2_100;
	tracker.handle({ type: "turn_end", turnIndex: 0, message, toolResults: [] } as TurnEndEvent);
	now = 2_200;
	const snapshot = tracker.handle({ type: "agent_settled" } as AgentSettledEvent);

	assert.equal(snapshot?.ttftMs, 2_000);
	assert.equal(snapshot?.tokensPerSecond, null);
	assert.equal(tracker.handle({ type: "agent_settled" } as AgentSettledEvent), undefined);
});

test("回复尾按延迟、速度、Token、Cache 和预估费用顺序显示且不展示 CH", () => {
	const calls: Array<[string, string]> = [];
	const theme = {
		fg: (color: string, text: string) => {
			calls.push([color, text]);
			return text;
		},
	} as unknown as Theme;
	const snapshot: TurnTelemetrySnapshot = {
		tokensPerSecond: 42.5,
		ttftMs: 1_200,
		totalMs: 29_700,
		inputTokens: 567,
		outputTokens: 1_200,
		cacheReadTokens: 29_275,
		cacheWriteTokens: 0,
		generationMs: 28_000,
		costUsd: 0.0063612,
	};

	const line = stripTerminalSequences(formatTurnTelemetry(
		snapshot,
		theme,
		resolveGlyphs("unicode", {}),
	));
	assert.equal(
		line,
		"⏳ 1.2s · ⚡ 42.5 tok/s · ↑567 ↓1.2k R29k · $0.0064",
	);
	assert.ok(calls.some(([color]) => color === "accent"));
	assert.ok(calls.some(([color]) => color === "success"));
	assert.ok(calls.some(([color]) => color === "warning"));
	assert.ok(calls.some(([color, text]) => color === "muted" && text === "↑567"));
	assert.ok(calls.some(([color, text]) => color === "muted" && text === "↓1.2k"));
	assert.ok(calls.some(([color, text]) => color === "muted" && text === "R29k"));
	assert.ok(!calls.some(([, text]) => text.startsWith("CH")));
});

test("首 Token 延迟按绿蓝黄红四档变色", () => {
	const snapshot: TurnTelemetrySnapshot = {
		tokensPerSecond: null,
		ttftMs: 0,
		totalMs: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		generationMs: 0,
		costUsd: 0,
	};
	const cases = [
		[2_999, "success"],
		[3_000, "accent"],
		[7_999, "accent"],
		[8_000, "warning"],
		[14_999, "warning"],
		[15_000, "error"],
	] as const;

	for (const [ttftMs, expectedColor] of cases) {
		const calls: Array<[string, string]> = [];
		const theme = {
			fg: (color: string, text: string) => {
				calls.push([color, text]);
				return text;
			},
		} as unknown as Theme;
		formatTurnTelemetry({ ...snapshot, ttftMs }, theme, resolveGlyphs("unicode", {}));
		assert.equal(calls[0]?.[0], expectedColor, `${ttftMs}ms`);
	}
});

test("回复尾统计条目可持久化恢复，且不会进入大模型上下文", () => {
	const snapshot: TurnTelemetrySnapshot = {
		tokensPerSecond: 42.5,
		ttftMs: 1_200,
		totalMs: 29_700,
		inputTokens: 567,
		outputTokens: 1_200,
		cacheReadTokens: 29_275,
		cacheWriteTokens: 0,
		generationMs: 28_000,
		costUsd: 0.0063612,
	};
	const data = createTurnTelemetryEntryData(snapshot);
	const entry = {
		type: "custom",
		id: "telemetry-entry",
		parentId: null,
		timestamp: "2026-08-25T00:00:00.000Z",
		customType: TURN_TELEMETRY_ENTRY_TYPE,
		data,
	} satisfies CustomEntry<PersistedTurnTelemetry>;

	assert.deepEqual(readTurnTelemetryEntryData(data), snapshot);
	const legacyTelemetry: Record<string, unknown> = { ...snapshot };
	delete legacyTelemetry.cacheReadTokens;
	delete legacyTelemetry.cacheWriteTokens;
	assert.deepEqual(readTurnTelemetryEntryData({ schemaVersion: 1, telemetry: legacyTelemetry }), {
		...snapshot,
		cacheReadTokens: null,
		cacheWriteTokens: null,
	});
	assert.deepEqual(buildSessionContext([entry], entry.id).messages, []);
	assert.equal(readTurnTelemetryEntryData({ ...data, schemaVersion: 2 }), undefined);
	assert.equal(readTurnTelemetryEntryData({
		...data,
		telemetry: { ...snapshot, totalMs: Number.NaN },
	}), undefined);
});

test("单轮耗时条目可持久化恢复，并兼容旧的回复尾遥测条目", () => {
	const telemetry = createTurnTelemetryEntryData({
		tokensPerSecond: 1,
		ttftMs: 100,
		totalMs: 29_700,
		inputTokens: 1,
		outputTokens: 1,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		generationMs: 1_000,
		costUsd: 0,
	});
	const telemetryEntry = {
		type: "custom",
		id: "telemetry-entry",
		parentId: null,
		timestamp: "2026-08-25T00:00:00.000Z",
		customType: TURN_TELEMETRY_ENTRY_TYPE,
		data: telemetry,
	} satisfies CustomEntry<PersistedTurnTelemetry>;
	const durationData = createTurnDurationEntryData(31_200);
	const durationEntry = {
		type: "custom",
		id: "duration-entry",
		parentId: telemetryEntry.id,
		timestamp: "2026-08-25T00:00:01.000Z",
		customType: TURN_DURATION_ENTRY_TYPE,
		data: durationData,
	} satisfies CustomEntry<PersistedTurnDuration>;

	assert.equal(readTurnDurationEntryData(durationData), 31_200);
	assert.equal(readLatestTurnDuration([telemetryEntry]), 29_700);
	assert.equal(readLatestTurnDuration([telemetryEntry, durationEntry]), 31_200);
	assert.deepEqual(buildSessionContext([durationEntry], durationEntry.id).messages, []);
	assert.equal(readTurnDurationEntryData({ ...durationData, elapsedMs: Number.NaN }), undefined);
});
