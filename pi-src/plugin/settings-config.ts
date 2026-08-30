import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { PiProviderAccessConfig } from "../adapter/provider-usage.ts";
import type { ProviderQueryAccess } from "../../packages/usage-core/index.ts";
import {
	STATUS_PRESET_NAMES,
	STATUS_SEGMENT_IDS,
	type StatusPresetName,
	type StatusSegmentId,
} from "../status/status-config.ts";

export const PI_TUI_CONFIG_VERSION = 1 as const;
export const PROVIDER_REFRESH_INTERVALS = [30_000, 60_000, 120_000, 300_000] as const;

export type ProviderRefreshMs = (typeof PROVIDER_REFRESH_INTERVALS)[number];
export type SpinnerMode = "default" | "static" | "hidden";

export interface PiTuiConfig {
	schemaVersion: typeof PI_TUI_CONFIG_VERSION;
	appearance: {
		editor: boolean;
		header: boolean;
	};
	status: {
		preset: StatusPresetName;
		segments: StatusSegmentId[] | null;
	};
	data: {
		providerRefreshMs: ProviderRefreshMs;
		telemetry: boolean;
		providerAccess?: PiProviderAccessConfig;
	};
	advanced: {
		spinner: SpinnerMode;
	};
}

export interface LoadedPiTuiConfig {
	config: PiTuiConfig;
	warnings: string[];
}

export const DEFAULT_PI_TUI_CONFIG: Readonly<PiTuiConfig> = Object.freeze({
	schemaVersion: PI_TUI_CONFIG_VERSION,
	appearance: Object.freeze({ editor: true, header: true }),
	status: Object.freeze({ preset: "default", segments: null }),
	data: Object.freeze({ providerRefreshMs: 60_000, telemetry: true }),
	advanced: Object.freeze({ spinner: "default" }),
});

const PRESETS = new Set<StatusPresetName>(STATUS_PRESET_NAMES);
const SEGMENTS = new Set<StatusSegmentId>(STATUS_SEGMENT_IDS);
const REFRESH_INTERVALS = new Set<number>(PROVIDER_REFRESH_INTERVALS);
const SPINNER_MODES = new Set<SpinnerMode>(["default", "static", "hidden"]);

function cloneDefault(): PiTuiConfig {
	return {
		schemaVersion: PI_TUI_CONFIG_VERSION,
		appearance: { ...DEFAULT_PI_TUI_CONFIG.appearance },
		status: { preset: DEFAULT_PI_TUI_CONFIG.status.preset, segments: null },
		data: { ...DEFAULT_PI_TUI_CONFIG.data },
		advanced: { ...DEFAULT_PI_TUI_CONFIG.advanced },
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
	if (!isRecord(value)) throw new Error(`${field} 必须是对象`);
	return value;
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> {
	return value === undefined ? {} : requireRecord(value, field);
}

function readChoice<T extends string>(
	value: unknown,
	choices: ReadonlySet<T>,
	fallback: T,
	field: string,
): T {
	if (value === undefined) return fallback;
	if (typeof value !== "string" || !choices.has(value as T)) {
		throw new Error(`${field} 的值无效`);
	}
	return value as T;
}

function readSegments(value: unknown): StatusSegmentId[] | null {
	if (value === undefined || value === null) return null;
	if (!Array.isArray(value)) throw new Error("status.segments 必须是数组或 null");
	const seen = new Set<StatusSegmentId>();
	for (const segment of value) {
		if (typeof segment !== "string" || !SEGMENTS.has(segment as StatusSegmentId)) {
			throw new Error(`status.segments 包含无效值: ${String(segment)}`);
		}
		seen.add(segment as StatusSegmentId);
	}
	return [...seen];
}

function readStatusPresetValue(value: unknown, fallback: StatusPresetName): StatusPresetName {
	if (value === "ascii") return "default";
	return readChoice(value, PRESETS, fallback, "status.preset");
}

function readBoolean(value: unknown, fallback: boolean, field: string): boolean {
	if (value === undefined) return fallback;
	if (typeof value !== "boolean") throw new Error(`${field} 必须是布尔值`);
	return value;
}

function optionalString(value: unknown, field: string): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 必须是非空字符串`);
	return value.trim();
}

function requiredString(value: unknown, field: string): string {
	const parsed = optionalString(value, field);
	if (!parsed) throw new Error(`${field} 必须是非空字符串`);
	return parsed;
}

function optionalSecret(value: unknown, field: string): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || value.length === 0) throw new Error(`${field} 必须是非空字符串`);
	return value;
}

function requiredSecret(value: unknown, field: string): string {
	const parsed = optionalSecret(value, field);
	if (!parsed) throw new Error(`${field} 必须是非空字符串`);
	return parsed;
}

const PROVIDER_QUERY_PROTOCOLS = new Set<ProviderQueryAccess["protocol"]>([
	"sub2api",
	"new-api",
	"generic-balance",
	"zenmux",
]);

function readProviderQuery(value: unknown, index: number): ProviderQueryAccess {
	const field = `data.providerAccess.queries[${index}]`;
	const query = requireRecord(value, field);
	const id = requiredString(query.id, `${field}.id`);
	if (!Array.isArray(query.matchHosts) || query.matchHosts.length === 0) {
		throw new Error(`${field}.matchHosts 必须是非空数组`);
	}
	const matchHosts = query.matchHosts.map((host, hostIndex) => {
		return requiredString(host, `${field}.matchHosts[${hostIndex}]`);
	});
	if (typeof query.protocol !== "string" || !PROVIDER_QUERY_PROTOCOLS.has(query.protocol as ProviderQueryAccess["protocol"])) {
		throw new Error(`${field}.protocol 的值无效`);
	}
	const currency = query.currency === undefined
		? undefined
		: readChoice(query.currency, new Set(["CNY", "USD"] as const), "USD", `${field}.currency`);
	return {
		id,
		matchHosts,
		protocol: query.protocol as ProviderQueryAccess["protocol"],
		...(optionalString(query.displayName, `${field}.displayName`) ? { displayName: String(query.displayName).trim() } : {}),
		...(optionalString(query.baseUrl, `${field}.baseUrl`) ? { baseUrl: String(query.baseUrl).trim() } : {}),
		...(optionalString(query.path, `${field}.path`) ? { path: String(query.path).trim() } : {}),
		...(optionalSecret(query.apiKey, `${field}.apiKey`) ? { apiKey: String(query.apiKey) } : {}),
		...(optionalSecret(query.accessToken, `${field}.accessToken`) ? { accessToken: String(query.accessToken) } : {}),
		...(optionalString(query.userId, `${field}.userId`) ? { userId: String(query.userId).trim() } : {}),
		...(currency ? { currency } : {}),
	};
}

function readProviderQueries(value: unknown): ProviderQueryAccess[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) throw new Error("data.providerAccess.queries 必须是数组");
	return value.map(readProviderQuery);
}

function readGithubDomain(value: unknown): string | undefined {
	const domain = optionalString(value, "data.providerAccess.githubDomain")?.toLowerCase();
	if (!domain) return undefined;
	try {
		const url = new URL(`https://${domain}`);
		if (url.hostname !== domain || url.port || url.pathname !== "/" || url.username || url.password) {
			throw new Error();
		}
		return domain;
	} catch {
		throw new Error("data.providerAccess.githubDomain 必须是主机名");
	}
}

function readProviderAccess(value: unknown): PiProviderAccessConfig | undefined {
	if (value === undefined) return undefined;
	const access = requireRecord(value, "data.providerAccess");
	const queries = readProviderQueries(access.queries);
	const githubDomain = readGithubDomain(access.githubDomain);
	const credentialsValue = optionalRecord(access.credentials, "data.providerAccess.credentials");
	const volcengineValue = credentialsValue.volcengine === undefined
		? undefined
		: requireRecord(credentialsValue.volcengine, "data.providerAccess.credentials.volcengine");
	const zhipuTeamValue = credentialsValue.zhipuTeam === undefined
		? undefined
		: requireRecord(credentialsValue.zhipuTeam, "data.providerAccess.credentials.zhipuTeam");
	const openrouterValue = credentialsValue.openrouter === undefined
		? undefined
		: requireRecord(credentialsValue.openrouter, "data.providerAccess.credentials.openrouter");
	const credentials = {
		...(volcengineValue ? {
			volcengine: {
				accessKeyId: requiredSecret(volcengineValue.accessKeyId, "data.providerAccess.credentials.volcengine.accessKeyId"),
				secretAccessKey: requiredSecret(volcengineValue.secretAccessKey, "data.providerAccess.credentials.volcengine.secretAccessKey"),
			},
		} : {}),
		...(zhipuTeamValue ? {
			zhipuTeam: {
				organizationId: requiredString(zhipuTeamValue.organizationId, "data.providerAccess.credentials.zhipuTeam.organizationId"),
				projectId: requiredString(zhipuTeamValue.projectId, "data.providerAccess.credentials.zhipuTeam.projectId"),
			},
		} : {}),
		...(openrouterValue ? {
			openrouter: {
				managementKey: requiredSecret(openrouterValue.managementKey, "data.providerAccess.credentials.openrouter.managementKey"),
			},
		} : {}),
	};
	return {
		...(queries ? { queries } : {}),
		...(Object.keys(credentials).length > 0 ? { credentials } : {}),
		...(githubDomain ? { githubDomain } : {}),
	};
}

export function parsePiTuiConfig(value: unknown): PiTuiConfig {
	const root = requireRecord(value, "config");
	if (root.schemaVersion !== PI_TUI_CONFIG_VERSION) {
		throw new Error(`不支持 schemaVersion: ${String(root.schemaVersion)}`);
	}
	const defaults = cloneDefault();
	const appearance = optionalRecord(root.appearance, "appearance");
	const status = optionalRecord(root.status, "status");
	const data = optionalRecord(root.data, "data");
	const advanced = optionalRecord(root.advanced, "advanced");
	const refresh = data.providerRefreshMs ?? defaults.data.providerRefreshMs;
	const providerAccess = readProviderAccess(data.providerAccess);
	if (typeof refresh !== "number" || !REFRESH_INTERVALS.has(refresh)) {
		throw new Error("data.providerRefreshMs 的值无效");
	}

	return {
		schemaVersion: PI_TUI_CONFIG_VERSION,
		appearance: {
			editor: readBoolean(
				appearance.editor,
				defaults.appearance.editor,
				"appearance.editor",
			),
			header: readBoolean(
				appearance.header,
				defaults.appearance.header,
				"appearance.header",
			),
		},
		status: {
			preset: readStatusPresetValue(status.preset, defaults.status.preset),
			segments: readSegments(status.segments),
		},
		data: {
			providerRefreshMs: refresh as ProviderRefreshMs,
			telemetry: readBoolean(data.telemetry, defaults.data.telemetry, "data.telemetry"),
			...(providerAccess ? { providerAccess } : {}),
		},
		advanced: {
			spinner: readChoice(
				advanced.spinner,
				SPINNER_MODES,
				defaults.advanced.spinner,
				"advanced.spinner",
			),
		},
	};
}

function readJsonSync(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isMissing(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export function loadPiTuiConfig(path: string): LoadedPiTuiConfig {
	let primaryError: unknown;
	try {
		return { config: parsePiTuiConfig(readJsonSync(path)), warnings: [] };
	} catch (error) {
		if (isMissing(error)) return { config: cloneDefault(), warnings: [] };
		else primaryError = error;
	}

	try {
		const config = parsePiTuiConfig(readJsonSync(`${path}.bak`));
		return {
			config,
			warnings: primaryError ? [`${path} 无效，已改用备份: ${errorText(primaryError)}`] : [],
		};
	} catch (backupError) {
		if (!primaryError && isMissing(backupError)) return { config: cloneDefault(), warnings: [] };
		const reason = primaryError ?? backupError;
		return {
			config: cloneDefault(),
			warnings: [`${path} 无效，已使用默认设置: ${errorText(reason)}`],
		};
	}
}

function mergeRaw(base: Record<string, unknown>, update: Record<string, unknown>): Record<string, unknown> {
	const result = { ...base };
	for (const [key, value] of Object.entries(update)) {
		result[key] = isRecord(result[key]) && isRecord(value)
			? mergeRaw(result[key] as Record<string, unknown>, value)
			: value;
	}
	return result;
}

class FutureConfigVersionError extends Error {}

async function readValidRaw(path: string): Promise<{
	raw: Record<string, unknown>;
	backupCurrent: boolean;
}> {
	for (const candidate of [path, `${path}.bak`]) {
		try {
			const raw = requireRecord(JSON.parse(await readFile(candidate, "utf8")), "config");
			if (typeof raw.schemaVersion === "number" && raw.schemaVersion > PI_TUI_CONFIG_VERSION) {
				throw new FutureConfigVersionError(
					`${candidate} 使用更新的 schemaVersion ${raw.schemaVersion}，当前版本不会覆盖它`,
				);
			}
			parsePiTuiConfig(raw);
			return { raw, backupCurrent: candidate === path };
		} catch (error) {
			if (error instanceof FutureConfigVersionError) throw error;
		}
	}
	return { raw: {}, backupCurrent: false };
}

async function atomicWrite(path: string, text: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temp = join(dirname(path), `.${basename(path)}.${process.pid}-${randomUUID()}.tmp`);
	try {
		await writeFile(temp, text, { encoding: "utf8", mode: 0o600 });
		await rename(temp, path);
	} finally {
		await rm(temp, { force: true });
	}
}

export async function savePiTuiConfig(path: string, config: PiTuiConfig): Promise<void> {
	const parsed = parsePiTuiConfig(config);
	const existing = await readValidRaw(path);
	const merged = mergeRaw(existing.raw, parsed as unknown as Record<string, unknown>);
	merged.schemaVersion = PI_TUI_CONFIG_VERSION;
	parsePiTuiConfig(merged);

	if (existing.backupCurrent) {
		await atomicWrite(`${path}.bak`, `${JSON.stringify(existing.raw, null, 2)}\n`);
	}
	await atomicWrite(path, `${JSON.stringify(merged, null, 2)}\n`);
}

export function piTuiConfigPath(agentDir: string): string {
	return join(agentDir, "pi-tui.json");
}
