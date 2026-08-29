import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	clearRuntimeStatusCache,
	detectRuntimeStatus,
	RuntimeStatusController,
	type RuntimeVersionQuery,
} from "../status/runtime-status.ts";

const TEST_ROOT = resolve(process.cwd(), "../../../temp/pi-runtime-tests");

test.after(async () => {
	await rm(TEST_ROOT, { recursive: true, force: true });
});

test.beforeEach(() => clearRuntimeStatusCache());

test("命中项目标记后才执行对应版本命令并缓存结果", async () => {
	const cwd = resolve(TEST_ROOT, "node-project");
	await mkdir(cwd, { recursive: true });
	await writeFile(resolve(cwd, "package.json"), "{}\n", "utf8");
	const calls: Array<{ command: string; args: readonly string[] }> = [];
	const query: RuntimeVersionQuery = async (command, args) => {
		calls.push({ command, args });
		return { stdout: "v22.19.0\n", stderr: "", code: 0, killed: false };
	};

	assert.deepEqual(await detectRuntimeStatus(cwd, query, new AbortController().signal, {}), {
		name: "Node.js",
		version: "22.19.0",
	});
	assert.deepEqual(await detectRuntimeStatus(cwd, query, new AbortController().signal, {}), {
		name: "Node.js",
		version: "22.19.0",
	});
	assert.deepEqual(calls, [{ command: "node", args: ["--version"] }]);
});

test("PATH 或版本管理器环境变化会使 Runtime 版本缓存失效", async () => {
	const cwd = resolve(TEST_ROOT, "node-path-project");
	await mkdir(cwd, { recursive: true });
	await writeFile(resolve(cwd, "package.json"), "{}\n", "utf8");
	let calls = 0;
	const query: RuntimeVersionQuery = async () => ({
		stdout: `v22.19.${calls += 1}\n`,
		stderr: "",
		code: 0,
		killed: false,
	});

	assert.equal((await detectRuntimeStatus(cwd, query, new AbortController().signal, { PATH: "A" }))?.version, "22.19.1");
	assert.equal((await detectRuntimeStatus(cwd, query, new AbortController().signal, { PATH: "B" }))?.version, "22.19.2");
	assert.equal(calls, 2);
});

test("没有项目标记时不执行任何外部命令", async () => {
	const cwd = resolve(TEST_ROOT, "plain");
	await mkdir(cwd, { recursive: true });
	let calls = 0;
	const result = await detectRuntimeStatus(cwd, async () => {
		calls += 1;
		return { stdout: "", stderr: "", code: 0, killed: false };
	}, new AbortController().signal, {});
	assert.equal(result, null);
	assert.equal(calls, 0);
});

test("版本查询失败仍保留已识别的 Runtime 名称", async () => {
	const cwd = resolve(TEST_ROOT, "python-project");
	await mkdir(cwd, { recursive: true });
	await writeFile(resolve(cwd, "pyproject.toml"), "[project]\n", "utf8");
	const result = await detectRuntimeStatus(cwd, async () => ({
		stdout: "",
		stderr: "not found",
		code: 1,
		killed: false,
	}), new AbortController().signal, {});
	assert.deepEqual(result, { name: "Python" });
});

test("控制器合并并发刷新，销毁后丢弃过期结果", async () => {
	let finish: ((value: { name: string }) => void) | undefined;
	let calls = 0;
	const controller = new RuntimeStatusController("/repo", async () => {
		calls += 1;
		return new Promise((resolveResult) => {
			finish = resolveResult;
		});
	}, 0);
	let renders = 0;
	controller.connect(() => {
		renders += 1;
	});
	await new Promise((resolveTick) => setTimeout(resolveTick, 0));
	controller.requestRefresh(0);
	controller.dispose();
	finish?.({ name: "Node.js" });
	await new Promise((resolveTick) => setTimeout(resolveTick, 0));

	assert.equal(calls, 1);
	assert.equal(controller.getSnapshot(), null);
	assert.equal(renders, 0);
});
