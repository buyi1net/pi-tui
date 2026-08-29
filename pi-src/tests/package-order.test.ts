import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ensureFirstPackage } from "../plugin/package-order.ts";

function makeAgentDir(name: string, packages: unknown[], extra: Record<string, unknown> = {}): string {
	const dir = join(process.cwd(), "tests", ".tmp", name);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "settings.json"), JSON.stringify({ packages, ...extra }, null, "\t"));
	return dir;
}

test("不在首位时调整到首位并原子写回", () => {
	const self = process.cwd();  // 包根 = source/pi-src
	const dir = makeAgentDir("order-a", ["npm:other", self, "git:github.com/x/y"]);
	const result = ensureFirstPackage(dir, {});
	assert.equal(result.adjusted, true);
	const after = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")).packages;
	assert.equal(after[0], self);
	assert.equal(after.length, 3);
});

test("相对本地路径与对象形式也能识别自己", () => {
	const dir = makeAgentDir("order-b", []);
	const self = { source: relative(dir, process.cwd()), autoload: false };
	writeFileSync(join(dir, "settings.json"), JSON.stringify({ packages: ["npm:z", self] }, null, "\t"));
	assert.equal(ensureFirstPackage(dir, {}).adjusted, true);
	const after = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")).packages;
	assert.deepEqual(after[0], self);
});

const remoteSources: Array<[string, unknown]> = [
	["Git shorthand 带 tag", "git:github.com/buyi1net/pi-tui@v0.0.1"],
	["HTTPS 带 tag 和 .git", "https://github.com/buyi1net/pi-tui.git@release/0.0.1"],
	["SSH URL", "ssh://git@github.com/buyi1net/pi-tui.git@main"],
	["SCP 形式", "git:git@github.com:buyi1net/pi-tui.git@main"],
	["对象 source", { source: "https://github.com/buyi1net/pi-tui@v0.0.1", autoload: false }],
];

for (const [label, source] of remoteSources) {
	test(`${label} 能识别自己`, () => {
		const dir = makeAgentDir(`remote-${label}`, ["npm:other", source]);
		assert.equal(ensureFirstPackage(dir, {}).adjusted, true);
		const after = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")).packages;
		assert.deepEqual(after[0], source);
	});
}

test("同名 fork 不会识别成自己", () => {
	const fork = "git:github.com/another-owner/pi-tui@main";
	const dir = makeAgentDir("order-fork", ["npm:other", fork]);
	assert.equal(ensureFirstPackage(dir, {}).adjusted, false);
});

test("npm source 依据 package.json name 识别自己", () => {
	const source = "npm:pi-tui@next";
	const dir = makeAgentDir("order-npm", ["npm:other", source]);
	assert.equal(ensureFirstPackage(dir, {}).adjusted, true);
});

test("已在首位或仅剩自己时零动作", () => {
	const self = process.cwd();  // 包根 = source/pi-src
	const already = makeAgentDir("order-c", [self, "npm:other"]);
	assert.equal(ensureFirstPackage(already, {}).adjusted, false);
	const st = statSync(join(already, "settings.json"));
	ensureFirstPackage(already, {});
	assert.equal(statSync(join(already, "settings.json")).mtimeMs, st.mtimeMs);
});

test("退出开关：settings 标记或环境变量都禁用调整", () => {
	const self = process.cwd();  // 包根 = source/pi-src
	const dir = makeAgentDir("order-d", ["npm:other", self], { piTuiKeepPackageOrder: true });
	assert.equal(ensureFirstPackage(dir, {}).adjusted, false);
	const dir2 = makeAgentDir("order-e", ["npm:other", self]);
	assert.equal(ensureFirstPackage(dir2, { PI_TUI_KEEP_PACKAGE_ORDER: "1" }).adjusted, false);
});
