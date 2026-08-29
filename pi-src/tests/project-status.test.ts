import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { resolveGlyphs } from "../renderer/icons.ts";
import {
	formatProjectPath,
	formatProjectStatusLine,
	type GitStatusDetails,
	parseGitStatusV2,
	ProjectStatusController,
	renderProjectStatusLine,
} from "../status/project-status.ts";

function gitStatus(overrides: Partial<GitStatusDetails> = {}): GitStatusDetails {
	return {
		branch: "main",
		detached: false,
		unborn: false,
		ahead: 0,
		behind: 0,
		stashed: 0,
		statusCodes: [],
		dirty: false,
		...overrides,
	};
}

test("porcelain v2 同时解析分支、双向分歧、stash 和全部文件状态", () => {
	const parsed = parseGitStatusV2(
		[
			"# branch.oid abcdef1234567890",
			"# branch.head feature/完整状态",
			"# branch.upstream origin/feature/完整状态",
			"# branch.ab +2 -3",
			"# stash 4",
			"1 MM N... 100644 100644 100644 abc def both.ts",
			"1 D. N... 100644 000000 000000 abc def staged-delete.ts",
			"1 .D N... 100644 100644 000000 abc def worktree-delete.ts",
			"2 R. N... 100644 100644 100644 abc def R100 新 文件.ts\t旧 文件.ts",
			"u UU N... 100644 100644 100644 100644 abc def ghi conflict.ts",
			"? 未跟踪 文件.ts",
			"! ignored.log",
		].join("\n"),
	);

	assert.deepEqual(parsed, {
		branch: "feature/完整状态",
		detached: false,
		unborn: false,
		oid: "abcdef1234567890",
		upstream: "origin/feature/完整状态",
		ahead: 2,
		behind: 3,
		stashed: 4,
		statusCodes: [
			{ code: "MM", count: 1, unmerged: false },
			{ code: "D.", count: 1, unmerged: false },
			{ code: ".D", count: 1, unmerged: false },
			{ code: "R.", count: 1, unmerged: false },
			{ code: "UU", count: 1, unmerged: true },
			{ code: "?", count: 1, unmerged: false },
		],
		dirty: true,
	});
});

test("unborn 保留 branch，detached 保留 oid 和 exact tag，stash 不算 dirty", () => {
	assert.deepEqual(parseGitStatusV2("# branch.oid (initial)\n# branch.head main\n"),
		gitStatus({ unborn: true }),
	);
	assert.deepEqual(
		parseGitStatusV2(
			"# branch.oid a1b2c3d4e5f6\n# branch.head (detached)\n# stash 2\n",
			"v1.2.0",
		),
		gitStatus({
			branch: null,
			detached: true,
			oid: "a1b2c3d4e5f6",
			exactTag: "v1.2.0",
			stashed: 2,
		}),
	);
});

test("全部官方 unmerged XY 在数据层独立保留，默认行汇总为 tracked changed", () => {
	const parsed = parseGitStatusV2(
		[
			"# branch.oid abcdef1234567890",
			"# branch.head main",
			...(["DD", "AU", "UD", "UA", "DU", "AA", "UU", "UU"] as const).map(
				(code) =>
					`u ${code} N... 100644 100644 100644 100644 abc def ghi conflict-${code}`,
			),
		].join("\n"),
	);

	assert.deepEqual(parsed.statusCodes, [
		{ code: "DD", count: 1, unmerged: true },
		{ code: "AU", count: 1, unmerged: true },
		{ code: "UD", count: 1, unmerged: true },
		{ code: "UA", count: 1, unmerged: true },
		{ code: "DU", count: 1, unmerged: true },
		{ code: "AA", count: 1, unmerged: true },
		{ code: "UU", count: 2, unmerged: true },
	]);
	assert.equal(
		formatProjectStatusLine({ cwd: "/repo", ...parsed }, 120),
		"📂 /repo · ⎇ main +8",
	);
});

test("git-text 真实黄金样本按 claude-line 规则汇总 tracked 与 untracked", () => {
	const parsed = parseGitStatusV2(
		[
			"# branch.oid 0d33da82bc9751ec08813b04debf85683c2c336d",
			"# branch.head main",
			"# branch.upstream origin/main",
			"# branch.ab +1 -1",
			"# stash 1",
			"1 .D N... 100644 100644 000000 old old deleted.txt",
			"1 MM N... 100644 100644 100644 old index modified.txt",
			"2 R. N... 100644 100644 100644 old index R100 renamed.txt\trename-source.txt",
			"1 A. N... 000000 100644 100644 zero index staged-new.txt",
			"? 未跟踪文件.txt",
		].join("\n"),
	);

	assert.deepEqual(parsed.statusCodes, [
		{ code: ".D", count: 1, unmerged: false },
		{ code: "MM", count: 1, unmerged: false },
		{ code: "R.", count: 1, unmerged: false },
		{ code: "A.", count: 1, unmerged: false },
		{ code: "?", count: 1, unmerged: false },
	]);
	const snapshot = { cwd: "/Users/demo/Documents/pi-agent/git-text", ...parsed };
	const expected = new Map<number, string>([
		[48, "📂 …ments/pi-agent/git-text · ⎇ main +4 ~1 ↑1 ↓1"],
		[64, "📂 ~/Documents/pi-agent/git-text · ⎇ main +4 ~1 ↑1 ↓1"],
		[80, "📂 ~/Documents/pi-agent/git-text · ⎇ main +4 ~1 ↑1 ↓1"],
		[120, "📂 ~/Documents/pi-agent/git-text · ⎇ main +4 ~1 ↑1 ↓1"],
	]);
	for (const [width, line] of expected) {
		assert.equal(formatProjectStatusLine(snapshot, width, "/Users/demo"), line);
	}
});

test("项目路径在 HOME 内缩写，HOME 外保留绝对路径并清理控制字符", () => {
	assert.equal(formatProjectPath("/Users/demo/work/pi-tui", "/Users/demo"), "~/work/pi-tui");
	assert.equal(formatProjectPath("/opt/work/pi-tui", "/Users/demo"), "/opt/work/pi-tui");
	assert.equal(formatProjectPath("/opt/work\n/pi-tui", undefined), "/opt/work /pi-tui");
	assert.equal(formatProjectPath("/opt/\x1b[31mwork\x1b[39m/pi-tui", undefined), "/opt/work/pi-tui");
	assert.equal(
		formatProjectPath(String.raw`C:\Users\demo\work\pi-tui`, String.raw`C:\Users\demo`),
		"~/work/pi-tui",
	);
	assert.equal(formatProjectPath(String.raw`D:\work\pi-tui`, String.raw`C:\Users\demo`), "D:/work/pi-tui");
});

test("Pi 默认 Git 行与 claude-line 0.0.2 的符号、顺序和计数含义一致", () => {
	const line = formatProjectStatusLine(
		{
			cwd: String.raw`D:\iAgent\Pi-Extensions\Pi-Tui`,
			...gitStatus({
				statusCodes: [
					{ code: ".M", count: 2, unmerged: false },
					{ code: "?", count: 4, unmerged: false },
				],
				dirty: true,
			}),
		},
		120,
		String.raw`C:\Users\demo`,
	);
	assert.equal(line, "📂 D:/iAgent/Pi-Extensions/Pi-Tui · ⎇ main +2 ~4");
});

test("Git 行由统一 glyph 集合驱动，切换模式不改变字段顺序和计数", () => {
	const snapshot = {
		cwd: "/repo",
		...gitStatus({
			statusCodes: [
				{ code: "MM", count: 2, unmerged: false },
				{ code: "?", count: 4, unmerged: false },
			],
			ahead: 6,
			behind: 8,
			dirty: true,
		}),
	};
	assert.equal(
		formatProjectStatusLine(snapshot, 120, undefined, resolveGlyphs("ascii", {})),
		"dir /repo · git main +2 ~4 ^6 v8",
	);
	assert.equal(
		formatProjectStatusLine(snapshot, 120, undefined, resolveGlyphs("nerd", {})),
		"  /repo ·  main +2 ~4 ↑6 ↓8",
	);
});

test("Runtime 作为项目行独立状态段显示，空间不足时优先让位给路径和 Git", () => {
	const snapshot = {
		cwd: "/Users/demo/Documents/pi-agent/pi-tui",
		...gitStatus({
			statusCodes: [{ code: "MM", count: 2, unmerged: false }],
			dirty: true,
		}),
		runtime: { name: "Node.js", version: "22.19.0" },
	};
	assert.equal(
		formatProjectStatusLine(
			snapshot,
			120,
			"/Users/demo",
			resolveGlyphs("unicode", {}),
			["project", "git", "runtime"],
		),
		"📂 ~/Documents/pi-agent/pi-tui · ⎇ main +2 · ◩ Node.js 22.19.0",
	);
	const narrow = formatProjectStatusLine(
		snapshot,
		48,
		"/Users/demo",
		resolveGlyphs("unicode", {}),
		["project", "git", "runtime"],
	);
	assert.equal(narrow.includes("Node.js"), false);
	assert.match(narrow, /pi-tui · ⎇ main \+2$/);
	assert.ok(visibleWidth(narrow) <= 48);
});

test("本轮耗时带时钟图标显示在 Git 后，窄屏优先隐藏 Runtime 并保留耗时", () => {
	const snapshot = {
		cwd: "/Users/demo/Documents/pi-agent/pi-tui",
		...gitStatus({
			statusCodes: [{ code: "MM", count: 2, unmerged: false }],
			dirty: true,
		}),
		duration: { state: "done" as const, elapsedMs: 65_000 },
		runtime: { name: "Node.js", version: "22.19.0" },
	};
	assert.equal(
		formatProjectStatusLine(
			snapshot,
			120,
			"/Users/demo",
			resolveGlyphs("unicode", {}),
			["project", "git", "duration", "runtime"],
		),
		"📂 ~/Documents/pi-agent/pi-tui · ⎇ main +2 · ⏱️ 1m 05s · ◩ Node.js 22.19.0",
	);
	const narrow = formatProjectStatusLine(
		snapshot,
		48,
		"/Users/demo",
		resolveGlyphs("unicode", {}),
		["project", "git", "duration", "runtime"],
	);
	assert.equal(narrow.includes("Node.js"), false);
	assert.match(narrow, /⎇ main \+2 · ⏱️ 1m 05s$/);
	assert.ok(visibleWidth(narrow) <= 48);
});

test("默认行汇总 tracked、untracked 和 ahead/behind，隐藏 XY、stash 与 detached 细节", () => {
	const line = formatProjectStatusLine(
		{
			cwd: "/Users/demo/pi-tui",
			...gitStatus({
				statusCodes: [
					{ code: ".D", count: 2, unmerged: false },
					{ code: "MM", count: 3, unmerged: false },
					{ code: "R.", count: 4, unmerged: false },
					{ code: "A.", count: 5, unmerged: false },
					{ code: "?", count: 6, unmerged: false },
				],
				stashed: 7,
				ahead: 8,
				behind: 9,
				dirty: true,
			}),
		},
		160,
		"/Users/demo",
	);
	assert.equal(
		line,
		"📂 ~/pi-tui · ⎇ main +14 ~6 ↑8 ↓9",
	);
	assert.doesNotMatch(line, /XY|stash/);

	const detached = formatProjectStatusLine(
		{
			cwd: "/Users/demo/pi-tui",
			...gitStatus({
				branch: null,
				detached: true,
				oid: "a1b2c3d4e5f6",
				exactTag: "v1.2.0",
			}),
		},
		80,
		"/Users/demo",
	);
	assert.equal(detached, "📂 ~/pi-tui · ⎇ (detached)");
	assert.doesNotMatch(detached, /a1b2c3d|v1\.2\.0/);
});

test("48、64、80、120 列保持单行、连续分隔和 ANSI 可见宽度", () => {
	const snapshot = {
		cwd: "/Users/demo/Documents/pi-agent/pi-tui",
		...gitStatus({
			branch: "feature/project-status-footer",
			statusCodes: [
				{ code: "UU", count: 1, unmerged: true },
				{ code: ".D", count: 2, unmerged: false },
				{ code: "MM", count: 3, unmerged: false },
				{ code: "R.", count: 4, unmerged: false },
				{ code: "A.", count: 5, unmerged: false },
				{ code: "?", count: 6, unmerged: false },
			],
			stashed: 7,
			ahead: 8,
			behind: 9,
			dirty: true,
		}),
	};
	const colors: string[] = [];
	const theme = {
		fg: (color: string, text: string) => {
			colors.push(color);
			return `\u001b[31m${text}\u001b[0m`;
		},
	} as unknown as Theme;

	for (const width of [48, 64, 80, 120]) {
		const plain = formatProjectStatusLine(snapshot, width, "/Users/demo");
		const styled = renderProjectStatusLine(snapshot, width, theme, "/Users/demo");
		assert.ok(visibleWidth(plain) <= width, `${width} 列越界: ${plain}`);
		assert.equal(stripTerminalSequences(styled), plain);
		assert.equal(visibleWidth(styled), visibleWidth(plain));
		assert.equal(plain.endsWith(" "), false);
		assert.match(plain, /pi-tui · /);
	}
	assert.ok(colors.includes("error"));
	assert.ok(colors.includes("warning"));
	assert.ok(colors.includes("success"));
	assert.ok(colors.includes("text"));
});

test("窄屏缩短路径和分支，继续保留 claude-line 汇总计数", () => {
	const dirty = formatProjectStatusLine(
		{
			cwd: "/Users/demo/Documents/pi-agent/pi-tui",
			...gitStatus({
				branch: "feature/这是一个非常长的分支",
				ahead: 8,
				behind: 9,
				stashed: 7,
				statusCodes: [
					{ code: ".D", count: 2, unmerged: false },
					{ code: "UU", count: 1, unmerged: true },
				],
				dirty: true,
			}),
		},
		48,
		"/Users/demo",
	);
	assert.match(dirty, /⎇ feature\/.*\+3 ↑8 ↓9$/);
	assert.doesNotMatch(dirty, /XY|stash/);

	const cleanDiverged = formatProjectStatusLine(
		{
			cwd: "/Users/demo/Documents/pi-agent/pi-tui",
			...gitStatus({
				branch: "feature/这是一个非常长的分支",
				ahead: 8,
				behind: 9,
				stashed: 7,
			}),
		},
		48,
		"/Users/demo",
	);
	assert.match(cleanDiverged, /⎇ feature\/.*↑8 ↓9$/);
	assert.doesNotMatch(cleanDiverged, /stash/);
});

test("极窄 detached 状态保持 claude-line 分支写法并隐藏 oid 与 tag", () => {
	const snapshot = {
		cwd: "/Users/demo/Documents/pi-agent/pi-tui/temp/pi-ui-git-rehearsal/detached-matrix",
		...gitStatus({
			branch: null,
			detached: true,
			oid: "71784e1234567890",
			exactTag: "v1.0.0",
		}),
	};

	for (const width of [19, 20, 24, 32]) {
		const line = formatProjectStatusLine(snapshot, width, "/Users/demo");
		assert.doesNotMatch(line, /\u001b/);
		assert.ok(visibleWidth(line) <= width, `${width} 列越界: ${line}`);
		assert.match(line, /⎇/);
		assert.doesNotMatch(line, /71784e1|v1\.0\.0/);
	}
});

test("非 Git 目录只显示路径，不留下分隔符", () => {
	const line = formatProjectStatusLine(
		{ cwd: "/Users/demo/Documents/pi-tui", branch: null },
		48,
		"/Users/demo",
	);
	assert.equal(line, "📂 ~/Documents/pi-tui");
	assert.doesNotMatch(line, / · /);
});

test("非 Git 目录后台刷新期间保持稳定，不重新显示 Git 占位", async () => {
	let queryCount = 0;
	let releaseQuery: (() => void) | undefined;
	const footerData = {
		getGitBranch: () => null,
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	} satisfies ReadonlyFooterDataProvider;
	const controller = new ProjectStatusController(
		"/workspace/not-a-repo",
		() => {
			queryCount += 1;
			if (queryCount === 1) return Promise.resolve(undefined);
			return new Promise<undefined>((resolve) => {
				releaseQuery = () => resolve(undefined);
			});
		},
		0,
		0,
	);

	controller.connect(footerData, () => {});
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.equal(controller.getSnapshot().refreshState, "error");

	const secondRefresh = controller.refresh();
	assert.equal(controller.getSnapshot().refreshState, "error");
	assert.equal(
		formatProjectStatusLine(controller.getSnapshot(), 80),
		"📂 /workspace/not-a-repo",
	);

	releaseQuery?.();
	await secondRefresh;
	assert.equal(controller.getSnapshot().refreshState, "error");
	controller.dispose();
});

test("Git 刷新缓存完整快照，失败保留最后成功值，恢复和分支切换会重绘", async () => {
	let branch = "main";
	let branchListener: (() => void) | undefined;
	let unsubscribed = false;
	let queryCount = 0;
	let renderCount = 0;
	const footerData = {
		getGitBranch: () => branch,
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: (callback: () => void) => {
			branchListener = callback;
			return () => {
				unsubscribed = true;
			};
		},
	} satisfies ReadonlyFooterDataProvider;
	const ready = gitStatus({
		oid: "abcdef123456",
		statusCodes: [{ code: ".M", count: 1, unmerged: false }],
		dirty: true,
	});
	const controller = new ProjectStatusController(
		"/workspace/demo",
		async () => {
			queryCount += 1;
			if (queryCount === 2) return undefined;
			return branch === "main" ? ready : gitStatus({ branch, oid: "1234567890" });
		},
		0,
	);

	controller.connect(footerData, () => {
		renderCount += 1;
	});
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.deepEqual(controller.getSnapshot().statusCodes, [
		{ code: ".M", count: 1, unmerged: false },
	]);
	assert.equal(controller.getSnapshot().refreshState, "ready");

	controller.requestRefresh(0);
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.deepEqual(controller.getSnapshot().statusCodes, [
		{ code: ".M", count: 1, unmerged: false },
	]);
	assert.equal(controller.getSnapshot().refreshState, "error");

	const beforeRecovery = renderCount;
	controller.requestRefresh(0);
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.equal(controller.getSnapshot().refreshState, "ready");
	assert.ok(renderCount > beforeRecovery);

	branch = "feature/footer";
	branchListener?.();
	assert.equal(controller.getSnapshot().branch, "feature/footer");
	assert.equal(controller.getSnapshot().statusCodes, undefined);
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.equal(controller.getSnapshot().branch, "feature/footer");
	assert.equal(controller.getSnapshot().dirty, false);

	controller.dispose();
	assert.equal(unsubscribed, true);
	controller.requestRefresh(0);
	await new Promise((resolve) => setTimeout(resolve, 5));
	assert.equal(queryCount, 4);
});

test("项目状态段可以独立关闭并按配置顺序排列", () => {
	const snapshot = {
		cwd: "/workspace/demo",
		...gitStatus({
			statusCodes: [{ code: "MM", count: 2, unmerged: false }],
			dirty: true,
		}),
	};
	const glyphs = resolveGlyphs("unicode", {});

	assert.equal(
		formatProjectStatusLine(snapshot, 80, undefined, glyphs, ["project"]),
		"📂 /workspace/demo",
	);
	assert.equal(
		formatProjectStatusLine(snapshot, 80, undefined, glyphs, ["git"]),
		"⎇ main +2",
	);
	assert.equal(
		formatProjectStatusLine(snapshot, 80, undefined, glyphs, ["git", "project"]),
		"⎇ main +2 · 📂 /workspace/demo",
	);
	assert.equal(formatProjectStatusLine(snapshot, 80, undefined, glyphs, []), "");
});

test("Git 定时刷新能发现 Pi 外部产生的改动，销毁后停止查询", async () => {
	let queryCount = 0;
	const footerData = {
		getGitBranch: () => "main",
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	} satisfies ReadonlyFooterDataProvider;
	const controller = new ProjectStatusController(
		"/workspace/demo",
		async () => {
			queryCount += 1;
			return gitStatus({
				statusCodes: queryCount > 1 ? [{ code: ".M", count: 1, unmerged: false }] : [],
				dirty: queryCount > 1,
			});
		},
		0,
		10,
	);

	controller.connect(footerData, () => {});
	await new Promise((resolve) => setTimeout(resolve, 45));
	assert.ok(queryCount >= 2);
	assert.deepEqual(controller.getSnapshot().statusCodes, [{ code: ".M", count: 1, unmerged: false }]);

	controller.dispose();
	const countAfterDispose = queryCount;
	await new Promise((resolve) => setTimeout(resolve, 25));
	assert.equal(queryCount, countAfterDispose);
});

test("Git 周期轮询跳过在途查询，显式刷新仍在完成后补跑", async () => {
	const footerData = {
		getGitBranch: () => "main",
		getExtensionStatuses: () => new Map(),
		getAvailableProviderCount: () => 1,
		onBranchChange: () => () => {},
	} satisfies ReadonlyFooterDataProvider;
	let pollingQueryCount = 0;
	let releasePollingQuery: (() => void) | undefined;
	const pollingController = new ProjectStatusController(
		"/workspace/demo",
		() => {
			pollingQueryCount += 1;
			return new Promise((resolve) => {
				releasePollingQuery = () => resolve(gitStatus());
			});
		},
		0,
		50,
	);
	pollingController.connect(footerData, () => {});
	await new Promise((resolve) => setTimeout(resolve, 60));
	assert.equal(pollingQueryCount, 1);
	releasePollingQuery?.();
	await new Promise((resolve) => setTimeout(resolve, 5));
	assert.equal(pollingQueryCount, 1);
	pollingController.dispose();

	let explicitQueryCount = 0;
	let releaseExplicitQuery: (() => void) | undefined;
	const explicitController = new ProjectStatusController(
		"/workspace/demo",
		() => {
			explicitQueryCount += 1;
			if (explicitQueryCount > 1) return Promise.resolve(gitStatus());
			return new Promise((resolve) => {
				releaseExplicitQuery = () => resolve(gitStatus());
			});
		},
		0,
		0,
	);
	explicitController.connect(footerData, () => {});
	await new Promise((resolve) => setTimeout(resolve, 5));
	explicitController.requestRefresh(0);
	releaseExplicitQuery?.();
	await new Promise((resolve) => setTimeout(resolve, 5));
	assert.equal(explicitQueryCount, 2);
	explicitController.dispose();
});
