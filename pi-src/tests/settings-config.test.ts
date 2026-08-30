import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	DEFAULT_PI_TUI_CONFIG,
	loadPiTuiConfig,
	parsePiTuiConfig,
	savePiTuiConfig,
} from "../plugin/settings-config.ts";

const TEST_ROOT = resolve(process.cwd(), "../../../temp/pi-settings-tests");

function testDir(): string {
	return resolve(TEST_ROOT, randomUUID());
}

test.after(async () => {
	await rm(TEST_ROOT, { recursive: true, force: true });
});

test("缺少配置文件时返回完整默认值", () => {
	const loaded = loadPiTuiConfig(resolve(testDir(), "pi-tui.json"));
	assert.deepEqual(loaded.config, DEFAULT_PI_TUI_CONFIG);
	assert.deepEqual(loaded.warnings, []);
});

test("配置校验补齐缺省字段并拒绝非法值", () => {
	assert.deepEqual(parsePiTuiConfig({ schemaVersion: 1 }), DEFAULT_PI_TUI_CONFIG);
	assert.equal(DEFAULT_PI_TUI_CONFIG.appearance.editor, true);
	assert.equal(DEFAULT_PI_TUI_CONFIG.appearance.header, true);
	assert.equal(DEFAULT_PI_TUI_CONFIG.data.telemetry, true);
	assert.equal(
		parsePiTuiConfig({ schemaVersion: 1, status: { preset: "ascii" } }).status.preset,
		"default",
	);
	assert.throws(
		() => parsePiTuiConfig({ schemaVersion: 1, status: { segments: ["model", "unknown"] } }),
		/status\.segments/,
	);
	assert.throws(
		() => parsePiTuiConfig({ schemaVersion: 1, appearance: { header: "yes" } }),
		/appearance\.header/,
	);
});

test("供应商访问配置只接受显式协议、主机映射和控制面凭据", () => {
	const config = parsePiTuiConfig({
		schemaVersion: 1,
		data: {
			providerAccess: {
				queries: [{
					id: "relay",
					displayName: "Relay",
					matchHosts: ["relay.example"],
					protocol: "generic-balance",
					apiKey: "query-key",
				}],
				credentials: {
					volcengine: { accessKeyId: "ak", secretAccessKey: "sk" },
					openrouter: { managementKey: "management-key" },
				},
				githubDomain: "github.enterprise.example",
			},
		},
	});
	assert.equal(config.data.providerAccess?.queries?.[0]?.id, "relay");
	assert.equal(config.data.providerAccess?.credentials?.volcengine?.accessKeyId, "ak");
	assert.equal(config.data.providerAccess?.credentials?.openrouter?.managementKey, "management-key");
	assert.equal(config.data.providerAccess?.githubDomain, "github.enterprise.example");
	assert.throws(
		() => parsePiTuiConfig({
			schemaVersion: 1,
			data: {
				providerAccess: {
					queries: [{ id: "relay", matchHosts: [], protocol: "javascript" }],
				},
			},
		}),
		/data\.providerAccess\.queries/,
	);
	assert.throws(
		() => parsePiTuiConfig({
			schemaVersion: 1,
			data: { providerAccess: { githubDomain: "github.example/path" } },
		}),
		/data\.providerAccess\.githubDomain/,
	);
	assert.throws(
		() => parsePiTuiConfig({
			schemaVersion: 1,
			data: { providerAccess: { credentials: { openrouter: {} } } },
		}),
		/data\.providerAccess\.credentials\.openrouter\.managementKey/,
	);
});

test("主配置损坏时读取备份并保留诊断警告", async () => {
	const dir = testDir();
	const path = resolve(dir, "pi-tui.json");
	await mkdir(dir, { recursive: true });
	try {
		await writeFile(path, "{broken", "utf8");
		await writeFile(`${path}.bak`, JSON.stringify({
			schemaVersion: 1,
			appearance: { header: true, iconMode: "unicode" },
		}), "utf8");
		const loaded = loadPiTuiConfig(path);
		assert.equal(loaded.config.appearance.header, true);
		assert.equal("iconMode" in loaded.config.appearance, false);
		assert.match(loaded.warnings[0] ?? "", /已改用备份/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("用户删除主配置后使用默认值，不让历史备份复活", async () => {
	const dir = testDir();
	const path = resolve(dir, "pi-tui.json");
	await mkdir(dir, { recursive: true });
	try {
		await writeFile(`${path}.bak`, JSON.stringify({
			schemaVersion: 1,
			appearance: { iconMode: "ascii", header: true },
		}), "utf8");
		const loaded = loadPiTuiConfig(path);
		assert.deepEqual(loaded.config, DEFAULT_PI_TUI_CONFIG);
		assert.deepEqual(loaded.warnings, []);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("保存使用原子文件并备份旧配置，同时保留未知字段", async () => {
	const dir = testDir();
	const path = resolve(dir, "pi-tui.json");
	await mkdir(dir, { recursive: true });
	try {
		await writeFile(path, JSON.stringify({
			schemaVersion: 1,
			appearance: { custom: "keep" },
			future: { enabled: true },
		}), "utf8");
		await savePiTuiConfig(path, {
			schemaVersion: 1,
			appearance: { editor: true, header: true },
			status: { preset: "full", segments: ["model", "git", "provider"] },
			data: { providerRefreshMs: 120_000, telemetry: true },
			advanced: { spinner: "static" },
		});
		const raw = JSON.parse(await readFile(path, "utf8"));
		assert.equal(raw.appearance.custom, "keep");
		assert.equal(raw.future.enabled, true);
		assert.equal(raw.appearance.header, true);
		assert.equal(loadPiTuiConfig(path).config.data.providerRefreshMs, 120_000);
		const backup = JSON.parse(await readFile(`${path}.bak`, "utf8"));
		assert.equal(backup.appearance.custom, "keep");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("较新版本的配置不会被当前版本覆盖", async () => {
	const dir = testDir();
	const path = resolve(dir, "pi-tui.json");
	await mkdir(dir, { recursive: true });
	try {
		await writeFile(path, JSON.stringify({ schemaVersion: 2, future: true }), "utf8");
		await assert.rejects(() => savePiTuiConfig(path, {
			schemaVersion: 1,
			appearance: { editor: true, header: false },
			status: { preset: "default", segments: null },
			data: { providerRefreshMs: 60_000, telemetry: true },
			advanced: { spinner: "default" },
		}), /不会覆盖/);
		assert.equal(JSON.parse(await readFile(path, "utf8")).schemaVersion, 2);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
