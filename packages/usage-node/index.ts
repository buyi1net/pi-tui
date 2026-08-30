import { createHash } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	findProviderById,
	findProviderByUrl,
	type BuiltinQueryKind,
} from "../shared/provider-catalog.ts";
import {
	detectProviderKind,
	fetchProviderUsage,
	findProviderQueryConfig,
} from "../shared/provider-usage.ts";
import {
	markUsageSnapshotStale,
	normalizeEndpoint,
	normalizeUsageSnapshot,
	resolveProviderMetadata,
	type ProviderAccess,
	type ProviderAccessOptions,
	type UsageSnapshot,
} from "../usage-core/index.ts";

export type UsageQueryResult =
	| { status: "success"; snapshot: UsageSnapshot }
	| { status: "unsupported" }
	| { status: "failed" };

export type UsageRuntimeStatus =
	| "idle"
	| "loading"
	| "ready"
	| "stale"
	| "error"
	| "unsupported";

export interface UsageRuntimeState {
	status: UsageRuntimeStatus;
	provider: { id: string; brandName: string } | null;
	snapshot: UsageSnapshot | null;
}

export interface CreateProviderAccessInput {
	providerId: string;
	modelId?: string;
	endpoint: string;
	credential: string;
	authKind?: "api-key" | "oauth";
	accountId?: string;
	githubDomain?: string;
	query?: ProviderAccessOptions["query"];
	credentials?: ProviderAccessOptions["credentials"];
}

export interface UsageRuntimeOptions {
	keepLastGoodMs?: number;
	retryBackoffMs?: number;
	query?: (access: ProviderAccess) => Promise<UsageQueryResult>;
	onChange?: (state: UsageRuntimeState) => void;
	now?: () => number;
	cache?: UsageSnapshotCache;
}

export interface UsageSnapshotCache {
	read(identityKey: string): UsageSnapshot | null;
	write(identityKey: string, snapshot: UsageSnapshot): void;
}

export { findProviderQueryConfig };

const DEFAULT_KEEP_LAST_GOOD_MS = 10 * 60_000;
const DEFAULT_RETRY_BACKOFF_MS = 30_000;

function isUsageSnapshot(value: unknown): value is UsageSnapshot {
	if (!value || typeof value !== "object") return false;
	const snapshot = value as Partial<UsageSnapshot>;
	const balanceValid = snapshot.balance === null || (
		!!snapshot.balance &&
		Number.isFinite(snapshot.balance.amount) &&
		(snapshot.balance.currency === "CNY" || snapshot.balance.currency === "USD")
	);
	const windowsValid = Array.isArray(snapshot.windows) && snapshot.windows.every((window) => (
		typeof window?.label === "string" &&
		Number.isFinite(window?.remainingPercent) &&
		(window?.resetMs === null || Number.isFinite(window?.resetMs))
	));
	return (
		typeof snapshot.provider?.id === "string" &&
		typeof snapshot.provider?.brandName === "string" &&
		["subscription", "api", "hybrid", "unknown"].includes(snapshot.billingMode ?? "") &&
		balanceValid &&
		windowsValid &&
		typeof snapshot.fetchedAt === "number" &&
		Number.isFinite(snapshot.fetchedAt) &&
		(snapshot.freshness === "fresh" || snapshot.freshness === "stale")
	);
}

export class FileUsageSnapshotCache implements UsageSnapshotCache {
	private readonly root: string;

	constructor(root: string) {
		this.root = root;
	}

	private path(identityKey: string): string {
		const fingerprint = createHash("sha256").update(identityKey).digest("hex");
		return join(this.root, `${fingerprint}.json`);
	}

	read(identityKey: string): UsageSnapshot | null {
		try {
			const value: unknown = JSON.parse(readFileSync(this.path(identityKey), "utf8"));
			return isUsageSnapshot(value) ? value : null;
		} catch {
			return null;
		}
	}

	write(identityKey: string, snapshot: UsageSnapshot): void {
		const target = this.path(identityKey);
		const temporary = `${target}.${process.pid}-${Date.now()}.tmp`;
		try {
			mkdirSync(this.root, { recursive: true });
			writeFileSync(temporary, JSON.stringify(snapshot), { encoding: "utf8", mode: 0o600 });
			renameSync(temporary, target);
		} catch {
			try {
				unlinkSync(temporary);
			} catch {
				// 缓存失败不影响供应商查询和界面显示。
			}
		}
	}
}

export function createProviderAccess(input: CreateProviderAccessInput): ProviderAccess {
	const endpoint = normalizeEndpoint(input.endpoint);
	const metadata = resolveProviderMetadata(endpoint, input.providerId, input.modelId);
	const stableOAuthAccount = input.authKind === "oauth" && input.accountId
		? input.accountId
		: null;
	const accountFingerprint = createHash("sha256")
		.update(JSON.stringify({
			credential: stableOAuthAccount ? null : input.credential,
			modelId: input.modelId ?? null,
			query: input.query ?? null,
			credentials: input.credentials ?? null,
			accountId: stableOAuthAccount,
			githubDomain: input.githubDomain ?? null,
		}))
		.digest("hex")
		.slice(0, 16);
	return {
		identity: {
			providerId: metadata.providerId,
			endpoint,
			accountFingerprint,
		},
		credential: input.credential,
		options: input.authKind || input.query || input.credentials || input.accountId || input.githubDomain || input.modelId
			? {
				modelId: input.modelId,
				authKind: input.authKind,
				accountId: input.accountId,
				githubDomain: input.githubDomain,
				query: input.query,
				credentials: input.credentials,
			}
			: undefined,
	};
}

export function providerAccessKey(access: ProviderAccess): string {
	const identity = access.identity;
	return `${identity.providerId}:${identity.endpoint}:${identity.accountFingerprint}`;
}

function resolveQueryKind(access: ProviderAccess): BuiltinQueryKind | "unknown" {
	const endpointKind =
		findProviderByUrl(access.identity.endpoint)?.queryKind ??
		detectProviderKind(access.identity.endpoint);
	if (endpointKind !== "unknown") return endpointKind;

	// A provider/model label is not proof that an arbitrary relay endpoint belongs to
	// that provider. Never use it to redirect a relay credential to an official host.
	// Provider-only routing is reserved for endpoint-less OAuth identities supplied by
	// the host, where there is no inference API key to reuse across origins.
	if (!access.identity.endpoint && access.options?.authKind === "oauth") {
		return findProviderById(access.identity.providerId)?.queryKind ?? "unknown";
	}
	return "unknown";
}

export async function queryProviderUsage(
	access: ProviderAccess,
	request: typeof fetch = fetch,
): Promise<UsageQueryResult> {
	const kind = resolveQueryKind(access);
	const explicitQuery = access.options?.query ?? null;
	if (!explicitQuery && kind === "unknown") return { status: "unsupported" };
	if (!explicitQuery && kind.endsWith("-subscription") && access.options?.authKind !== "oauth") {
		return { status: "unsupported" };
	}
	if (!explicitQuery && !access.credential && !kind.startsWith("volcengine-")) return { status: "unsupported" };

	const usage = await fetchProviderUsage(
		kind,
		access.identity.endpoint,
		access.credential,
		request,
		{
			oauthToken: access.options?.authKind === "oauth" ? access.credential : undefined,
			accountId: access.options?.accountId,
			githubDomain: access.options?.githubDomain,
			query: explicitQuery ?? undefined,
			credentials: access.options?.credentials,
		},
	).catch(() => null);
	if (!usage) return { status: "failed" };

	const providerId = usage.quota?.provider ?? explicitQuery?.id ?? access.identity.providerId;
	const metadata = resolveProviderMetadata(
		access.identity.endpoint,
		providerId,
		access.options?.modelId,
	);
	return {
		status: "success",
		snapshot: normalizeUsageSnapshot({
			providerId: metadata.providerId,
			brandName: explicitQuery?.displayName ?? metadata.brandName,
			billingMode: usage.mode,
			balance: usage.balance,
			windows: usage.quota?.windows,
		}),
	};
}

export class UsageRuntime {
	private readonly keepLastGoodMs: number;
	private readonly retryBackoffMs: number;
	private readonly query: (access: ProviderAccess) => Promise<UsageQueryResult>;
	private readonly onChange: (state: UsageRuntimeState) => void;
	private readonly now: () => number;
	private readonly cache: UsageSnapshotCache | undefined;
	private readonly inFlight = new Map<string, Promise<UsageQueryResult>>();
	private readonly retryAfter = new Map<string, number>();
	private state: UsageRuntimeState = { status: "idle", provider: null, snapshot: null };
	private activeKey = "";
	private revision = 0;
	private disposed = false;

	constructor(options: UsageRuntimeOptions = {}) {
		this.keepLastGoodMs = options.keepLastGoodMs ?? DEFAULT_KEEP_LAST_GOOD_MS;
		this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
		this.query = options.query ?? ((access) => queryProviderUsage(access));
		this.onChange = options.onChange ?? (() => {});
		this.now = options.now ?? Date.now;
		this.cache = options.cache;
	}

	getState(): UsageRuntimeState {
		return this.state;
	}

	private update(state: UsageRuntimeState): void {
		if (this.disposed) return;
		this.state = state;
		this.onChange(state);
	}

	async refresh(access: ProviderAccess | null): Promise<void> {
		if (this.disposed) return;
		const revision = ++this.revision;
		if (!access) {
			this.activeKey = "";
			this.update({ status: "idle", provider: null, snapshot: null });
			return;
		}

		const key = providerAccessKey(access);
		const metadata = resolveProviderMetadata(
			access.identity.endpoint,
			access.identity.providerId,
			access.options?.modelId,
		);
		const provider = { id: metadata.providerId, brandName: metadata.brandName };
		if (key !== this.activeKey) {
			this.activeKey = key;
			const cached = this.cache?.read(key);
			if (cached && this.now() - cached.fetchedAt <= this.keepLastGoodMs) {
				const stale = markUsageSnapshotStale(cached);
				this.update({ status: "stale", provider: stale.provider, snapshot: stale });
			} else {
				this.update({ status: "loading", provider, snapshot: null });
			}
		}
		if ((this.retryAfter.get(key) ?? 0) > this.now()) return;

		let pending = this.inFlight.get(key);
		if (!pending) {
			pending = this.query(access).finally(() => this.inFlight.delete(key));
			this.inFlight.set(key, pending);
		}
		const result = await pending;
		if (this.disposed || revision !== this.revision || key !== this.activeKey) return;

		if (result.status === "success") {
			this.retryAfter.delete(key);
			this.cache?.write(key, result.snapshot);
			this.update({ status: "ready", provider: result.snapshot.provider, snapshot: result.snapshot });
			return;
		}
		if (result.status === "unsupported") {
			this.retryAfter.delete(key);
			this.update({ status: "unsupported", provider, snapshot: null });
			return;
		}

		this.retryAfter.set(key, this.now() + this.retryBackoffMs);
		const previous = this.state.snapshot;
		if (previous && this.now() - previous.fetchedAt <= this.keepLastGoodMs) {
			const stale = markUsageSnapshotStale(previous);
			this.update({ status: "stale", provider: stale.provider, snapshot: stale });
			return;
		}
		this.update({ status: "error", provider, snapshot: null });
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.revision += 1;
		this.inFlight.clear();
		this.retryAfter.clear();
	}
}
