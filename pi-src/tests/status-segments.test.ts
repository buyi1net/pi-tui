import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import {
	cacheHitStatusColor,
	compactionStatusColor,
	contextUsageStatusColor,
	durationStatusColor,
	formatElapsed,
	layoutEditorStatus,
	thinkingStatusColor,
	turnStatusColor,
	TurnTimerController,
	type StatusSegment,
} from "../status/status-segments.ts";

const leftSegments: StatusSegment[] = [
	{
		id: "model",
		text: "◆ provider/model",
		compactText: "◆ model",
		priority: 0,
		required: true,
	},
	{ id: "thinking", text: "✦ max", priority: 2 },
	{ id: "duration", text: "◷ 12s", priority: 1 },
];

const rightSegments: StatusSegment[] = [
	{
		id: "context",
		text: "◫ 42%/128k",
		compactText: "◫ 42%",
		priority: 0,
		required: true,
	},
];

test("宽屏显示完整状态，中等宽度按优先级隐藏并压缩", () => {
	assert.deepEqual(layoutEditorStatus(leftSegments, rightSegments, 80), {
		left: "◆ provider/model · ✦ max · ◷ 12s",
		right: "◫ 42%/128k",
	});
	assert.deepEqual(layoutEditorStatus(leftSegments, rightSegments, 34), {
		left: "◆ model",
		right: "◫ 42%/128k",
	});
	assert.deepEqual(layoutEditorStatus(leftSegments, rightSegments, 28), {
		left: "◆ model",
		right: "◫ 42%",
	});
});

test("极窄顶边只保留必需段并截断到外框预算内", () => {
	const layout = layoutEditorStatus(leftSegments, rightSegments, 20);
	const contentWidth = visibleWidth(layout.left) + visibleWidth(layout.right) + 1;

	assert.ok(contentWidth <= 20 - 11);
	assert.doesNotMatch(layout.left, /max|12s/);
	assert.ok(layout.left.length > 0);
	assert.ok(layout.right.length > 0);
});

test("耗时格式在秒、分钟和小时边界保持紧凑", () => {
	assert.equal(formatElapsed(0), "0s");
	assert.equal(formatElapsed(59_999), "59s");
	assert.equal(formatElapsed(60_000), "1m 00s");
	assert.equal(formatElapsed(3_661_000), "1h 01m");
});

test("Thinking 等级使用 Pi 主题对应的专用语义色", () => {
	assert.deepEqual(
		["off", "minimal", "low", "medium", "high", "xhigh", "max"].map(thinkingStatusColor),
		[
			"thinkingOff",
			"thinkingMinimal",
			"thinkingLow",
			"thinkingMedium",
			"thinkingHigh",
			"thinkingXhigh",
			"thinkingMax",
		],
	);
	assert.equal(thinkingStatusColor("unknown"), "thinkingOff");
});

test("Cache 命中率按未就绪、红黄蓝绿五种状态变色", () => {
	assert.equal(cacheHitStatusColor(undefined), "muted");
	assert.equal(cacheHitStatusColor(null), "muted");
	assert.equal(cacheHitStatusColor(-1), "muted");
	assert.equal(cacheHitStatusColor(0), "error");
	assert.equal(cacheHitStatusColor(29.9), "error");
	assert.equal(cacheHitStatusColor(30), "warning");
	assert.equal(cacheHitStatusColor(69.9), "warning");
	assert.equal(cacheHitStatusColor(70), "accent");
	assert.equal(cacheHitStatusColor(89.9), "accent");
	assert.equal(cacheHitStatusColor(90), "success");
	assert.equal(cacheHitStatusColor(100), "success");
});

test("上下文使用率按灰绿蓝黄红五档分色", () => {
	assert.equal(contextUsageStatusColor(undefined), "muted");
	assert.equal(contextUsageStatusColor(null), "muted");
	assert.equal(contextUsageStatusColor(0), "muted");
	assert.equal(contextUsageStatusColor(0.1), "success");
	assert.equal(contextUsageStatusColor(10), "success");
	assert.equal(contextUsageStatusColor(10.1), "accent");
	assert.equal(contextUsageStatusColor(30), "accent");
	assert.equal(contextUsageStatusColor(30.1), "warning");
	assert.equal(contextUsageStatusColor(60), "warning");
	assert.equal(contextUsageStatusColor(60.1), "error");
	assert.equal(contextUsageStatusColor(100), "error");
});

test("会话轮数按 1-10 灰、11-20 绿、21-39 黄、40+ 红分档", () => {
	assert.equal(turnStatusColor(0), "muted");
	assert.equal(turnStatusColor(10), "muted");
	assert.equal(turnStatusColor(11), "success");
	assert.equal(turnStatusColor(20), "success");
	assert.equal(turnStatusColor(21), "warning");
	assert.equal(turnStatusColor(39), "warning");
	assert.equal(turnStatusColor(40), "error");
	assert.equal(turnStatusColor(100), "error");
});

test("压缩次数按 0-1 灰、2-3 黄、4+ 红分档", () => {
	assert.equal(compactionStatusColor(0), "muted");
	assert.equal(compactionStatusColor(1), "muted");
	assert.equal(compactionStatusColor(2), "warning");
	assert.equal(compactionStatusColor(3), "warning");
	assert.equal(compactionStatusColor(4), "error");
	assert.equal(compactionStatusColor(10), "error");
});

test("耗时按工作状态使用强调色和完成色", () => {
	assert.equal(durationStatusColor("idle"), "dim");
	assert.equal(durationStatusColor("working"), "accent");
	assert.equal(durationStatusColor("done"), "success");
});

test("计时开始后定时重绘，结束冻结，销毁后不再触发", async () => {
	let now = 1_000;
	let renderCount = 0;
	const timer = new TurnTimerController(() => {
		renderCount += 1;
	}, 8, () => now);

	try {
		assert.deepEqual(timer.getSnapshot(), { state: "idle", elapsedMs: 0 });
		timer.start();
		assert.deepEqual(timer.getSnapshot(), { state: "working", elapsedMs: 0 });
		assert.equal(renderCount, 1);

		now = 3_500;
		await new Promise((resolve) => setTimeout(resolve, 18));
		assert.ok(renderCount >= 2);
		assert.deepEqual(timer.getSnapshot(), { state: "working", elapsedMs: 2_500 });

		timer.end();
		assert.deepEqual(timer.getSnapshot(), { state: "done", elapsedMs: 2_500 });
		const frozenRenderCount = renderCount;
		now = 9_000;
		await new Promise((resolve) => setTimeout(resolve, 18));
		assert.equal(renderCount, frozenRenderCount);
		assert.deepEqual(timer.getSnapshot(), { state: "done", elapsedMs: 2_500 });

		timer.start();
		assert.deepEqual(timer.getSnapshot(), { state: "working", elapsedMs: 0 });
		timer.dispose();
		const disposedRenderCount = renderCount;
		await new Promise((resolve) => setTimeout(resolve, 18));
		assert.equal(renderCount, disposedRenderCount);
	} finally {
		timer.dispose();
	}
});

test("计时器可从会话记录恢复冻结值，下一轮开始时重新计时", () => {
	let now = 10_000;
	const timer = new TurnTimerController(() => {}, 1_000, () => now, 65_000);
	try {
		assert.deepEqual(timer.getSnapshot(), { state: "done", elapsedMs: 65_000 });
		timer.restore(72_000);
		assert.deepEqual(timer.getSnapshot(), { state: "done", elapsedMs: 72_000 });
		timer.start();
		now = 12_500;
		assert.deepEqual(timer.getSnapshot(), { state: "working", elapsedMs: 2_500 });
	} finally {
		timer.dispose();
	}
});
