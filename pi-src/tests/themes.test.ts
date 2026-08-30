import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadThemeFromPath } from "../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const themesRoot = join(packageRoot, "themes");
const schemaPath = join(
	packageRoot,
	"node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme-schema.json",
);

interface JsonSchemaNode {
	required?: string[];
	properties?: Record<string, JsonSchemaNode>;
	additionalProperties?: boolean | JsonSchemaNode;
}

function assertKnownProperties(
	value: Record<string, unknown>,
	schema: JsonSchemaNode,
	label: string,
): void {
	for (const required of schema.required ?? []) {
		assert.ok(required in value, `${label} 缺少 ${required}`);
	}
	if (schema.additionalProperties === false) {
		const allowed = new Set(Object.keys(schema.properties ?? {}));
		for (const key of Object.keys(value)) {
			assert.ok(allowed.has(key), `${label} 含 Schema 未声明字段 ${key}`);
		}
	}
}

test("开发包声明完整主题目录，16 个主题名称唯一并通过 Pi 严格字段约束", async () => {
	const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as {
		pi?: { themes?: string[] };
	};
	assert.deepEqual(packageJson.pi?.themes, ["./themes"]);

	const schema = JSON.parse(await readFile(schemaPath, "utf8")) as JsonSchemaNode;
	const files = (await readdir(themesRoot)).filter((file) => file.endsWith(".json")).sort();
	assert.equal(files.length, 16);

	const names = new Set<string>();
	for (const file of files) {
		const path = join(themesRoot, file);
		const json = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
		assertKnownProperties(json, schema, file);
		assertKnownProperties(
			json.colors as Record<string, unknown>,
			schema.properties?.colors ?? {},
			`${file}.colors`,
		);
		if (json.export) {
			assertKnownProperties(
				json.export as Record<string, unknown>,
				schema.properties?.export ?? {},
				`${file}.export`,
			);
		}
		assert.equal(typeof json.name, "string");
		assert.equal(names.has(json.name as string), false, `主题名称重复: ${json.name as string}`);
		names.add(json.name as string);
		const loaded = loadThemeFromPath(path, "truecolor");
		assert.equal(loaded.name, json.name);
	}
});

test("针对 Pi TUI 净化的两份主题不再携带 WebUI 专用 export 字段", async () => {
	const forbidden = [
		"backgroundImage",
		"backgroundOverlay",
		"backgroundSize",
		"backgroundPosition",
		"backgroundRepeat",
	];
	for (const file of ["catppuccin-mocha.json", "matrix.json"]) {
		const json = JSON.parse(await readFile(join(themesRoot, file), "utf8")) as {
			export?: Record<string, unknown>;
		};
		for (const key of forbidden) assert.equal(key in (json.export ?? {}), false, `${file}: ${key}`);
	}
});
