import assert from "node:assert/strict";
import { test } from "node:test";
import { CURSOR_MARKER, stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import {
	hasTruncatedScrollBorder,
	insertTopBorderStatus,
	splitNativeEditorRender,
} from "../renderer/editor.ts";

function padVisible(text: string, width: number): string {
	return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function borderWithLabel(width: number, label: string): string {
	const content = `─── ${label} `;
	return `${content}${"─".repeat(Math.max(0, width - visibleWidth(content)))}`;
}

function makeBaseLines(width: number, body = "hello", topBorder?: string): string[] {
	return [
		topBorder ?? "─".repeat(width),
		padVisible(body, width),
		"─".repeat(width),
	];
}

function plain(text: string): string {
	return stripTerminalSequences(text);
}

const identity = (text: string): string => text;

test("48、64、80、120 列下顶边左端嵌入状态且行宽不变", () => {
	for (const width of [48, 64, 80, 120]) {
		const lines = insertTopBorderStatus(makeBaseLines(width), {
			left: "Zhipu · glm-5.3 · max · 5h 83%",
			borderColor: identity,
		});

		assert.equal(lines.length, 3);
		assert.ok(lines.every((line) => visibleWidth(line) === width), `${width} 列存在宽度不准确的行`);
		assert.match(plain(lines[0] ?? ""), /^── Zhipu · glm-5\.3 · max · 5h 83% /);
		assert.ok(plain(lines[0] ?? "").endsWith("─"));
		assert.equal(lines[1], makeBaseLines(width)[1]);
		assert.equal(lines[2], makeBaseLines(width)[2]);
	}
});

test("顶边为滚动标签等原生动态形态时原样返回", () => {
	const top = borderWithLabel(48, "↑ 3 more");
	const lines = insertTopBorderStatus(makeBaseLines(48, "hello", top), {
		left: " model ",
		borderColor: identity,
	});

	assert.deepEqual(lines, makeBaseLines(48, "hello", top));
});

test("状态放不下时保持原生顶边，两侧至少留两列横线", () => {
	const lines = insertTopBorderStatus(makeBaseLines(20), {
		left: "Zhipu · glm-5.3 · max · 5h 83%",
		borderColor: identity,
	});

	assert.deepEqual(lines, makeBaseLines(20));
});

test("ANSI、中文和 Emoji 不破坏可见宽度", () => {
	const lines = insertTopBorderStatus(makeBaseLines(64), {
		left: "\x1b[35m 智谱 glm-5.3 🧠 \x1b[39m",
		borderColor: identity,
	});

	assert.equal(visibleWidth(lines[0] ?? ""), 64);
	assert.match(plain(lines[0] ?? ""), /智谱 glm-5\.3/);
});

test("borderColor 在每次渲染时包住两侧横线", () => {
	const calls: string[] = [];
	const lines = insertTopBorderStatus(makeBaseLines(40), {
		left: " model ",
		borderColor: (text) => {
			calls.push(text);
			return `\x1b[36m${text}\x1b[39m`;
		},
	});

	assert.equal(visibleWidth(lines[0] ?? ""), 40);
	assert.ok(calls.length >= 2);
	assert.ok(calls.every((text) => /^─+$/.test(text)));
	assert.match(lines[0] ?? "", /^\x1b\[36m──\x1b\[39m/);
});

test("空行数组与无状态文本安全返回", () => {
	assert.deepEqual(insertTopBorderStatus([], { left: " x ", borderColor: identity }), []);
	assert.deepEqual(
		insertTopBorderStatus(makeBaseLines(30), { left: "", borderColor: identity }),
		makeBaseLines(30),
	);
});

test("原生 Editor 输出可以把固定输入区与自动补全行分开", () => {
	const lines = [
		"─".repeat(30),
		padVisible("hello", 30),
		"─".repeat(30),
		padVisible("→ model", 30),
		padVisible("  models", 30),
	];

	const split = splitNativeEditorRender(lines);
	assert.equal(split.editor.length, 3);
	assert.equal(split.autocomplete.length, 2);
	assert.match(split.autocomplete[0] ?? "", /→ model/);
});

test("识别 Pi 在窄宽度下截断的滚动边框", () => {
	assert.equal(hasTruncatedScrollBorder(["──── ↑ 3 more ..."]), true);
	assert.equal(hasTruncatedScrollBorder(["──── ↑ 3 more ────"]), false);
	assert.equal(hasTruncatedScrollBorder([padVisible("text", 30)]), false);
});

test("硬件光标标记保留在内容行，插入不影响其位置", () => {
	const body = `${CURSOR_MARKER}hello`;
	const lines = insertTopBorderStatus(makeBaseLines(40, body), {
		left: " model ",
		borderColor: identity,
	});

	assert.ok((lines[1] ?? "").includes(CURSOR_MARKER));
});
