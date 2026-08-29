import assert from "node:assert/strict";
import test from "node:test";
import {
	readStatusPreset,
	resolveStatusSettings,
} from "../status/status-config.ts";

test("预设名称忽略大小写，非法值回到 default", () => {
	assert.equal(readStatusPreset({}), "default");
	assert.equal(readStatusPreset({ PI_UI_STATUS_PRESET: " MINIMAL " }), "minimal");
	assert.equal(readStatusPreset({ PI_UI_STATUS_PRESET: "full" }), "full");
	assert.equal(readStatusPreset({ PI_UI_STATUS_PRESET: "ascii" }), "default");
	assert.equal(readStatusPreset({ PI_UI_STATUS_PRESET: "wide" }), "default");
});

test("default 保持当前全部状态，minimal 只保留核心信息", () => {
	assert.deepEqual(resolveStatusSettings({}), {
		preset: "default",
		editorLeft: ["provider", "model", "thinking", "balance", "subscription", "duration"],
		footerUsage: ["tokens", "cache", "context"],
		footerPrimary: ["project", "git"],
		footerExtra: ["extensions"],
	});
	assert.deepEqual(resolveStatusSettings({ PI_UI_STATUS_PRESET: "minimal" }), {
		preset: "minimal",
		editorLeft: ["model"],
		footerUsage: ["context"],
		footerPrimary: ["project", "git"],
		footerExtra: [],
	});
});

test("full 在 default 通用遥测上增加 Runtime", () => {
	assert.deepEqual(resolveStatusSettings({ PI_UI_STATUS_PRESET: "full" }).footerPrimary, [
		"project",
		"git",
		"runtime",
	]);
	assert.deepEqual(resolveStatusSettings({ PI_UI_STATUS_PRESET: "full" }).footerUsage, [
		"tokens",
		"cache",
		"context",
	]);
	assert.deepEqual(resolveStatusSettings({ PI_UI_STATUS_PRESET: "full" }).editorLeft, [
		"provider",
		"model",
		"thinking",
		"balance",
		"subscription",
		"duration",
	]);
});

test("旧 ascii 预设回到固定产品图标使用的 default 布局", () => {
	assert.deepEqual(
		resolveStatusSettings({ PI_UI_STATUS_PRESET: "ascii" }),
		resolveStatusSettings({}),
	);
});

test("自定义状态列表控制开关，并在各自区域保留声明顺序", () => {
	assert.deepEqual(
		resolveStatusSettings({
			PI_UI_STATUS_SEGMENTS:
				"duration,balance,model,context,git,runtime,project,cost,tokens,session,cache,provider,extensions,model,unknown",
		}),
		{
			preset: "default",
			editorLeft: ["duration", "balance", "model", "provider"],
			footerPrimary: ["git", "runtime", "project"],
			footerUsage: ["context", "tokens", "cache"],
			footerExtra: ["extensions"],
		},
	);
});

test("空白或完全无效的自定义列表安全回退到所选预设", () => {
	const minimal = resolveStatusSettings({
		PI_UI_STATUS_PRESET: "minimal",
		PI_UI_STATUS_SEGMENTS: " , ",
	});
	assert.deepEqual(
		resolveStatusSettings({
			PI_UI_STATUS_PRESET: "minimal",
			PI_UI_STATUS_SEGMENTS: "unknown,also-unknown",
		}),
		minimal,
	);
});

test("设置文件提供默认值，环境变量仍保持最高优先级", () => {
	const configured = resolveStatusSettings({}, {
		preset: "full",
		segments: ["model", "git", "tokens"],
	});
	assert.equal(configured.preset, "full");
	assert.deepEqual(configured.editorLeft, ["model"]);
	assert.deepEqual(configured.footerUsage, ["tokens"]);
	assert.deepEqual(configured.footerPrimary, ["git"]);

	const overridden = resolveStatusSettings({
		PI_UI_STATUS_PRESET: "minimal",
		PI_UI_STATUS_SEGMENTS: "context,project",
	}, {
		preset: "full",
		segments: ["model", "git", "tokens"],
	});
	assert.equal(overridden.preset, "minimal");
	assert.deepEqual(overridden.editorLeft, []);
	assert.deepEqual(overridden.footerUsage, ["context"]);
	assert.deepEqual(overridden.footerPrimary, ["project"]);
});

test("设置文件允许显式关闭全部状态段", () => {
	const settings = resolveStatusSettings({}, { preset: "default", segments: [] });
	assert.deepEqual(settings.editorLeft, []);
	assert.deepEqual(settings.footerUsage, []);
	assert.deepEqual(settings.footerPrimary, []);
	assert.deepEqual(settings.footerExtra, []);
});
