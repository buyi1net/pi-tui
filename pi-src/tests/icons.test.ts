import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import {
	resolveGlyphs,
	resolveIconMode,
} from "../renderer/icons.ts";

test("显式图标模式不受终端环境猜测影响", () => {
	const env = {
		PI_UI_NERD_FONT: "1",
		TERM: "dumb",
	};
	assert.equal(resolveIconMode("nerd", env), "nerd");
	assert.equal(resolveIconMode("unicode", env), "unicode");
	assert.equal(resolveIconMode("ascii", env), "ascii");
});

test("产品图标在 UTF-8 终端固定为 Unicode，非 Unicode locale 才自动降级", () => {
	assert.equal(resolveIconMode("auto", { PI_UI_NERD_FONT: "1" }), "unicode");
	assert.equal(resolveIconMode("auto", { PI_UI_ICON_MODE: "nerd" }), "unicode");
	assert.equal(resolveIconMode("auto", { TERM: "dumb", LANG: "zh_CN.UTF-8" }), "unicode");
	assert.equal(resolveIconMode("auto", { LANG: "C" }), "ascii");
	assert.equal(resolveIconMode("auto", { TERM_PROGRAM: "WindowsTerminal" }), "unicode");
	assert.equal(resolveIconMode("auto", { LANG: "zh_CN.UTF-8" }), "unicode");
});

test("三套 glyph 使用同一语义键，ASCII 集合只含可打印 ASCII", () => {
	const nerd = resolveGlyphs("nerd", {});
	const unicode = resolveGlyphs("unicode", {});
	const ascii = resolveGlyphs("ascii", {});
	assert.deepEqual(Object.keys(nerd), Object.keys(unicode));
	assert.deepEqual(Object.keys(ascii), Object.keys(unicode));
	assert.ok(Object.values(nerd).every(Boolean));
	assert.ok(Object.values(unicode).every(Boolean));
	assert.ok(Object.values(ascii).every((glyph) => /^[\x20-\x7e]+$/.test(glyph)));
	assert.ok(Object.isFrozen(nerd));
	assert.ok(Object.isFrozen(unicode));
	assert.ok(Object.isFrozen(ascii));
});

test("默认 Unicode Git glyph 保持 claude-line 0.0.2 的既定外观", () => {
	const glyphs = resolveGlyphs("unicode", {});
	assert.deepEqual(
		{
			gitBranch: glyphs.gitBranch,
			changed: glyphs.changed,
			untracked: glyphs.untracked,
			ahead: glyphs.ahead,
			behind: glyphs.behind,
		},
		{
			gitBranch: "⎇",
			changed: "+",
			untracked: "~",
			ahead: "↑",
			behind: "↓",
		},
	);
});

test("固定产品图标统一项目、用量、首 Token 延迟与本轮耗时的产品外观", () => {
	const glyphs = resolveGlyphs("unicode", {});
	assert.equal(glyphs.project, "📂");
	assert.equal(glyphs.usage, "📶");
	assert.equal(glyphs.context, "🪟");
	assert.equal(glyphs.turns, "💬");
	assert.equal(glyphs.compaction, "📦");
	assert.equal(glyphs.latency, "⏳");
	assert.equal(glyphs.duration, "⏱️");
	assert.equal(visibleWidth(`${glyphs.project} `), 3);
	assert.equal(visibleWidth(`${glyphs.usage} `), 3);
	assert.equal(visibleWidth(glyphs.latency), 2);
	assert.equal(visibleWidth(glyphs.context), 2);
	assert.equal(visibleWidth(glyphs.duration), 2);
});
