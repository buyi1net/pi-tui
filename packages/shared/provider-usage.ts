// 供应商识别与用量查询。端点和字段口径以 cc-switch 0b5da51 为基准，
// Sub2API /v1/usage 另按 ApiKey 现场响应与 Sub2API 上游实现适配。

import type {
  BillingMode,
  ProviderCredentials,
  ProviderQueryConfig,
  QuotaInfo,
  QuotaWindow,
} from './provider-contracts.ts';
import { findProviderByUrl, type BuiltinQueryKind } from './provider-catalog.ts';
import {
  fetchDeepSeekBalance,
  fetchZhipuBalance,
  fetchZhipuQuota,
  fetchZhipuTeamQuota,
  type DeepSeekBalance,
} from './zhipu.ts';
import { fetchVolcengineQuota } from './volcengine.ts';
import {
  fetchClaudeSubscription,
  fetchCodexSubscription,
  fetchCopilotSubscription,
  fetchGeminiSubscription,
} from './official-subscription.ts';
import { fetchGrokSubscription } from './grok-subscription.ts';

export type ProviderKind = BuiltinQueryKind | 'unknown';

export interface BalanceValue {
  amount: number;
  currency: 'CNY' | 'USD';
}

export interface ProviderUsage {
  mode: Exclude<BillingMode, 'unknown'>;
  balance?: BalanceValue;
  quota?: QuotaInfo;
}

export interface FetchProviderUsageOptions {
  query?: ProviderQueryConfig | null;
  credentials?: ProviderCredentials;
  oauthToken?: string;
  accountId?: string;
  githubDomain?: string;
}

export function detectProviderKind(baseUrl: string): ProviderKind {
  return findProviderByUrl(baseUrl)?.queryKind ?? 'unknown';
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function currencyValue(value: unknown, fallback: 'CNY' | 'USD'): 'CNY' | 'USD' {
  const currency = String(value).toUpperCase();
  if (currency === 'USD' || currency === 'CNY') return currency;
  return fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function resetTime(value: unknown): number | null {
  const numeric = numberValue(value);
  if (numeric != null) {
    if (numeric <= 0) return null;
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function remainingWindow(label: string, remainingPercent: number, reset: unknown): QuotaWindow {
  return { label, remainingPercent: clampPercent(remainingPercent), resetMs: resetTime(reset) };
}

function usageWindow(label: string, used: unknown, limit: unknown, reset: unknown): QuotaWindow | null {
  const usedValue = numberValue(used);
  const limitValue = numberValue(limit);
  if (usedValue == null || limitValue == null || limitValue <= 0) return null;
  return remainingWindow(label, 100 - (usedValue / limitValue) * 100, reset);
}

export function parseStepFunBalance(json: any): BalanceValue | null {
  const amount = numberValue(json?.balance);
  return amount == null ? null : { amount, currency: 'CNY' };
}

export function parseSiliconFlowBalance(json: any, international: boolean): BalanceValue | null {
  const amount = numberValue(json?.data?.totalBalance);
  if (amount == null) return null;
  return { amount, currency: international ? 'USD' : 'CNY' };
}

export function parseOpenRouterBalance(json: any): BalanceValue | null {
  const data = json?.data ?? json;
  const total = numberValue(data?.total_credits);
  const used = numberValue(data?.total_usage);
  if (total == null || used == null) return null;
  return { amount: total - used, currency: 'USD' };
}

export function parseNovitaBalance(json: any): BalanceValue | null {
  const units = numberValue(json?.availableBalance);
  return units == null ? null : { amount: units / 10_000, currency: 'USD' };
}

export function parseKimiBalance(json: any, international = false): BalanceValue | null {
  if ((json?.code !== 0 && json?.code !== '0') || !json?.data) return null;
  const amount = numberValue(json.data.available_balance);
  return amount == null
    ? null
    : { amount, currency: international ? 'USD' : 'CNY' };
}

export function parseKimiQuota(json: any): QuotaInfo | null {
  // 官方接口当前返回裸对象；兼容网关包裹在 data 下的同一响应，
  // 但不把普通余额响应误认为套餐额度。
  const payload = json?.data && (json.data.usage || json.data.limits) ? json.data : json;
  const windows: QuotaWindow[] = [];
  const detail = Array.isArray(payload?.limits)
    ? payload.limits.map((item: any) => item?.detail).find((item: any) => item && numberValue(item.limit) != null)
    : null;
  if (detail) {
    const limit = numberValue(detail.limit);
    const remaining = numberValue(detail.remaining);
    if (limit != null && limit > 0 && remaining != null) {
      windows.push(remainingWindow('5h', (remaining / limit) * 100, detail.resetTime));
    }
  }
  const weeklyLimit = numberValue(payload?.usage?.limit);
  const weeklyRemaining = numberValue(payload?.usage?.remaining);
  if (weeklyLimit != null && weeklyLimit > 0 && weeklyRemaining != null) {
    windows.push(remainingWindow('7d', (weeklyRemaining / weeklyLimit) * 100, payload.usage.resetTime));
  }
  return windows.length > 0 ? { provider: 'kimi', windows } : null;
}

export function parseMiniMaxQuota(json: any): QuotaInfo | null {
  if (numberValue(json?.base_resp?.status_code) != null && numberValue(json.base_resp.status_code) !== 0) {
    return null;
  }
  const item = Array.isArray(json?.model_remains)
    ? json.model_remains.find((entry: any) => entry?.model_name === 'general')
    : null;
  if (!item) return null;

  const windows: QuotaWindow[] = [];
  const interval = numberValue(item.current_interval_remaining_percent);
  if (interval != null) windows.push(remainingWindow('5h', interval, item.end_time));
  if (numberValue(item.current_weekly_status) === 1) {
    const weekly = numberValue(item.current_weekly_remaining_percent);
    if (weekly != null) windows.push(remainingWindow('7d', weekly, item.weekly_end_time));
  }
  return windows.length > 0 ? { provider: 'minimax', windows } : null;
}

export function parseZenMuxQuota(json: any): QuotaInfo | null {
  if (json?.success !== true || !json?.data) return null;
  const windows: QuotaWindow[] = [];
  for (const [field, label] of [
    ['quota_5_hour', '5h'],
    ['quota_7_day', '7d'],
  ] as const) {
    const item = json.data[field];
    const usedRatio = numberValue(item?.usage_percentage);
    if (usedRatio != null) windows.push(remainingWindow(label, 100 - usedRatio * 100, item.resets_at));
  }
  return windows.length > 0 ? { provider: 'zenmux', windows } : null;
}

function sub2ApiSubscriptionWindows(subscription: any): QuotaWindow[] {
  const weeklyStart = resetTime(subscription?.weekly_window_start);
  const weeklyReset = weeklyStart == null ? null : weeklyStart + 7 * 86_400_000;
  return [
    usageWindow('1d', subscription?.daily_usage_usd, subscription?.daily_limit_usd, null),
    usageWindow('7d', subscription?.weekly_usage_usd, subscription?.weekly_limit_usd, weeklyReset),
    usageWindow('30d', subscription?.monthly_usage_usd, subscription?.monthly_limit_usd, subscription?.expires_at),
  ].filter((window): window is QuotaWindow => window != null);
}

function sub2ApiRateWindows(rateLimits: any): QuotaWindow[] {
  if (!Array.isArray(rateLimits)) return [];
  return rateLimits
    .map((item: any) => usageWindow(String(item?.window ?? ''), item?.used, item?.limit, item?.reset_at))
    .filter((window): window is QuotaWindow => window != null && window.label.length > 0);
}

export function parseSub2ApiUsage(json: any, provider = 'apikey.fun'): ProviderUsage | null {
  if (!json || json.isValid === false || json.error) return null;

  const subscriptionWindows = sub2ApiSubscriptionWindows(json.subscription);
  const rateWindows = sub2ApiRateWindows(json.rate_limits);
  const windows = [...subscriptionWindows, ...rateWindows];
  const quotaRemaining = numberValue(json?.quota?.remaining);
  const walletRemaining = numberValue(json?.remaining) ?? numberValue(json?.balance);
  const amount = quotaRemaining ?? walletRemaining;
  const balance =
    amount == null
      ? undefined
      : { amount, currency: currencyValue(json?.quota?.unit ?? json?.unit, 'USD') };

  if (windows.length > 0) {
    return {
      mode: balance ? 'hybrid' : 'subscription',
      balance,
      quota: { provider, windows },
    };
  }
  return balance ? { mode: 'api', balance } : null;
}

async function requestJson(url: string, apiKey: string, request: typeof fetch): Promise<any | null> {
  const response = await request(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function matchesConfiguredHost(hostname: string, pattern: string): boolean {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return false;
  if (!normalized.startsWith('*.')) return hostname === normalized;
  const parent = normalized.slice(2);
  return hostname === parent || hostname.endsWith(`.${parent}`);
}

/** 显式配置按当前推理主机匹配；不根据品牌名或 URL 子串猜测。 */
export function findProviderQueryConfig(
  baseUrl: string,
  configs: readonly ProviderQueryConfig[],
): ProviderQueryConfig | null {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  return (
    configs.find(
      (config) =>
        Array.isArray(config?.matchHosts) &&
        config.matchHosts.some((pattern) =>
          typeof pattern === 'string' ? matchesConfiguredHost(hostname, pattern) : false,
        ),
    ) ?? null
  );
}

function appendQueryPath(baseUrl: string, path: string): string | null {
  try {
    const url = new URL(baseUrl);
    const basePath = url.pathname.replace(/\/+$/, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    url.pathname = `${basePath}${suffix}`.replace(/\/{2,}/g, '/');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

async function requestConfiguredJson(
  url: string,
  headers: Record<string, string>,
  request: typeof fetch,
): Promise<any | null> {
  const response = await request(url, {
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export async function fetchConfiguredProviderUsage(
  config: ProviderQueryConfig,
  inferenceBaseUrl: string,
  inferenceApiKey: string,
  request: typeof fetch = fetch,
): Promise<ProviderUsage | null> {
  const queryBaseUrl = String(config.baseUrl || inferenceBaseUrl).replace(/\/+$/, '');
  try {
    if (new URL(queryBaseUrl).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  const providerId = String(config.id || findProviderByUrl(inferenceBaseUrl)?.id || 'relay');
  const providerLabel = String(config.displayName || providerId);

  if (config.protocol === 'new-api') {
    if (!config.accessToken || !config.userId) return null;
    const url = appendQueryPath(queryBaseUrl, config.path || '/api/user/self');
    if (!url) return null;
    const json = await requestConfiguredJson(
      url,
      {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'New-Api-User': config.userId,
      },
      request,
    );
    if (json?.success !== true || !json?.data) return null;
    const amount = numberValue(json.data.quota);
    if (amount == null) return null;
    return {
      mode: 'api',
      balance: { amount: amount / 500_000, currency: config.currency ?? 'USD' },
    };
  }

  if (config.protocol === 'zenmux') {
    if (!config.baseUrl) return null;
    const apiKey = config.apiKey || (sameOrigin(queryBaseUrl, inferenceBaseUrl) ? inferenceApiKey : '');
    if (!apiKey) return null;
    const json = await requestConfiguredJson(queryBaseUrl, { Authorization: `Bearer ${apiKey}` }, request);
    const quota = parseZenMuxQuota(json);
    return quota ? { mode: 'subscription', quota } : null;
  }

  // 只有同源查询可以复用推理 Key；跨域查询必须在配置里单独提供查询 Key。
  const apiKey = config.apiKey || (sameOrigin(queryBaseUrl, inferenceBaseUrl) ? inferenceApiKey : '');
  if (!apiKey) return null;

  if (config.protocol === 'sub2api') {
    let protocolBase = queryBaseUrl;
    try {
      protocolBase = new URL(queryBaseUrl).origin;
    } catch {
      return null;
    }
    const url = appendQueryPath(protocolBase, config.path || '/v1/usage');
    if (!url) return null;
    const json = await requestConfiguredJson(url, { Authorization: `Bearer ${apiKey}` }, request);
    return parseSub2ApiUsage(json, providerLabel);
  }

  if (config.protocol === 'generic-balance') {
    const url = appendQueryPath(queryBaseUrl, config.path || '/user/balance');
    if (!url) return null;
    const json = await requestConfiguredJson(url, { Authorization: `Bearer ${apiKey}` }, request);
    if (!json || json.is_active === false || json.isValid === false) return null;
    const amount = numberValue(json.balance ?? json?.data?.balance);
    return amount == null
      ? null
      : { mode: 'api', balance: { amount, currency: config.currency ?? 'USD' } };
  }

  return null;
}

function sub2ApiUsageUrl(baseUrl: string): string | null {
  try {
    return `${new URL(baseUrl).origin}/v1/usage`;
  } catch {
    return null;
  }
}

export async function fetchProviderUsage(
  kind: ProviderKind,
  baseUrl: string,
  apiKey: string,
  request: typeof fetch = fetch,
  options: FetchProviderUsageOptions = {},
): Promise<ProviderUsage | null> {
  if (options.query) {
    return fetchConfiguredProviderUsage(options.query, baseUrl, apiKey, request);
  }
  if (kind === 'claude-subscription') {
    return fetchClaudeSubscription(options.oauthToken ?? '', request).catch(() => null);
  }
  if (kind === 'codex-subscription') {
    return fetchCodexSubscription(options.oauthToken ?? '', options.accountId, request).catch(() => null);
  }
  if (kind === 'gemini-subscription') {
    return fetchGeminiSubscription(options.oauthToken ?? '', request).catch(() => null);
  }
  if (kind === 'copilot-subscription') {
    return fetchCopilotSubscription(
      options.oauthToken ?? '',
      options.githubDomain ?? 'github.com',
      request,
    ).catch(() => null);
  }
  if (kind === 'grok-subscription') {
    return fetchGrokSubscription(options.oauthToken ?? '', request).catch(() => null);
  }
  if (kind === 'unknown' || (!apiKey && !kind.startsWith('volcengine-'))) return null;

  if (kind === 'zhipu') {
    const team = options.credentials?.zhipuTeam;
    const quota = team
      ? await fetchZhipuTeamQuota(
          apiKey,
          team.organizationId,
          team.projectId,
          request,
        ).catch(() => null)
      : await fetchZhipuQuota(baseUrl, apiKey, request).catch(() => null);
    // 订阅接口只要返回有效窗口（包括剩余 0%），就优先展示并停止后续余额查询。
    if (quota) return { mode: 'subscription', quota };
    // Zhipu 国际站没有已确认的余额接口；不能把国际站 Key 发送到国内 bigmodel.cn。
    if (new URL(baseUrl).hostname === 'api.z.ai') return null;
    const amount = await fetchZhipuBalance(apiKey, request).catch(() => null);
    return amount == null ? null : { mode: 'api', balance: { amount, currency: 'CNY' } };
  }
  if (kind === 'deepseek') {
    const balance: DeepSeekBalance | null = await fetchDeepSeekBalance(apiKey, request).catch(() => null);
    return balance ? { mode: 'api', balance } : null;
  }
  if (kind === 'volcengine-agent' || kind === 'volcengine-coding') {
    const credentials = options.credentials?.volcengine;
    if (!credentials) return null;
    const quota = await fetchVolcengineQuota(
      baseUrl,
      credentials.accessKeyId,
      credentials.secretAccessKey,
      request,
      kind === 'volcengine-agent' ? 'agent' : 'coding',
    ).catch(() => null);
    return quota ? { mode: 'subscription', quota } : null;
  }

  let url: string;
  if (kind === 'kimi-api') {
    try {
      const origin = new URL(baseUrl).origin;
      url = `${origin}/v1/users/me/balance`;
    } catch {
      return null;
    }
  } else if (kind === 'kimi-coding') url = 'https://api.kimi.com/coding/v1/usages';
  else if (kind === 'minimax-cn') url = 'https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains';
  else if (kind === 'minimax-en') url = 'https://api.minimax.io/v1/api/openplatform/coding_plan/remains';
  else if (kind === 'stepfun') url = 'https://api.stepfun.com/v1/accounts';
  else if (kind === 'siliconflow-cn') url = 'https://api.siliconflow.cn/v1/user/info';
  else if (kind === 'siliconflow-en') url = 'https://api.siliconflow.com/v1/user/info';
  else if (kind === 'openrouter') url = 'https://openrouter.ai/api/v1/credits';
  else if (kind === 'novita') url = 'https://api.novita.ai/v3/user/balance';
  else {
    const usageUrl = sub2ApiUsageUrl(baseUrl);
    if (!usageUrl) return null;
    url = usageUrl;
  }

  const json = await requestJson(url, apiKey, request);
  if (kind === 'kimi-api') {
    const international = new URL(baseUrl).hostname === 'api.moonshot.ai';
    const balance = parseKimiBalance(json, international);
    return balance ? { mode: 'api', balance } : null;
  }
  if (kind === 'kimi-coding') {
    const quota = parseKimiQuota(json);
    // Kimi Code 与 Kimi 开放平台是两套计费产品，但 Pi 目前只有
    // api.kimi.com/coding 这个模型入口。只要套餐接口返回有效窗口，
    // 无论剩余百分比是否为 0，都直接展示订阅信息，不再查询普通余额。
    if (quota) return { mode: 'subscription', quota };
    // 对普通 Open Platform Key，套餐接口会返回 401，此时同一 Key 仍可能有普通余额。
    const balanceJson = await requestJson(
      'https://api.moonshot.cn/v1/users/me/balance',
      apiKey,
      request,
    );
    const balance = parseKimiBalance(balanceJson);
    return balance ? { mode: 'api', balance } : null;
  }
  if (kind === 'minimax-cn' || kind === 'minimax-en') {
    const quota = parseMiniMaxQuota(json);
    return quota ? { mode: 'subscription', quota } : null;
  }
  if (kind === 'stepfun') {
    const balance = parseStepFunBalance(json);
    return balance ? { mode: 'api', balance } : null;
  }
  if (kind === 'siliconflow-cn' || kind === 'siliconflow-en') {
    const balance = parseSiliconFlowBalance(json, kind === 'siliconflow-en');
    return balance ? { mode: 'api', balance } : null;
  }
  if (kind === 'openrouter') {
    const balance = parseOpenRouterBalance(json);
    return balance ? { mode: 'api', balance } : null;
  }
  if (kind === 'novita') {
    const balance = parseNovitaBalance(json);
    return balance ? { mode: 'api', balance } : null;
  }
  return parseSub2ApiUsage(json);
}
