import {
	findProviderById,
	findProviderByUrl,
} from "../shared/provider-catalog.ts";
import { displayProviderName } from "../shared/provider-display.ts";
import type {
	BillingMode as SharedBillingMode,
	ProviderCredentials,
	ProviderQueryConfig,
	QuotaWindow as SharedQuotaWindow,
} from "../shared/provider-contracts.ts";

export type BillingMode = SharedBillingMode;
export type UsageFreshness = "fresh" | "stale";

export interface ProviderIdentity {
	providerId: string;
	endpoint: string;
	accountFingerprint: string;
}

export interface ProviderAccess {
	identity: ProviderIdentity;
	credential: string;
	options?: ProviderAccessOptions;
}

export type ProviderQueryAccess = ProviderQueryConfig;

export interface ProviderAccessOptions {
	authKind?: "api-key" | "oauth";
	accountId?: string;
	githubDomain?: string;
	query?: ProviderQueryAccess | null;
	credentials?: ProviderCredentials;
}

export interface Balance {
	amount: number;
	currency: "CNY" | "USD";
}

export type QuotaWindow = SharedQuotaWindow;

export interface UsageSnapshot {
	provider: {
		id: string;
		brandName: string;
	};
	billingMode: BillingMode;
	balance: Balance | null;
	windows: QuotaWindow[];
	fetchedAt: number;
	freshness: UsageFreshness;
}

export interface NormalizedUsageInput {
	providerId: string;
	brandName?: string;
	billingMode: Exclude<BillingMode, "unknown">;
	balance?: Balance;
	windows?: readonly QuotaWindow[];
	fetchedAt?: number;
}

export function normalizeEndpoint(endpoint: string): string {
	const raw = endpoint.trim();
	if (!raw) return "";
	try {
		const url = new URL(raw);
		const path = url.pathname.replace(/\/+$/, "");
		return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${path}`;
	} catch {
		return raw.toLowerCase().replace(/\/+$/, "");
	}
}

export function resolveProviderMetadata(
	endpoint: string,
	providerHint = "",
): { providerId: string; brandName: string } {
	const normalizedEndpoint = normalizeEndpoint(endpoint);
	const catalog =
		(normalizedEndpoint ? findProviderByUrl(normalizedEndpoint) : undefined) ??
		(providerHint ? findProviderById(providerHint) : undefined);
	const providerId = catalog?.brandId ?? (providerHint.trim() || "unknown");
	return {
		providerId,
		brandName: catalog?.displayName ?? displayProviderName(providerId),
	};
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, value));
}

export const MAX_QUOTA_WINDOW_LABEL_LENGTH = 24;

export function sanitizeQuotaWindowLabel(label: unknown): string {
	const safe = String(label ?? "")
		.replace(/(?:\x1b[\]PX^_]|[\u0090\u009d\u009e\u009f])[\s\S]*?(?:\x07|\x1b\\|\u009c)/g, "")
		.replace(/(?:\x1b[\]PX^_]|[\u0090\u009d\u009e\u009f])[\s\S]*$/g, "")
		.replace(/(?:\x1b\[|\u009b)[0-?]*[ -\/]*[@-~]/g, "")
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return [...(safe || "Quota")].slice(0, MAX_QUOTA_WINDOW_LABEL_LENGTH).join("");
}

export function normalizeUsageSnapshot(input: NormalizedUsageInput): UsageSnapshot {
	return {
		provider: {
			id: input.providerId,
			brandName: input.brandName ?? displayProviderName(input.providerId),
		},
		billingMode: input.billingMode,
		balance: input.balance ?? null,
		windows: (input.windows ?? []).map((window) => ({
			label: sanitizeQuotaWindowLabel(window.label),
			remainingPercent: clampPercent(window.remainingPercent),
			resetMs: window.resetMs,
		})),
		fetchedAt: input.fetchedAt ?? Date.now(),
		freshness: "fresh",
	};
}

export function markUsageSnapshotStale(snapshot: UsageSnapshot): UsageSnapshot {
	return snapshot.freshness === "stale" ? snapshot : { ...snapshot, freshness: "stale" };
}
