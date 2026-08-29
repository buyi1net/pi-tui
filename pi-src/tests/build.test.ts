import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, win32 } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function buildPlugin(): { code: string; entryPath: string } {
	const result = spawnSync(process.execPath, ["build.mjs"], {
		cwd: packageRoot,
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr || result.stdout);
	const latest = JSON.parse(readFileSync(join(packageRoot, "dist", "latest.json"), "utf8")) as { file: string };
	const entryPath = join(packageRoot, "dist", latest.file);
	return { code: readFileSync(entryPath, "utf8"), entryPath };
}

test("构建产物保留宿主 bare import 且可由宿主 Jiti 加载", async () => {
	const { code } = buildPlugin();
	const importSpecifiers = [...code.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)]
		.map((match) => match[1]!);
	for (const specifier of ["@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"]) {
		assert.equal(importSpecifiers.includes(specifier), true, `缺少 bare import: ${specifier}`);
	}
	assert.deepEqual(
		importSpecifiers.filter((specifier) => isAbsolute(specifier) || win32.isAbsolute(specifier) || specifier.startsWith("file:")),
		[],
	);
	assert.equal(code.includes(packageRoot), false);
	assert.equal(code.includes(packageRoot.replaceAll("\\", "/")), false);

	const hostEntry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
	const loaderPath = join(dirname(hostEntry), "core", "extensions", "loader.js");
	const loader = await import(pathToFileURL(loaderPath).href) as {
		loadExtensions(paths: string[], cwd: string): Promise<{ extensions: unknown[]; errors: unknown[] }>;
	};
	const loaded = await loader.loadExtensions([join(packageRoot, "plugin", "entry.ts")], packageRoot);
	assert.deepEqual(loaded.errors, []);
	assert.equal(loaded.extensions.length, 1);
});
