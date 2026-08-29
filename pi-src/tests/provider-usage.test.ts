import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	normalizeUsageSnapshot,
	type UsageSnapshot,
} from "../../packages/usage-core/index.ts";
import {
	createProviderAccess,
	providerAccessKey,
	queryProviderUsage,
	UsageRuntime,
	type UsageQueryResult,
	type UsageSnapshotCache,
} from "../../packages/usage-node/index.ts";
import {
	PiProviderUsageController,
	resolvePiProviderAccess,
} from "../adapter/provider-usage.ts";

function snapshot(provider: string, fetchedAt: number): UsageSnapshot {
	return {
		provider: { id: provider, brandName: provider },
		billingMode: "api",
		balance: { amount: 10, currency: "USD" },
		windows: [],
		fetchedAt,
		freshness: "fresh",
	};
}

test("Pi adapter 使用宿主解析后的地址和凭据生成不可逆账号身份", async () => {
	const model = {
		provider: "deepseek",
		id: "deepseek-chat",
		baseUrl: "https://api.deepseek.com/v1/",
	} as NonNullable<ExtensionContext["model"]>;
	const ctx = {
		model,
		modelRegistry: {
			getApiKeyAndHeaders: async () => ({
				ok: true,
				apiKey: "test-secret",
				baseUrl: "https://api.deepseek.com/v1",
			}),
			isUsingOAuth: () => false,
		},
	} as unknown as ExtensionContext;

	const access = await resolvePiProviderAccess(ctx);
	assert.ok(access);
	assert.equal(access.identity.providerId, "deepseek");
	assert.equal(access.identity.endpoint, "https://api.deepseek.com/v1");
	assert.equal(access.options?.authKind, "api-key");
	assert.equal(access.identity.accountFingerprint.length, 16);
	assert.doesNotMatch(providerAccessKey(access), /test-secret/);
});

test("Pi adapter 从 Codex OAuth token 提取 ChatGPT 账号并识别宿主公开地址", async () => {
	const payload = Buffer.from(JSON.stringify({
		"https://api.openai.com/auth": {
			chatgpt_account_id: "account-from-token",
		},
	}), "utf8").toString("base64url");
	const token = `header.${payload}.signature`;
	const model = {
		provider: "openai-codex",
		id: "gpt-5.6-sol",
		baseUrl: "https://chatgpt.com/backend-api",
	} as NonNullable<ExtensionContext["model"]>;
	const ctx = {
		model,
		modelRegistry: {
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: token }),
			isUsingOAuth: () => true,
		},
	} as unknown as ExtensionContext;

	const access = await resolvePiProviderAccess(ctx);
	assert.ok(access);
	assert.equal(access.identity.providerId, "codex");
	assert.equal(access.identity.endpoint, "https://chatgpt.com/backend-api");
	assert.equal(access.options?.authKind, "oauth");
	assert.equal(access.options?.accountId, "account-from-token");
});

test("稳定 OAuth 账号不因 access token 轮换改变身份", () => {
	const first = createProviderAccess({
		providerId: "openai-codex",
		endpoint: "https://chatgpt.com/backend-api",
		credential: "access-token-a",
		authKind: "oauth",
		accountId: "account-1",
	});
	const second = createProviderAccess({
		providerId: "openai-codex",
		endpoint: "https://chatgpt.com/backend-api",
		credential: "access-token-b",
		authKind: "oauth",
		accountId: "account-1",
	});

	assert.equal(providerAccessKey(first), providerAccessKey(second));
});

test("共享归一化边界清理并限制额度窗口标签", () => {
	const normalized = normalizeUsageSnapshot({
		providerId: "relay",
		billingMode: "subscription",
		windows: [{
			label: "  5h\u001b[2J\nInjected-abcdefghijklmnopqrstuvwxyz  ",
			remainingPercent: 80,
			resetMs: null,
		}],
	});

	assert.equal(normalized.windows[0]?.label, "5h Injected-abcdefghijkl");
	assert.equal([...normalized.windows[0]!.label].length, 24);
	assert.doesNotMatch(normalized.windows[0]!.label, /\u001b|\r|\n|\[2J/);
});

test("共享运行入口优先执行显式中转查询，并允许查询使用独立凭据", async () => {
	const access = createProviderAccess({
		providerId: "relay",
		endpoint: "https://relay.example/v1",
		credential: "",
		query: {
			id: "billing",
			displayName: "Billing",
			matchHosts: ["relay.example"],
			protocol: "new-api",
			baseUrl: "https://billing.example",
			accessToken: "admin-token",
			userId: "42",
		},
	});
	let requestUrl = "";
	const result = await queryProviderUsage(access, (async (input, init) => {
		requestUrl = String(input);
		assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer admin-token");
		return new Response(JSON.stringify({ success: true, data: { quota: 1_000_000 } }));
	}) as typeof fetch);

	assert.equal(requestUrl, "https://billing.example/api/user/self");
	assert.equal(result.status, "success");
	if (result.status === "success") {
		assert.deepEqual(result.snapshot.balance, { amount: 2, currency: "USD" });
	}
});

test("Pi adapter 只按显式主机映射传入中转协议和额外凭据", async () => {
	const model = {
		provider: "relay",
		id: "model-1",
		baseUrl: "https://relay.example/v1",
	} as NonNullable<ExtensionContext["model"]>;
	const ctx = {
		model,
		modelRegistry: {
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "inference-key" }),
			isUsingOAuth: () => false,
		},
	} as unknown as ExtensionContext;
	const config = {
		queries: [{
			id: "relay-billing",
			matchHosts: ["relay.example"],
			protocol: "generic-balance" as const,
		}],
		credentials: {
			volcengine: { accessKeyId: "ak", secretAccessKey: "sk" },
		},
		githubDomain: "github.enterprise.example",
	};

	const access = await resolvePiProviderAccess(ctx, model, config);
	assert.equal(access?.options?.query?.id, "relay-billing");
	assert.deepEqual(access?.options?.credentials, config.credentials);
	assert.equal(access?.options?.githubDomain, "github.enterprise.example");

	const unmatched = await resolvePiProviderAccess(ctx, {
		...model,
		baseUrl: "https://other.example/v1",
	}, config);
	assert.equal(unmatched?.options?.query, null);
});

test("Pi 与 Claude 共用的查询入口把 DeepSeek 响应归一化为 UsageSnapshot", async () => {
	const access = createProviderAccess({
		providerId: "deepseek",
		endpoint: "https://api.deepseek.com/v1",
		credential: "test-key",
	});
	const request = async () => new Response(JSON.stringify({
		is_available: true,
		balance_infos: [
			{ currency: "CNY", total_balance: "23.50" },
		],
	}), { status: 200 });

	const result = await queryProviderUsage(access, request as typeof fetch);
	assert.equal(result.status, "success");
	if (result.status !== "success") return;
	assert.deepEqual(
		{
			provider: result.snapshot.provider,
			billingMode: result.snapshot.billingMode,
			balance: result.snapshot.balance,
			windows: result.snapshot.windows,
			freshness: result.snapshot.freshness,
		},
		{
			provider: { id: "deepseek", brandName: "DeepSeek" },
			billingMode: "api",
			balance: { amount: 23.5, currency: "CNY" },
			windows: [],
			freshness: "fresh",
		},
	);
});

test("未知中转地址不会因 providerId 提示把凭据发送到官方域名", async () => {
	const access = createProviderAccess({
		providerId: "deepseek",
		endpoint: "https://relay.example.invalid/v1",
		credential: "relay-secret",
	});
	let requestCount = 0;
	const result = await queryProviderUsage(access, (async () => {
		requestCount += 1;
		throw new Error("不应发起请求");
	}) as typeof fetch);

	assert.deepEqual(result, { status: "unsupported" });
	assert.equal(requestCount, 0);
});

test("宿主显式提供 OAuth 后可通过统一入口查询 Codex 官方额度", async () => {
	const access = createProviderAccess({
		providerId: "openai-codex",
		endpoint: "https://chatgpt.com/backend-api",
		credential: "oauth-token",
		authKind: "oauth",
		accountId: "account-1",
	});
	let headers: Record<string, string> = {};
	const result = await queryProviderUsage(access, (async (_input, init) => {
		headers = init?.headers as Record<string, string>;
		return new Response(JSON.stringify({
			rate_limit: {
				primary_window: { used_percent: 20, limit_window_seconds: 18_000 },
			},
		}), { status: 200 });
	}) as typeof fetch);

	assert.equal(result.status, "success");
	assert.equal(headers.Authorization, "Bearer oauth-token");
	assert.equal(headers["ChatGPT-Account-Id"], "account-1");
	if (result.status === "success") {
		assert.equal(result.snapshot.provider.id, "codex");
		assert.equal(result.snapshot.windows[0]?.remainingPercent, 80);
	}
});

test("切换供应商后旧请求不能覆盖新身份", async () => {
	let finishOld: ((result: UsageQueryResult) => void) | undefined;
	const oldResult = new Promise<UsageQueryResult>((resolve) => {
		finishOld = resolve;
	});
	const oldAccess = createProviderAccess({
		providerId: "deepseek",
		endpoint: "https://api.deepseek.com",
		credential: "old",
	});
	const newAccess = createProviderAccess({
		providerId: "stepfun",
		endpoint: "https://api.stepfun.com",
		credential: "new",
	});
	const runtime = new UsageRuntime({
		query: (access) => access.identity.providerId === "deepseek"
			? oldResult
			: Promise.resolve({ status: "success", snapshot: snapshot("stepfun", 1) }),
	});

	const pendingOld = runtime.refresh(oldAccess);
	await runtime.refresh(newAccess);
	finishOld?.({ status: "success", snapshot: snapshot("deepseek", 1) });
	await pendingOld;

	assert.equal(runtime.getState().snapshot?.provider.id, "stepfun");
	runtime.dispose();
});

test("同一身份查询失败时保留十分钟内的旧数据并标记 stale", async () => {
	let now = 1_000;
	let fail = false;
	const access = createProviderAccess({
		providerId: "deepseek",
		endpoint: "https://api.deepseek.com",
		credential: "same-account",
	});
	const runtime = new UsageRuntime({
		now: () => now,
		query: async () => fail
			? { status: "failed" }
			: { status: "success", snapshot: snapshot("deepseek", now) },
	});

	await runtime.refresh(access);
	fail = true;
	now += 60_000;
	await runtime.refresh(access);

	assert.equal(runtime.getState().status, "stale");
	assert.equal(runtime.getState().snapshot?.freshness, "stale");
	runtime.dispose();
});

test("同一身份查询失败后进入退避，退避结束才再次请求", async () => {
	let now = 1_000;
	let queryCount = 0;
	const access = createProviderAccess({
		providerId: "deepseek",
		endpoint: "https://api.deepseek.com",
		credential: "same-account",
	});
	const runtime = new UsageRuntime({
		now: () => now,
		retryBackoffMs: 30_000,
		query: async () => {
			queryCount += 1;
			return { status: "failed" };
		},
	});

	await runtime.refresh(access);
	now += 10_000;
	await runtime.refresh(access);
	assert.equal(queryCount, 1);
	now += 20_000;
	await runtime.refresh(access);
	assert.equal(queryCount, 2);
	runtime.dispose();
});

test("缓存按身份隔离且只保存归一化快照，不保存凭据原文", async () => {
	const values = new Map<string, UsageSnapshot>();
	const cache: UsageSnapshotCache = {
		read: (key) => values.get(key) ?? null,
		write: (key, value) => values.set(key, value),
	};
	const access = createProviderAccess({
		providerId: "deepseek",
		endpoint: "https://api.deepseek.com",
		credential: "cache-secret",
	});
	const first = new UsageRuntime({
		cache,
		query: async () => ({ status: "success", snapshot: snapshot("deepseek", 1_000) }),
	});
	await first.refresh(access);
	first.dispose();

	assert.equal(values.size, 1);
	assert.doesNotMatch([...values.keys()][0] ?? "", /cache-secret/);
	assert.doesNotMatch(JSON.stringify([...values.values()]), /cache-secret/);

	const second = new UsageRuntime({
		cache,
		now: () => 2_000,
		query: async () => ({ status: "failed" }),
	});
	await second.refresh(access);
	assert.equal(second.getState().status, "stale");
	assert.equal(second.getState().snapshot?.provider.id, "deepseek");
	second.dispose();
});

test("模型切换在异步解析新凭据前立即隔离旧余额", async () => {
	const oldAccess = createProviderAccess({
		providerId: "deepseek",
		endpoint: "https://api.deepseek.com",
		credential: "old",
	});
	const nextAccess = createProviderAccess({
		providerId: "stepfun",
		endpoint: "https://api.stepfun.com",
		credential: "next",
	});
	const runtime = new UsageRuntime({
		query: async (access) => ({
			status: "success",
			snapshot: snapshot(access.identity.providerId, 1),
		}),
	});
	await runtime.refresh(oldAccess);

	let finishResolve: ((access: typeof nextAccess) => void) | undefined;
	const resolving = new Promise<typeof nextAccess>((resolve) => {
		finishResolve = resolve;
	});
	const oldModel = {
		provider: "deepseek",
		id: "deepseek-chat",
		baseUrl: "https://api.deepseek.com",
	} as NonNullable<ExtensionContext["model"]>;
	const nextModel = {
		provider: "stepfun",
		id: "step-3",
		baseUrl: "https://api.stepfun.com",
	} as NonNullable<ExtensionContext["model"]>;
	const controller = new PiProviderUsageController(
		{ model: oldModel } as ExtensionContext,
		() => {},
		{
			runtime,
			resolveAccess: async () => resolving,
		},
	);

	const pending = controller.refresh(nextModel);
	assert.equal(controller.getState().snapshot, null);
	finishResolve?.(nextAccess);
	await pending;
	assert.equal(controller.getState().snapshot?.provider.id, "stepfun");
	controller.dispose();
});
