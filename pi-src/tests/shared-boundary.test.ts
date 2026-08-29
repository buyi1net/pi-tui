import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packagesRoot = path.join(projectRoot, "source/packages");

function typescriptFiles(root: string): string[] {
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(root, entry.name);
		if (entry.isDirectory()) return typescriptFiles(target);
		return entry.isFile() && entry.name.endsWith(".ts") ? [target] : [];
	});
}

test("跨宿主 packages 不反向导入任何宿主源码", () => {
	const violations: string[] = [];
	for (const file of typescriptFiles(packagesRoot)) {
		const source = readFileSync(file, "utf8");
		for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
			const specifier = match[1]!.replaceAll("\\", "/");
			if (specifier.includes("/claude/") || specifier.includes("/pi/")) {
				violations.push(`${path.relative(projectRoot, file)} -> ${specifier}`);
			}
		}
	}
	assert.deepEqual(violations, []);
});
