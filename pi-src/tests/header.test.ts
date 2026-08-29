import assert from "node:assert/strict";
import test from "node:test";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { resolveGlyphs } from "../renderer/icons.ts";
import { PiTuiHeader, renderPiTuiHeader } from "../renderer/header.ts";
import { PI_INSTALLER_LOGO_ANIMATION, type PiInstallerLogoFrame } from "../renderer/pi-installer-logo.ts";

const theme = {
	fg: (color: string, text: string) => `\u001b[3${color === "accent" ? "6" : "7"}m${text}\u001b[0m`,
	bold: (text: string) => `\u001b[1m${text}\u001b[22m`,
} as unknown as Theme;

test("Pi 横幅在常规宽度显示小号 π、版本、灰色模型行和目录", () => {
	const lines = renderPiTuiHeader({
		version: "0.84.3",
		model: "zai-coding-cn/glm-5.3",
		thinking: "max",
		cwd: String.raw`D:\iAgent\Pi-Extensions\Pi-Tui`,
	}, 80, theme, resolveGlyphs("unicode", {}));
	const plain = lines.map(stripTerminalSequences);

	assert.equal(lines.length, 4);
	assert.ok(plain.every((line) => line.startsWith(" ")));
	assert.match(plain[0] ?? "", / ██████.*Pi v0\.84\.3$/);
	assert.match(plain[1] ?? "", /██  ██.*glm-5\.3 · max/);
	assert.doesNotMatch(plain[1] ?? "", /zai-coding-cn\//);
	assert.doesNotMatch(plain[1] ?? "", /◆|✦/);
	assert.match(plain[2] ?? "", /████  ██.*D:\/iAgent\/Pi-Extensions\/Pi-Tui$/);
	assert.doesNotMatch(plain[2] ?? "", /📂/);
	assert.match(plain[3] ?? "", /██    ██.*Escape interrupt · Ctrl\+C\/Ctrl\+D clear\/exit/);
	const rightStarts = [plain[0]!.indexOf("Pi v"), plain[1]!.indexOf("glm-5.3"), plain[2]!.indexOf("D:/"), plain[3]!.indexOf("Escape")];
	assert.deepEqual(rightStarts, [rightStarts[0], rightStarts[0], rightStarts[0], rightStarts[0]]);
	assert.ok(lines.every((line) => visibleWidth(line) <= 80));
});

test("Pi 横幅右侧版本和模型与下方信息使用同一灰色层级", () => {
	const calls: Array<[string, string]> = [];
	const colorTheme = {
		fg: (color: string, text: string) => {
			calls.push([color, text]);
			return text;
		},
		bold: (text: string) => text,
	} as unknown as Theme;

	renderPiTuiHeader({
		version: "0.84.3",
		model: "zai-coding-cn/glm-5.3",
		thinking: "max",
		cwd: "/workspace/demo",
	}, 80, colorTheme, resolveGlyphs("unicode", {}));

	assert.ok(calls.some(([color, text]) => color === "border" && text === "Pi"));
	assert.ok(calls.some(([color, text]) => color === "dim" && text === " v0.84.3"));
	assert.ok(calls.some(([color, text]) => color === "dim" && text === "glm-5.3 · max"));
	assert.ok(calls.some(([color, text]) => color === "dim" && text === "/workspace/demo"));
	assert.ok(calls.some(([color, text]) => color === "dim" && text.startsWith("Escape interrupt")));
});

test("Pi 横幅右侧信息不足时向 Logo 底部锚定", () => {
	const tallLogo = Array.from({ length: 6 }, () => ["white"] as const) as PiInstallerLogoFrame;
	const plain = renderPiTuiHeader({
		version: "0.84.3",
		model: "glm-5.3",
		thinking: "max",
		cwd: "/workspace/demo",
	}, 80, theme, resolveGlyphs("unicode", {}), tallLogo).map(stripTerminalSequences);

	assert.doesNotMatch(plain[0] ?? "", /Pi v/);
	assert.doesNotMatch(plain[1] ?? "", /glm-5\.3/);
	assert.match(plain[2] ?? "", /Pi v0\.84\.3/);
	assert.match(plain[5] ?? "", /Escape interrupt/);
});

test("Pi 横幅组件使用官方安装器的完整方块动画并能停止动画", () => {
	const header = new PiTuiHeader(
		() => ({
			version: "0.84.3",
			model: "zai-coding-cn/glm-5.3",
			thinking: "max",
			cwd: "/workspace/demo",
		}),
		() => theme,
		() => resolveGlyphs("unicode", {}),
		() => {},
	);
	assert.equal(PI_INSTALLER_LOGO_ANIMATION.length, 21);
	assert.equal(PI_INSTALLER_LOGO_ANIMATION[0]?.durationMs, 75);
	assert.ok(stripTerminalSequences(header.render(80).join("\n")).includes("█"));
	header.dispose();
});

test("Pi 横幅在窄屏退化为单行且不越界", () => {
	for (const width of [8, 16, 24, 31]) {
		const lines = renderPiTuiHeader({
			version: "0.84.3",
			model: "provider/a-very-long-model-name",
			thinking: "high",
			cwd: "/a/very/long/project/path",
		}, width, theme, resolveGlyphs("ascii", {}));
		assert.equal(lines.length, 1);
		assert.ok(visibleWidth(lines[0] ?? "") <= width);
	}
});
