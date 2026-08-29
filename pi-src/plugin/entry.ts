// 入口垫片：pi.extensions 指向本文件，jiti 在每次 /reload 时重新求值；
// 按 dist/latest.json 指向的内容哈希文件名动态加载构建产物——文件名变化即
// 新模块，绕过 Node/jiti 的路径键缓存，/reload 无需重启即可用上新构建。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const latest = JSON.parse(readFileSync(new URL("../dist/latest.json", import.meta.url), "utf8")) as { file: string };
const distPath = fileURLToPath(new URL(`../dist/${latest.file}`, import.meta.url));
const mod = await import(distPath);
export default mod.default;
export const PiUiEditor = mod.PiUiEditor;
export const ProjectStatusFooter = mod.ProjectStatusFooter;
export const flashVisibleScreen = mod.flashVisibleScreen;
export const restoreVisibleMainScreen = mod.restoreVisibleMainScreen;
export const formatModel = mod.formatModel;
export const AutoCompactionStatusController = mod.AutoCompactionStatusController;
