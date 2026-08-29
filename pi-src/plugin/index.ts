import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPiTuiLifecycle, type PiTuiPluginDependencies } from "./lifecycle.ts";
import type { VisibleScreenOutput } from "./screen-transition.ts";

// 视图与机制的稳定出口：测试和下游从这里 import，物理位置变化不影响调用方。
export { PiUiEditor, formatModel } from "./editor.ts";
export { ProjectStatusFooter } from "./footer.ts";
export {
	flashVisibleScreen,
	restoreVisibleMainScreen,
} from "./screen-transition.ts";
export { AutoCompactionStatusController } from "../status/auto-compaction.ts";
export type { PiTuiPluginDependencies } from "./lifecycle.ts";

export default function (
	pi: ExtensionAPI,
	output: VisibleScreenOutput = process.stdout,
	dependencies: PiTuiPluginDependencies = {},
): void {
	registerPiTuiLifecycle(pi, output, dependencies);
}
