// plugin/lifecycle.ts
import {
  SettingsManager,
  VERSION as VERSION2,
  getAgentDir
} from "@earendil-works/pi-coding-agent";
import {
  Text
} from "@earendil-works/pi-tui";

// adapter/provider-usage.ts
import { homedir } from "node:os";
import { join as join2 } from "node:path";

// ../packages/usage-node/index.ts
import { createHash as createHash2 } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";

// ../packages/shared/provider-catalog.ts
var UNKNOWN_PROVIDER_METADATA = Object.freeze({
  category: "unknown",
  maintenancePriority: "P3",
  queryStatus: "recognition-only"
});
var route = (host, pathPrefix) => ({ host, pathPrefix });
var MAJOR_RELAY_IDS = /* @__PURE__ */ new Set([
  "openrouter",
  "siliconflow-cn",
  "siliconflow-en",
  "novita",
  "zenmux",
  "together-ai",
  "modelscope",
  "aihubmix"
]);
function maintenanceMetadata(group, id, queryKind) {
  const category = group === "official" ? "official" : MAJOR_RELAY_IDS.has(id) ? "major-relay" : "small-relay";
  return {
    category,
    maintenancePriority: category === "official" ? "P0" : category === "major-relay" ? "P1" : "P2",
    queryStatus: queryKind ? "implemented" : "recognition-only"
  };
}
var official = (id, displayName, presetName, routes, queryAccess = "none", queryKind, aliases = [], brandId = id, variant) => ({
  id,
  brandId,
  displayName,
  variant,
  presetName,
  group: "official",
  routes,
  queryAccess,
  queryKind,
  aliases,
  ...maintenanceMetadata("official", id, queryKind)
});
var relay = (id, displayName, presetName, routes, queryAccess = "generic", queryKind, aliases = [], brandId = id, variant) => ({
  id,
  brandId,
  displayName,
  variant,
  presetName,
  group: "relay",
  routes,
  queryAccess,
  queryKind,
  aliases,
  ...maintenanceMetadata("relay", id, queryKind)
});
var OFFICIAL_PROVIDERS = [
  official(
    "anthropic",
    "Anthropic",
    "Claude Official",
    [route("api.anthropic.com")],
    "host-oauth",
    "claude-subscription",
    ["Claude Desktop Official"]
  ),
  official("kimi-api", "Kimi", "Kimi", [route("api.moonshot.cn")], "none", void 0, [], "kimi", "API"),
  official(
    "kimi",
    "Kimi",
    "Kimi For Coding",
    [route("api.kimi.com", "/coding")],
    "api-key",
    "kimi",
    [],
    "kimi",
    "Coding Plan"
  ),
  official(
    "volcengine-agent-plan",
    "Volcengine",
    "\u706B\u5C71 Agent Plan",
    [route("ark.cn-beijing.volces.com", "/api/plan")],
    "extra-credentials",
    "volcengine",
    ["\u706B\u5C71Agentplan"],
    "volcengine",
    "Agent Plan"
  ),
  official(
    "volcengine-coding-plan",
    "Volcengine",
    "\u706B\u5C71 Coding Plan",
    [route("ark.cn-beijing.volces.com", "/api/coding")],
    "extra-credentials",
    "volcengine",
    [],
    "volcengine",
    "Coding Plan"
  ),
  official("byteplus", "BytePlus", "BytePlus", [route("ark.ap-southeast.bytepluses.com")]),
  official("doubao-seed", "Doubao", "DouBaoSeed", [route("ark.cn-beijing.volces.com")]),
  official(
    "gemini",
    "Gemini",
    "Gemini Native",
    [route("generativelanguage.googleapis.com")],
    "host-oauth",
    "gemini-subscription",
    ["Google Official"]
  ),
  official("deepseek", "DeepSeek", "DeepSeek", [route("api.deepseek.com")], "api-key", "deepseek"),
  official("zhipu", "Zhipu", "Zhipu GLM", [route("*.bigmodel.cn")], "api-key", "zhipu", [], "zhipu", "China"),
  official("z.ai", "Zhipu", "Zhipu GLM en", [route("api.z.ai")], "api-key", "zhipu", [], "zhipu", "International"),
  official(
    "baidu-qianfan-coding",
    "Baidu",
    "Baidu Qianfan Coding Plan",
    [route("qianfan.baidubce.com", "/anthropic/coding")],
    "none",
    void 0,
    [],
    "baidu-qianfan",
    "Coding Plan"
  ),
  official(
    "baidu-qianfan-token-plan",
    "Baidu",
    "Baidu Qianfan Token Plan",
    [route("qianfan.baidubce.com", "/anthropic/tokenplan")],
    "none",
    void 0,
    [],
    "baidu-qianfan",
    "Token Plan"
  ),
  official("bailian", "Bailian", "Bailian", [route("dashscope.aliyuncs.com")], "none", void 0, ["Qwen Coder"], "bailian", "API"),
  official("bailian-coding", "Bailian", "Bailian For Coding", [route("coding.dashscope.aliyuncs.com")], "none", void 0, [], "bailian", "Coding Plan"),
  official(
    "stepfun-cn",
    "StepFun",
    "StepFun",
    [route("api.stepfun.com")],
    "api-key",
    "stepfun",
    ["StepFun Step Plan"],
    "stepfun",
    "China"
  ),
  official("stepfun-en", "StepFun", "StepFun en", [route("api.stepfun.ai")], "api-key", "stepfun", [], "stepfun", "International"),
  official("kat-coder", "KAT-Coder", "KAT-Coder", [route("vanchin.streamlake.ai")]),
  official("longcat", "LongCat", "Longcat", [route("api.longcat.chat")]),
  official("minimax-cn", "MiniMax", "MiniMax", [route("api.minimaxi.com")], "api-key", "minimax-cn", [], "minimax", "China"),
  official("minimax-en", "MiniMax", "MiniMax en", [route("api.minimax.io")], "api-key", "minimax-en", [], "minimax", "International"),
  official("bailing", "BaiLing", "BaiLing", [route("api.tbox.cn")]),
  official("github-copilot", "GitHub", "GitHub Copilot", [route("api.githubcopilot.com")], "host-oauth", "copilot-subscription"),
  official("codex", "OpenAI", "Codex", [route("chatgpt.com", "/backend-api")], "host-oauth", "codex-subscription", ["openai-codex"]),
  official("xai", "xAI", "xAI (Grok)", [route("api.x.ai")], "host-oauth", "grok-subscription", ["xAI (Grok) OAuth"]),
  official("xiaomi-mimo", "Xiaomi", "Xiaomi MiMo", [route("api.xiaomimimo.com")], "none", void 0, [], "xiaomi-mimo", "API"),
  official(
    "xiaomi-mimo-token-plan",
    "Xiaomi",
    "Xiaomi MiMo Token Plan (China)",
    [route("token-plan-cn.xiaomimimo.com")],
    "none",
    void 0,
    [],
    "xiaomi-mimo",
    "Token Plan (China)"
  ),
  official("aws-bedrock-aksk", "AWS", "AWS Bedrock (AKSK)", [route("bedrock-runtime.*.amazonaws.com")], "none", void 0, [], "aws-bedrock", "AK/SK"),
  official("aws-bedrock-api-key", "AWS", "AWS Bedrock (API Key)", [route("bedrock-runtime.*.amazonaws.com")], "none", void 0, [], "aws-bedrock", "API Key"),
  // cc-switch 其它宿主相对 Claude 目录新增的第一方服务。
  official("openai", "OpenAI", void 0, [route("api.openai.com")], "host-oauth", void 0, ["OpenAI Official"]),
  official("azure-openai", "Azure", void 0, [route("*.openai.azure.com")], "none", void 0, ["Azure OpenAI"]),
  official(
    "tencent-hunyuan",
    "Tencent",
    void 0,
    [route("tokenhub.tencentmaas.com")],
    "none",
    void 0,
    ["Tencent Hunyuan"]
  ),
  official(
    "nous-research",
    "Nous Research",
    void 0,
    [route("inference-api.nousresearch.com")],
    "none",
    void 0,
    ["Nous Research"]
  )
];
var RELAY_PROVIDERS = [
  relay("packycode", "PackyCode", "PackyCode", [route("www.packyapi.ai")]),
  relay("zetaapi", "ZetaAPI", "ZetaAPI", [route("api.zetaapi.ai")]),
  relay("apinebula", "APINebula", "APINebula", [route("apinebula.ai")]),
  relay("aicodemirror", "AICodeMirror", "AICodeMirror", [route("api.aicodemirror.ai")]),
  relay("patewayai", "PatewayAI", "PatewayAI", [route("api.pateway.ai")]),
  relay("fennoai", "FennoAI", "FennoAI", [route("api.fenno.ai")]),
  relay("runapi", "RunAPI", "RunAPI", [route("runapi.host"), route("runapi.co")]),
  relay("shengsuanyun", "Shengsuanyun", "Shengsuanyun", [route("router.shengsuanyun.com")]),
  relay("aigocode", "AIGoCode", "AIGoCode", [route("api.aigocode.app")]),
  relay("qiniu", "Qiniu", "Qiniu", [route("api.qnaigc.com")]),
  relay("aicoding", "AICoding", "AICoding", [route("api.aicoding.inc")]),
  relay("subrouter", "SubRouter", "SubRouter", [route("subrouter.ai")]),
  relay(
    "apikey",
    "ApiKey",
    "APIKEY.FUN",
    [route("api.apikey.fun"), route("slb.apikey.fun")],
    "api-key",
    "sub2api",
    ["apikey.fun"]
  ),
  relay("claudeapi", "ClaudeAPI", "ClaudeAPI", [route("gw.apito.ai")]),
  relay("code0", "Code0", "Code0", [route("code0.ai")]),
  relay("teamorouter", "TeamoRouter", "TeamoRouter", [
    route("api.teamorouter.cn"),
    route("api.teamorouter.com")
  ]),
  relay("ppio", "PPIO", "PPIO", [route("api.ppio.com")]),
  relay("claudecn", "ClaudeCN", "ClaudeCN", [route("claudecn.top")]),
  relay(
    "siliconflow-cn",
    "SiliconFlow",
    "SiliconFlow",
    [route("api.siliconflow.cn")],
    "api-key",
    "siliconflow-cn",
    [],
    "siliconflow",
    "China"
  ),
  relay(
    "siliconflow-en",
    "SiliconFlow",
    "SiliconFlow en",
    [route("api.siliconflow.com")],
    "api-key",
    "siliconflow-en",
    [],
    "siliconflow",
    "International"
  ),
  relay("a6api", "A6API", "A6API", [route("api.a6api.com")]),
  relay("atlascloud", "AtlasCloud", "AtlasCloud", [route("api.atlascloud.ai")]),
  relay("compshare", "Compshare", "Compshare", [route("api.modelverse.cn")], "generic", void 0, [], "compshare", "API"),
  relay("compshare-coding", "Compshare", "Compshare Coding Plan", [route("cp.compshare.cn")], "generic", void 0, [], "compshare", "Coding Plan"),
  relay("ccsub", "CCSub", "CCSub", [route("www.ccsub.net")]),
  relay("sssaicode", "SSSAiCode", "SSSAiCode", [route("node-hk.sssaicodeapi.com")]),
  relay("micu", "Micu", "Micu", [route("www.micuapi.ai")]),
  relay("rightcode", "RightCode", "RightCode", [route("www.rightapi.ai")]),
  relay("etok", "ETok", "ETok.ai", [route("api.etok.ai")]),
  relay("cubence", "Cubence", "Cubence", [route("api.cubence.com")]),
  relay("crazyrouter", "CrazyRouter", "CrazyRouter", [route("cn.crazyrouter.com")]),
  relay("dmxapi", "DMXAPI", "DMXAPI", [route("www.dmxapi.cn")]),
  relay("sudocode-chat", "SudoCode", "SudoCode.chat", [route("api.sudocode.chat")], "generic", void 0, [], "sudocode", ".chat"),
  relay("sudocode-us", "SudoCode", "SudoCode.us", [route("sudocode.us")], "generic", void 0, [], "sudocode", ".us"),
  relay("xycai", "XycAi", "XycAi", [route("apicdn.xycai.us")]),
  relay("amux", "Amux", "Amux", [route("api.amux.ai")]),
  relay("opencode-go", "OpenCode Go", "OpenCode Go", [route("opencode.ai", "/zen/go")]),
  relay("modelscope", "ModelScope", "ModelScope", [route("api-inference.modelscope.cn")]),
  relay("aihubmix", "AiHubMix", "AiHubMix", [route("aihubmix.com")]),
  relay("cherryin", "CherryIN", "CherryIN", [route("open.cherryin.net")]),
  relay("relaxycode", "RelaxyCode", "RelaxyCode", [route("www.relaxycode.com")]),
  relay("eflowcode", "E-FlowCode", "E-FlowCode", [route("e-flowcode.cc")]),
  relay("openrouter", "OpenRouter", "OpenRouter", [route("openrouter.ai")], "api-key", "openrouter"),
  relay("therouter", "TheRouter", "TheRouter", [route("api.therouter.ai")]),
  relay("novita", "Novita", "Novita AI", [route("api.novita.ai")], "api-key", "novita"),
  relay("nvidia", "NVIDIA", "Nvidia", [route("integrate.api.nvidia.com")]),
  relay("pipellm", "PIPELLM", "PIPELLM", [route("cc-api.pipellm.ai")]),
  relay("jiekou", "JieKou", "JieKou AI", [route("api.jiekou.ai")]),
  // 同一参考提交内有专用 Coding Plan 查询，但没有 Claude 预设。
  relay("zenmux", "ZenMux", void 0, [route("*.zenmux.ai")], "generic"),
  // cc-switch 其它宿主相对 Claude 目录新增的聚合/网关服务。
  relay("together-ai", "Together", void 0, [route("api.together.xyz")], "generic", void 0, ["Together AI"]),
  relay("new-api", "New API", void 0, [], "generic", void 0, ["NewAPI"])
];
var PROVIDER_CATALOG = [
  ...OFFICIAL_PROVIDERS,
  ...RELAY_PROVIDERS
];
var PROVIDER_BRANDS = [
  ...new Map(
    PROVIDER_CATALOG.map((entry) => [
      `${entry.group}:${entry.brandId}`,
      {
        id: entry.brandId,
        displayName: entry.displayName,
        group: entry.group,
        variants: PROVIDER_CATALOG.filter(
          (candidate) => candidate.group === entry.group && candidate.brandId === entry.brandId
        )
      }
    ])
  ).values()
];
var PROVIDER_ROUTES = PROVIDER_CATALOG.flatMap(
  (entry) => entry.routes.map((candidate) => ({ entry, candidate }))
).sort((a, b) => Number(Boolean(b.candidate.pathPrefix)) - Number(Boolean(a.candidate.pathPrefix)));
function hostMatches(hostname, pattern) {
  if (!pattern.includes("*")) return hostname === pattern;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+");
  return new RegExp(`^${escaped}$`).test(hostname);
}
function routeMatches(url, candidate) {
  if (!hostMatches(url.hostname.toLowerCase(), candidate.host.toLowerCase())) return false;
  if (!candidate.pathPrefix) return true;
  const prefix = candidate.pathPrefix.toLowerCase().replace(/\/+$/, "");
  const path = url.pathname.toLowerCase().replace(/\/+$/, "");
  return path === prefix || path.startsWith(`${prefix}/`);
}
function findProviderByUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  return PROVIDER_ROUTES.find(({ candidate }) => routeMatches(url, candidate))?.entry ?? null;
}
function findProviderById(id) {
  const normalized = id.trim().toLowerCase();
  return PROVIDER_CATALOG.find(
    (entry) => entry.id.toLowerCase() === normalized || entry.aliases?.some((alias) => alias.toLowerCase() === normalized)
  ) ?? null;
}

// ../packages/shared/zhipu.ts
function parseZhipuQuota(json) {
  const limits = json?.data?.limits;
  if (!Array.isArray(limits) || limits.length === 0) return null;
  const valid = limits.filter((l) => {
    const t = (l.type ?? "").toUpperCase();
    return t === "TOKENS_LIMIT" || t === "CREDIT_LIMIT";
  });
  if (valid.length === 0) return null;
  const toWindow = (label, l) => {
    if (!l || typeof l.percentage !== "number") return null;
    return {
      label,
      remainingPercent: Math.max(0, Math.min(100, 100 - l.percentage)),
      resetMs: typeof l.nextResetTime === "number" ? l.nextResetTime : null
    };
  };
  let w5 = valid.find((l) => l.unit === 3) ?? null;
  let w7 = valid.find((l) => l.unit === 6) ?? null;
  if (!w5 && !w7) {
    if (valid.length === 1) {
      w5 = valid[0];
    } else {
      const sorted = [...valid].sort((a, b) => (a.nextResetTime ?? 0) - (b.nextResetTime ?? 0));
      w5 = sorted.find((l) => l.nextResetTime == null) ?? sorted[0];
      w7 = sorted.filter((l) => l !== w5)[0] ?? null;
    }
  }
  const windows = [toWindow("5h", w5), toWindow("7d", w7)].filter(
    (window2) => window2 != null
  );
  return windows.length > 0 ? { provider: "zhipu", windows } : null;
}
function parseZhipuBalance(json) {
  if (json?.code !== 200 || typeof json?.data?.balance !== "number") return null;
  return json.data.balance;
}
function zhipuHost(baseUrl) {
  try {
    const hostname = new URL(baseUrl).hostname;
    if (hostname === "bigmodel.cn" || hostname.endsWith(".bigmodel.cn")) return "https://open.bigmodel.cn";
  } catch {
  }
  return "https://api.z.ai";
}
async function fetchZhipuQuota(baseUrl, apiKey, request = fetch) {
  const url = `${zhipuHost(baseUrl)}/api/monitor/usage/quota/limit`;
  const res = await request(url, {
    headers: {
      Authorization: apiKey,
      // 裸 key：智谱监控端点不带 Bearer 前缀
      "Content-Type": "application/json",
      "Accept-Language": "en-US,en"
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) return null;
  const quota = parseZhipuQuota(await res.json().catch(() => null));
  return quota && zhipuHost(baseUrl) === "https://api.z.ai" ? { ...quota, provider: "z.ai" } : quota;
}
async function fetchZhipuTeamQuota(apiKey, organizationId, projectId, request = fetch) {
  if (!apiKey || !organizationId || !projectId) return null;
  const res = await request("https://open.bigmodel.cn/api/monitor/usage/quota/limit?type=2", {
    headers: {
      Authorization: apiKey,
      "bigmodel-organization": organizationId,
      "bigmodel-project": projectId,
      "Content-Type": "application/json",
      "Accept-Language": "en-US,en"
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) return null;
  return parseZhipuQuota(await res.json().catch(() => null));
}
async function fetchZhipuBalance(apiKey, request = fetch) {
  const res = await request("https://bigmodel.cn/api/biz/account/query-customer-account-report", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) return null;
  return parseZhipuBalance(await res.json().catch(() => null));
}
function parseDeepSeekBalance(json) {
  const infos = json?.balance_infos;
  if (!Array.isArray(infos) || infos.length === 0) return null;
  const pick = infos.find((i) => i?.currency === "CNY") ?? infos[0];
  const amount = Number(pick?.total_balance);
  if (!Number.isFinite(amount)) return null;
  return { amount, currency: pick?.currency === "USD" ? "USD" : "CNY" };
}
async function fetchDeepSeekBalance(apiKey, request = fetch) {
  const res = await request("https://api.deepseek.com/user/balance", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) return null;
  return parseDeepSeekBalance(await res.json().catch(() => null));
}

// ../packages/shared/volcengine.ts
import { createHash, createHmac } from "node:crypto";
var HOST = "open.volcengineapi.com";
var VERSION = "2024-01-01";
var SERVICE = "ark";
var CONTENT_TYPE = "application/json; charset=utf-8";
var SIGNED_HEADERS = "host;x-date;x-content-sha256;content-type";
function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}
function isoBasic(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function shortDate(date) {
  return isoBasic(date).slice(0, 8);
}
function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function volcengineRegion(baseUrl) {
  try {
    return new URL(baseUrl).hostname.split(".").find((part) => /^(?:cn|ap)-/.test(part)) ?? "cn-beijing";
  } catch {
    return "cn-beijing";
  }
}
function volcengineCanonicalQuery(action, region) {
  return [
    ["Action", action],
    ["Region", region],
    ["Version", VERSION]
  ].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`).join("&");
}
function signVolcengineRequest(accessKeyId, secretAccessKey, region, canonicalQuery, now) {
  const xDate = isoBasic(now);
  const date = shortDate(now);
  const contentSha256 = sha256Hex("");
  const canonicalHeaders = `host:${HOST}
x-date:${xDate}
x-content-sha256:${contentSha256}
content-type:${CONTENT_TYPE}
`;
  const canonicalRequest = `POST
/
${canonicalQuery}
${canonicalHeaders}
${SIGNED_HEADERS}
${contentSha256}`;
  const scope = `${date}/${region}/${SERVICE}/request`;
  const stringToSign = `HMAC-SHA256
${xDate}
${scope}
${sha256Hex(canonicalRequest)}`;
  const kDate = hmac(secretAccessKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "request");
  const signature = hmac(kSigning, stringToSign).toString("hex");
  return {
    authorization: `HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`,
    xDate,
    contentSha256
  };
}
function numberValue(value) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function resetMs(value) {
  const numeric = numberValue(value);
  if (numeric != null) return numeric <= 0 ? null : numeric < 1e12 ? numeric * 1e3 : numeric;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function window(label, usedPercent, reset) {
  return {
    label,
    remainingPercent: Math.max(0, Math.min(100, 100 - usedPercent)),
    resetMs: resetMs(reset)
  };
}
function parseVolcengineAgentPlan(json) {
  const result = json?.Result ?? json;
  const windows = [];
  for (const [field, label] of [
    ["AFPFiveHour", "5h"],
    ["AFPWeekly", "7d"],
    ["AFPMonthly", "30d"]
  ]) {
    const item = result?.[field];
    const quota = numberValue(item?.Quota);
    const used = numberValue(item?.Used);
    if (quota != null && quota > 0 && used != null) {
      windows.push(window(label, used / quota * 100, item?.ResetTime));
    }
  }
  return windows.length ? { provider: "volcengine", windows } : null;
}
function codingWindow(value) {
  const label = String(value ?? "").toLowerCase();
  if (["session", "5h", "fivehour", "five_hour", "rolling_5h"].includes(label)) return "5h";
  if (["weekly", "week", "7d"].includes(label)) return "7d";
  if (["monthly", "month"].includes(label)) return "30d";
  return null;
}
function parseVolcengineCodingPlan(json) {
  const result = json?.Result ?? json;
  const items = result?.QuotaUsage ?? result?.Usages ?? result?.Details;
  if (!Array.isArray(items)) return null;
  const windows = items.flatMap((item) => {
    const label = codingWindow(item?.Level ?? item?.Type ?? item?.Period ?? item?.Label ?? item?.Window);
    const used = numberValue(item?.Percent ?? item?.UsedPercent ?? item?.UsagePercent);
    return label && used != null ? [window(label, used, item?.ResetTime ?? item?.ResetTimestamp)] : [];
  });
  return windows.length ? { provider: "volcengine", windows } : null;
}
function hasResponseError(json) {
  const error = json?.ResponseMetadata?.Error ?? json?.Error;
  return Boolean(error?.Code || error?.Message);
}
async function callVolcengine(action, region, accessKeyId, secretAccessKey, request) {
  const canonicalQuery = volcengineCanonicalQuery(action, region);
  const signed = signVolcengineRequest(accessKeyId, secretAccessKey, region, canonicalQuery, /* @__PURE__ */ new Date());
  const response = await request(`https://${HOST}/?${canonicalQuery}`, {
    method: "POST",
    headers: {
      Authorization: signed.authorization,
      "Content-Type": CONTENT_TYPE,
      "X-Date": signed.xDate,
      "X-Content-Sha256": signed.contentSha256
    },
    body: "",
    signal: AbortSignal.timeout(15e3)
  });
  const json = await response.json().catch(() => null);
  return response.ok && json && !hasResponseError(json) ? json : null;
}
async function fetchVolcengineQuota(baseUrl, accessKeyId, secretAccessKey, request = fetch) {
  if (!accessKeyId || !secretAccessKey) return null;
  const region = volcengineRegion(baseUrl);
  const agent = await callVolcengine("GetAFPUsage", region, accessKeyId, secretAccessKey, request);
  const agentQuota = parseVolcengineAgentPlan(agent);
  if (agentQuota) return agentQuota;
  const coding = await callVolcengine("GetCodingPlanUsage", region, accessKeyId, secretAccessKey, request);
  return parseVolcengineCodingPlan(coding);
}

// ../packages/shared/official-subscription.ts
function numberValue2(value) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function resetTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1e3 : value;
  }
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function claudeWindowLabel(key) {
  return {
    five_hour: "5h",
    seven_day: "7d",
    seven_day_opus: "7d Opus",
    seven_day_sonnet: "7d Sonnet"
  }[key] ?? key;
}
function parseClaudeSubscription(json) {
  if (!json || typeof json !== "object") return null;
  const windows = [];
  for (const [key, item] of Object.entries(json)) {
    if (key === "extra_usage" || !item || typeof item !== "object") continue;
    const utilization = numberValue2(item.utilization);
    if (utilization == null) continue;
    windows.push({
      label: claudeWindowLabel(key),
      remainingPercent: Math.max(0, Math.min(100, 100 - utilization)),
      resetMs: resetTime(item.resets_at)
    });
  }
  const extra = json.extra_usage;
  const enabled = extra?.is_enabled === true;
  const monthlyLimit = numberValue2(extra?.monthly_limit);
  const usedCredits = numberValue2(extra?.used_credits);
  const currency = String(extra?.currency ?? "").toUpperCase() === "CNY" ? "CNY" : "USD";
  const balance = enabled && monthlyLimit != null && usedCredits != null ? { amount: Math.max(0, monthlyLimit - usedCredits), currency } : void 0;
  if (!windows.length && !balance) return null;
  return {
    mode: windows.length && balance ? "hybrid" : windows.length ? "subscription" : "api",
    quota: windows.length ? { provider: "anthropic", windows } : void 0,
    balance
  };
}
async function fetchClaudeSubscription(accessToken, request = fetch) {
  if (!accessToken) return null;
  const response = await request("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "anthropic-beta": "oauth-2025-04-20",
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) return null;
  return parseClaudeSubscription(await response.json().catch(() => null));
}
function codexWindowLabel(seconds) {
  const value = numberValue2(seconds);
  if (value === 18e3) return "5h";
  if (value === 604800) return "7d";
  if (value === 2592e3) return "30d";
  if (value == null) return "unknown";
  const hours = Math.floor(value / 3600);
  return hours >= 24 ? `${Math.floor(hours / 24)}d` : `${hours}h`;
}
function parseCodexSubscription(json) {
  const rateLimit = json?.rate_limit;
  const windows = [rateLimit?.primary_window, rateLimit?.secondary_window].flatMap(
    (item) => {
      const used = numberValue2(item?.used_percent);
      return used == null ? [] : [
        {
          label: codexWindowLabel(item?.limit_window_seconds),
          remainingPercent: Math.max(0, Math.min(100, 100 - used)),
          resetMs: resetTime(item?.reset_at)
        }
      ];
    }
  );
  return windows.length ? { mode: "subscription", quota: { provider: "codex", windows } } : null;
}
async function fetchCodexSubscription(accessToken, accountId, request = fetch) {
  if (!accessToken) return null;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "codex-cli",
    Accept: "application/json"
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;
  const response = await request("https://chatgpt.com/backend-api/wham/usage", {
    headers,
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) return null;
  return parseCodexSubscription(await response.json().catch(() => null));
}
function geminiCategory(modelId) {
  if (modelId.includes("flash-lite")) return "Gemini Flash Lite";
  if (modelId.includes("flash")) return "Gemini Flash";
  if (modelId.includes("pro")) return "Gemini Pro";
  return modelId || "unknown";
}
function parseGeminiSubscription(json) {
  if (!Array.isArray(json?.buckets)) return null;
  const categories = /* @__PURE__ */ new Map();
  for (const bucket of json.buckets) {
    const remaining = numberValue2(bucket?.remainingFraction);
    if (remaining == null) continue;
    const category = geminiCategory(String(bucket?.modelId ?? ""));
    const current = categories.get(category);
    if (!current || remaining < current.remaining) {
      categories.set(category, { remaining: Math.max(0, Math.min(1, remaining)), reset: bucket?.resetTime });
    }
  }
  const order = /* @__PURE__ */ new Map([
    ["Gemini Pro", 0],
    ["Gemini Flash", 1],
    ["Gemini Flash Lite", 2]
  ]);
  const windows = [...categories.entries()].sort(([left], [right]) => (order.get(left) ?? 3) - (order.get(right) ?? 3)).map(([label, item]) => ({
    label,
    remainingPercent: item.remaining * 100,
    resetMs: resetTime(item.reset)
  }));
  return windows.length ? { mode: "subscription", quota: { provider: "gemini", windows } } : null;
}
function geminiProjectId(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  return typeof value.id === "string" ? value.id : typeof value.projectId === "string" ? value.projectId : null;
}
async function fetchGeminiSubscription(accessToken, request = fetch) {
  if (!accessToken) return null;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const load = await request("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", {
    method: "POST",
    headers,
    body: JSON.stringify({ metadata: { ideType: "GEMINI_CLI", pluginType: "GEMINI" } }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!load.ok) return null;
  const loadJson = await load.json().catch(() => null);
  const project = geminiProjectId(loadJson?.cloudaicompanionProject);
  const quota = await request("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota", {
    method: "POST",
    headers,
    body: JSON.stringify(project ? { project } : {}),
    signal: AbortSignal.timeout(15e3)
  });
  if (!quota.ok) return null;
  return parseGeminiSubscription(await quota.json().catch(() => null));
}
function parseCopilotSubscription(json) {
  const premium = json?.quota_snapshots?.premium_interactions;
  const remaining = numberValue2(premium?.percent_remaining);
  if (remaining == null) return null;
  return {
    mode: "subscription",
    quota: {
      provider: "github-copilot",
      windows: [
        {
          label: "Premium",
          remainingPercent: Math.max(0, Math.min(100, remaining)),
          resetMs: resetTime(json?.quota_reset_date)
        }
      ]
    }
  };
}
async function fetchCopilotSubscription(githubToken, githubDomain = "github.com", request = fetch) {
  if (!githubToken) return null;
  const apiBase = githubDomain === "github.com" ? "https://api.github.com" : `https://${githubDomain}/api/v3`;
  const response = await request(`${apiBase}/copilot_internal/user`, {
    headers: {
      Authorization: `token ${githubToken}`,
      "Content-Type": "application/json",
      "editor-version": "vscode/1.110.1",
      "editor-plugin-version": "copilot-chat/0.38.2",
      "user-agent": "GitHubCopilotChat/0.38.2",
      "x-github-api-version": "2025-10-01"
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) return null;
  return parseCopilotSubscription(await response.json().catch(() => null));
}

// ../packages/shared/grok-subscription.ts
var ENDPOINT = "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig";
function readVarint(bytes, state) {
  let value = 0;
  let shift = 0;
  while (state.index < bytes.length && shift < 53) {
    const byte = bytes[state.index++];
    value += (byte & 127) * 2 ** shift;
    if ((byte & 128) === 0) return value;
    shift += 7;
  }
  return null;
}
function scanProtobuf(bytes, depth, path, scan, order) {
  const state = { index: 0 };
  while (state.index < bytes.length) {
    const start = state.index;
    const key = readVarint(bytes, state);
    if (!key) {
      state.index = start + 1;
      continue;
    }
    const field = Math.floor(key / 8);
    const wire = key & 7;
    const fieldPath = [...path, field];
    if (wire === 0) {
      const value = readVarint(bytes, state);
      if (value == null) state.index = start + 1;
      else scan.varints.push({ path: fieldPath, value });
    } else if (wire === 1) {
      state.index += 8;
    } else if (wire === 2) {
      const length = readVarint(bytes, state);
      if (length == null || state.index + length > bytes.length) {
        state.index = start + 1;
        continue;
      }
      const end = state.index + length;
      if (depth < 4) scanProtobuf(bytes.subarray(state.index, end), depth + 1, fieldPath, scan, order);
      state.index = end;
    } else if (wire === 5) {
      if (state.index + 4 > bytes.length) break;
      const view = new DataView(bytes.buffer, bytes.byteOffset + state.index, 4);
      scan.floats.push({ path: fieldPath, value: view.getFloat32(0, true), order: order.value++ });
      state.index += 4;
    } else {
      state.index = start + 1;
    }
  }
}
function grpcPayloads(bytes) {
  const payloads = [];
  let index = 0;
  while (index < bytes.length) {
    if (index + 5 > bytes.length) return [];
    const flags = bytes[index];
    const length = new DataView(bytes.buffer, bytes.byteOffset + index + 1, 4).getUint32(0, false);
    const start = index + 5;
    const end = start + length;
    if (end > bytes.length) return [];
    if ((flags & 128) === 0) payloads.push(bytes.subarray(start, end));
    index = end;
  }
  return payloads;
}
function looksLikeProtobuf(bytes) {
  const first = bytes[0];
  return bytes.length > 0 && first >> 3 > 0 && [0, 1, 2, 5].includes(first & 7);
}
function samePath(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function tierLabel(resetSeconds, nowSeconds) {
  if (resetSeconds != null) {
    const days = Math.round((resetSeconds - nowSeconds) / 86400);
    if (days >= 4 && days <= 12) return "7d";
    if (days >= 20 && days <= 45) return "30d";
  }
  return "Credits";
}
function parseGrokSubscription(bytes, nowSeconds = Math.floor(Date.now() / 1e3)) {
  let payloads = grpcPayloads(bytes);
  if (!payloads.length && looksLikeProtobuf(bytes)) payloads = [bytes];
  if (!payloads.length) return null;
  const scan = { floats: [], varints: [] };
  for (const payload of payloads) scanProtobuf(payload, 0, [], scan, { value: 0 });
  const percent = scan.floats.filter((item) => item.path.at(-1) === 1 && Number.isFinite(item.value) && item.value >= 0 && item.value <= 100).sort((left, right) => left.path.length - right.path.length || left.order - right.order)[0]?.value;
  const resets = scan.varints.filter((item) => item.value >= 17e8 && item.value <= 21e8 && item.value > nowSeconds).sort((left, right) => {
    const leftExact = samePath(left.path, [1, 5, 1]) ? 0 : 1;
    const rightExact = samePath(right.path, [1, 5, 1]) ? 0 : 1;
    return leftExact - rightExact || left.value - right.value;
  });
  const reset = resets[0]?.value ?? null;
  const hasPeriod = scan.varints.some(
    (item) => item.path[0] === 1 && item.path[1] === 6 || samePath(item.path, [1, 8, 1]) && (item.value === 1 || item.value === 2)
  );
  const used = percent ?? (!scan.floats.length && reset != null && hasPeriod ? 0 : null);
  if (used == null) return null;
  return {
    mode: "subscription",
    quota: {
      provider: "xai",
      windows: [
        {
          label: tierLabel(reset, nowSeconds),
          remainingPercent: Math.max(0, Math.min(100, 100 - used)),
          resetMs: reset == null ? null : reset * 1e3
        }
      ]
    }
  };
}
async function fetchGrokSubscription(accessToken, request = fetch) {
  if (!accessToken) return null;
  const response = await request(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Origin: "https://grok.com",
      Referer: "https://grok.com/?_s=usage",
      Accept: "*/*",
      "Content-Type": "application/grpc-web+proto",
      "x-grpc-web": "1",
      "x-user-agent": "connect-es/2.1.1",
      "User-Agent": "claude-line"
    },
    body: new Uint8Array(5),
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok || (response.headers.get("grpc-status") ?? "0") !== "0") return null;
  return parseGrokSubscription(new Uint8Array(await response.arrayBuffer()));
}

// ../packages/shared/provider-usage.ts
function detectProviderKind(baseUrl) {
  return findProviderByUrl(baseUrl)?.queryKind ?? "unknown";
}
function numberValue3(value) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function currencyValue(value, fallback) {
  const currency = String(value).toUpperCase();
  if (currency === "USD" || currency === "CNY") return currency;
  return fallback;
}
function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}
function resetTime2(value) {
  const numeric = numberValue3(value);
  if (numeric != null) {
    if (numeric <= 0) return null;
    return numeric < 1e12 ? numeric * 1e3 : numeric;
  }
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function remainingWindow(label, remainingPercent, reset) {
  return { label, remainingPercent: clampPercent(remainingPercent), resetMs: resetTime2(reset) };
}
function usageWindow(label, used, limit, reset) {
  const usedValue = numberValue3(used);
  const limitValue = numberValue3(limit);
  if (usedValue == null || limitValue == null || limitValue <= 0) return null;
  return remainingWindow(label, 100 - usedValue / limitValue * 100, reset);
}
function parseStepFunBalance(json) {
  const amount = numberValue3(json?.balance);
  return amount == null ? null : { amount, currency: "CNY" };
}
function parseSiliconFlowBalance(json, international) {
  const amount = numberValue3(json?.data?.totalBalance);
  if (amount == null) return null;
  return { amount, currency: international ? "USD" : "CNY" };
}
function parseOpenRouterBalance(json) {
  const data = json?.data ?? json;
  const total = numberValue3(data?.total_credits);
  const used = numberValue3(data?.total_usage);
  if (total == null || used == null) return null;
  return { amount: total - used, currency: "USD" };
}
function parseNovitaBalance(json) {
  const units = numberValue3(json?.availableBalance);
  return units == null ? null : { amount: units / 1e4, currency: "USD" };
}
function parseKimiQuota(json) {
  const windows = [];
  const detail = Array.isArray(json?.limits) ? json.limits.map((item) => item?.detail).find((item) => item && numberValue3(item.limit) != null) : null;
  if (detail) {
    const limit = numberValue3(detail.limit);
    const remaining = numberValue3(detail.remaining);
    if (limit != null && limit > 0 && remaining != null) {
      windows.push(remainingWindow("5h", remaining / limit * 100, detail.resetTime));
    }
  }
  const weeklyLimit = numberValue3(json?.usage?.limit);
  const weeklyRemaining = numberValue3(json?.usage?.remaining);
  if (weeklyLimit != null && weeklyLimit > 0 && weeklyRemaining != null) {
    windows.push(remainingWindow("7d", weeklyRemaining / weeklyLimit * 100, json.usage.resetTime));
  }
  return windows.length > 0 ? { provider: "kimi", windows } : null;
}
function parseMiniMaxQuota(json) {
  if (numberValue3(json?.base_resp?.status_code) != null && numberValue3(json.base_resp.status_code) !== 0) {
    return null;
  }
  const item = Array.isArray(json?.model_remains) ? json.model_remains.find((entry) => entry?.model_name === "general") : null;
  if (!item) return null;
  const windows = [];
  const interval = numberValue3(item.current_interval_remaining_percent);
  if (interval != null) windows.push(remainingWindow("5h", interval, item.end_time));
  if (numberValue3(item.current_weekly_status) === 1) {
    const weekly = numberValue3(item.current_weekly_remaining_percent);
    if (weekly != null) windows.push(remainingWindow("7d", weekly, item.weekly_end_time));
  }
  return windows.length > 0 ? { provider: "minimax", windows } : null;
}
function parseZenMuxQuota(json) {
  if (json?.success !== true || !json?.data) return null;
  const windows = [];
  for (const [field, label] of [
    ["quota_5_hour", "5h"],
    ["quota_7_day", "7d"]
  ]) {
    const item = json.data[field];
    const usedRatio = numberValue3(item?.usage_percentage);
    if (usedRatio != null) windows.push(remainingWindow(label, 100 - usedRatio * 100, item.resets_at));
  }
  return windows.length > 0 ? { provider: "zenmux", windows } : null;
}
function sub2ApiSubscriptionWindows(subscription) {
  const weeklyStart = resetTime2(subscription?.weekly_window_start);
  const weeklyReset = weeklyStart == null ? null : weeklyStart + 7 * 864e5;
  return [
    usageWindow("1d", subscription?.daily_usage_usd, subscription?.daily_limit_usd, null),
    usageWindow("7d", subscription?.weekly_usage_usd, subscription?.weekly_limit_usd, weeklyReset),
    usageWindow("30d", subscription?.monthly_usage_usd, subscription?.monthly_limit_usd, subscription?.expires_at)
  ].filter((window2) => window2 != null);
}
function sub2ApiRateWindows(rateLimits) {
  if (!Array.isArray(rateLimits)) return [];
  return rateLimits.map((item) => usageWindow(String(item?.window ?? ""), item?.used, item?.limit, item?.reset_at)).filter((window2) => window2 != null && window2.label.length > 0);
}
function parseSub2ApiUsage(json, provider = "apikey.fun") {
  if (!json || json.isValid === false || json.error) return null;
  const subscriptionWindows = sub2ApiSubscriptionWindows(json.subscription);
  const rateWindows = sub2ApiRateWindows(json.rate_limits);
  const windows = [...subscriptionWindows, ...rateWindows];
  const quotaRemaining = numberValue3(json?.quota?.remaining);
  const walletRemaining = numberValue3(json?.remaining) ?? numberValue3(json?.balance);
  const amount = quotaRemaining ?? walletRemaining;
  const balance = amount == null ? void 0 : { amount, currency: currencyValue(json?.quota?.unit ?? json?.unit, "USD") };
  if (windows.length > 0) {
    return {
      mode: balance ? "hybrid" : "subscription",
      balance,
      quota: { provider, windows }
    };
  }
  return balance ? { mode: "api", balance } : null;
}
async function requestJson(url, apiKey, request) {
  const response = await request(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}
function matchesConfiguredHost(hostname, pattern) {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return false;
  if (!normalized.startsWith("*.")) return hostname === normalized;
  const parent = normalized.slice(2);
  return hostname === parent || hostname.endsWith(`.${parent}`);
}
function findProviderQueryConfig(baseUrl, configs) {
  let hostname;
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  return configs.find(
    (config) => Array.isArray(config?.matchHosts) && config.matchHosts.some(
      (pattern) => typeof pattern === "string" ? matchesConfiguredHost(hostname, pattern) : false
    )
  ) ?? null;
}
function appendQueryPath(baseUrl, path) {
  try {
    const url = new URL(baseUrl);
    const basePath = url.pathname.replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    url.pathname = `${basePath}${suffix}`.replace(/\/{2,}/g, "/");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}
async function requestConfiguredJson(url, headers, request) {
  const response = await request(url, {
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}
async function fetchConfiguredProviderUsage(config, inferenceBaseUrl, inferenceApiKey, request = fetch) {
  const queryBaseUrl = String(config.baseUrl || inferenceBaseUrl).replace(/\/+$/, "");
  try {
    if (new URL(queryBaseUrl).protocol !== "https:") return null;
  } catch {
    return null;
  }
  const providerId = String(config.id || findProviderByUrl(inferenceBaseUrl)?.id || "relay");
  const providerLabel = String(config.displayName || providerId);
  if (config.protocol === "new-api") {
    if (!config.accessToken || !config.userId) return null;
    const url = appendQueryPath(queryBaseUrl, config.path || "/api/user/self");
    if (!url) return null;
    const json = await requestConfiguredJson(
      url,
      {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "New-Api-User": config.userId
      },
      request
    );
    if (json?.success !== true || !json?.data) return null;
    const amount = numberValue3(json.data.quota);
    if (amount == null) return null;
    return {
      mode: "api",
      balance: { amount: amount / 5e5, currency: config.currency ?? "USD" }
    };
  }
  if (config.protocol === "zenmux") {
    if (!config.baseUrl) return null;
    const apiKey2 = config.apiKey || (sameOrigin(queryBaseUrl, inferenceBaseUrl) ? inferenceApiKey : "");
    if (!apiKey2) return null;
    const json = await requestConfiguredJson(queryBaseUrl, { Authorization: `Bearer ${apiKey2}` }, request);
    const quota = parseZenMuxQuota(json);
    return quota ? { mode: "subscription", quota } : null;
  }
  const apiKey = config.apiKey || (sameOrigin(queryBaseUrl, inferenceBaseUrl) ? inferenceApiKey : "");
  if (!apiKey) return null;
  if (config.protocol === "sub2api") {
    let protocolBase = queryBaseUrl;
    try {
      protocolBase = new URL(queryBaseUrl).origin;
    } catch {
      return null;
    }
    const url = appendQueryPath(protocolBase, config.path || "/v1/usage");
    if (!url) return null;
    const json = await requestConfiguredJson(url, { Authorization: `Bearer ${apiKey}` }, request);
    return parseSub2ApiUsage(json, providerLabel);
  }
  if (config.protocol === "generic-balance") {
    const url = appendQueryPath(queryBaseUrl, config.path || "/user/balance");
    if (!url) return null;
    const json = await requestConfiguredJson(url, { Authorization: `Bearer ${apiKey}` }, request);
    if (!json || json.is_active === false || json.isValid === false) return null;
    const amount = numberValue3(json.balance ?? json?.data?.balance);
    return amount == null ? null : { mode: "api", balance: { amount, currency: config.currency ?? "USD" } };
  }
  return null;
}
function sub2ApiUsageUrl(baseUrl) {
  try {
    return `${new URL(baseUrl).origin}/v1/usage`;
  } catch {
    return null;
  }
}
async function fetchProviderUsage(kind, baseUrl, apiKey, request = fetch, options = {}) {
  if (options.query) {
    return fetchConfiguredProviderUsage(options.query, baseUrl, apiKey, request);
  }
  if (kind === "claude-subscription") {
    return fetchClaudeSubscription(options.oauthToken ?? "", request).catch(() => null);
  }
  if (kind === "codex-subscription") {
    return fetchCodexSubscription(options.oauthToken ?? "", options.accountId, request).catch(() => null);
  }
  if (kind === "gemini-subscription") {
    return fetchGeminiSubscription(options.oauthToken ?? "", request).catch(() => null);
  }
  if (kind === "copilot-subscription") {
    return fetchCopilotSubscription(
      options.oauthToken ?? "",
      options.githubDomain ?? "github.com",
      request
    ).catch(() => null);
  }
  if (kind === "grok-subscription") {
    return fetchGrokSubscription(options.oauthToken ?? "", request).catch(() => null);
  }
  if (kind === "unknown" || !apiKey && kind !== "volcengine") return null;
  if (kind === "zhipu") {
    const team = options.credentials?.zhipuTeam;
    if (team) {
      const quota2 = await fetchZhipuTeamQuota(
        apiKey,
        team.organizationId,
        team.projectId,
        request
      ).catch(() => null);
      return quota2 ? { mode: "subscription", quota: quota2 } : null;
    }
    const quota = await fetchZhipuQuota(baseUrl, apiKey, request).catch(() => null);
    if (quota) return { mode: "subscription", quota };
    if (new URL(baseUrl).hostname === "api.z.ai") return null;
    const amount = await fetchZhipuBalance(apiKey, request).catch(() => null);
    return amount == null ? null : { mode: "api", balance: { amount, currency: "CNY" } };
  }
  if (kind === "deepseek") {
    const balance = await fetchDeepSeekBalance(apiKey, request).catch(() => null);
    return balance ? { mode: "api", balance } : null;
  }
  if (kind === "volcengine") {
    const credentials = options.credentials?.volcengine;
    if (!credentials) return null;
    const quota = await fetchVolcengineQuota(
      baseUrl,
      credentials.accessKeyId,
      credentials.secretAccessKey,
      request
    ).catch(() => null);
    return quota ? { mode: "subscription", quota } : null;
  }
  let url;
  if (kind === "kimi") url = "https://api.kimi.com/coding/v1/usages";
  else if (kind === "minimax-cn") url = "https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains";
  else if (kind === "minimax-en") url = "https://api.minimax.io/v1/api/openplatform/coding_plan/remains";
  else if (kind === "stepfun") url = "https://api.stepfun.com/v1/accounts";
  else if (kind === "siliconflow-cn") url = "https://api.siliconflow.cn/v1/user/info";
  else if (kind === "siliconflow-en") url = "https://api.siliconflow.com/v1/user/info";
  else if (kind === "openrouter") url = "https://openrouter.ai/api/v1/credits";
  else if (kind === "novita") url = "https://api.novita.ai/v3/user/balance";
  else {
    const usageUrl = sub2ApiUsageUrl(baseUrl);
    if (!usageUrl) return null;
    url = usageUrl;
  }
  const json = await requestJson(url, apiKey, request);
  if (kind === "kimi") {
    const quota = parseKimiQuota(json);
    return quota ? { mode: "subscription", quota } : null;
  }
  if (kind === "minimax-cn" || kind === "minimax-en") {
    const quota = parseMiniMaxQuota(json);
    return quota ? { mode: "subscription", quota } : null;
  }
  if (kind === "stepfun") {
    const balance = parseStepFunBalance(json);
    return balance ? { mode: "api", balance } : null;
  }
  if (kind === "siliconflow-cn" || kind === "siliconflow-en") {
    const balance = parseSiliconFlowBalance(json, kind === "siliconflow-en");
    return balance ? { mode: "api", balance } : null;
  }
  if (kind === "openrouter") {
    const balance = parseOpenRouterBalance(json);
    return balance ? { mode: "api", balance } : null;
  }
  if (kind === "novita") {
    const balance = parseNovitaBalance(json);
    return balance ? { mode: "api", balance } : null;
  }
  return parseSub2ApiUsage(json);
}

// ../packages/shared/provider-display.ts
var QUERY_DISPLAY_NAMES = {
  zhipu: "Zhipu",
  "z.ai": "Zhipu",
  kimi: "Kimi",
  minimax: "MiniMax",
  "minimax-cn": "MiniMax",
  "minimax-en": "MiniMax",
  zenmux: "ZenMux",
  deepseek: "DeepSeek",
  stepfun: "StepFun",
  siliconflow: "SiliconFlow",
  "siliconflow-cn": "SiliconFlow",
  "siliconflow-en": "SiliconFlow",
  openrouter: "OpenRouter",
  novita: "Novita",
  sub2api: "Sub2API",
  "apikey.fun": "ApiKey"
};
function displayProviderName(providerId) {
  const normalized = providerId.toLowerCase();
  return QUERY_DISPLAY_NAMES[normalized] ?? findProviderById(normalized)?.displayName ?? providerId;
}

// ../packages/usage-core/index.ts
function normalizeEndpoint(endpoint) {
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
function resolveProviderMetadata(endpoint, providerHint = "") {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const catalog = (normalizedEndpoint ? findProviderByUrl(normalizedEndpoint) : void 0) ?? (providerHint ? findProviderById(providerHint) : void 0);
  const providerId = catalog?.brandId ?? (providerHint.trim() || "unknown");
  return {
    providerId,
    brandName: catalog?.displayName ?? displayProviderName(providerId)
  };
}
function clampPercent2(value) {
  return Math.max(0, Math.min(100, value));
}
var MAX_QUOTA_WINDOW_LABEL_LENGTH = 24;
function sanitizeQuotaWindowLabel(label) {
  const safe = String(label ?? "").replace(/(?:\x1b[\]PX^_]|[\u0090\u009d\u009e\u009f])[\s\S]*?(?:\x07|\x1b\\|\u009c)/g, "").replace(/(?:\x1b[\]PX^_]|[\u0090\u009d\u009e\u009f])[\s\S]*$/g, "").replace(/(?:\x1b\[|\u009b)[0-?]*[ -\/]*[@-~]/g, "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  return [...safe || "Quota"].slice(0, MAX_QUOTA_WINDOW_LABEL_LENGTH).join("");
}
function normalizeUsageSnapshot(input) {
  return {
    provider: {
      id: input.providerId,
      brandName: input.brandName ?? displayProviderName(input.providerId)
    },
    billingMode: input.billingMode,
    balance: input.balance ?? null,
    windows: (input.windows ?? []).map((window2) => ({
      label: sanitizeQuotaWindowLabel(window2.label),
      remainingPercent: clampPercent2(window2.remainingPercent),
      resetMs: window2.resetMs
    })),
    fetchedAt: input.fetchedAt ?? Date.now(),
    freshness: "fresh"
  };
}
function markUsageSnapshotStale(snapshot) {
  return snapshot.freshness === "stale" ? snapshot : { ...snapshot, freshness: "stale" };
}

// ../packages/usage-node/index.ts
var DEFAULT_KEEP_LAST_GOOD_MS = 10 * 6e4;
var DEFAULT_RETRY_BACKOFF_MS = 3e4;
function isUsageSnapshot(value) {
  if (!value || typeof value !== "object") return false;
  const snapshot = value;
  const balanceValid = snapshot.balance === null || !!snapshot.balance && Number.isFinite(snapshot.balance.amount) && (snapshot.balance.currency === "CNY" || snapshot.balance.currency === "USD");
  const windowsValid = Array.isArray(snapshot.windows) && snapshot.windows.every((window2) => typeof window2?.label === "string" && Number.isFinite(window2?.remainingPercent) && (window2?.resetMs === null || Number.isFinite(window2?.resetMs)));
  return typeof snapshot.provider?.id === "string" && typeof snapshot.provider?.brandName === "string" && ["subscription", "api", "hybrid", "unknown"].includes(snapshot.billingMode ?? "") && balanceValid && windowsValid && typeof snapshot.fetchedAt === "number" && Number.isFinite(snapshot.fetchedAt) && (snapshot.freshness === "fresh" || snapshot.freshness === "stale");
}
var FileUsageSnapshotCache = class {
  root;
  constructor(root) {
    this.root = root;
  }
  path(identityKey) {
    const fingerprint = createHash2("sha256").update(identityKey).digest("hex");
    return join(this.root, `${fingerprint}.json`);
  }
  read(identityKey) {
    try {
      const value = JSON.parse(readFileSync(this.path(identityKey), "utf8"));
      return isUsageSnapshot(value) ? value : null;
    } catch {
      return null;
    }
  }
  write(identityKey, snapshot) {
    const target = this.path(identityKey);
    const temporary = `${target}.${process.pid}-${Date.now()}.tmp`;
    try {
      mkdirSync(this.root, { recursive: true });
      writeFileSync(temporary, JSON.stringify(snapshot), { encoding: "utf8", mode: 384 });
      renameSync(temporary, target);
    } catch {
      try {
        unlinkSync(temporary);
      } catch {
      }
    }
  }
};
function createProviderAccess(input) {
  const endpoint = normalizeEndpoint(input.endpoint);
  const metadata = resolveProviderMetadata(endpoint, input.providerId);
  const stableOAuthAccount = input.authKind === "oauth" && input.accountId ? input.accountId : null;
  const accountFingerprint = createHash2("sha256").update(JSON.stringify({
    credential: stableOAuthAccount ? null : input.credential,
    query: input.query ?? null,
    credentials: input.credentials ?? null,
    accountId: stableOAuthAccount,
    githubDomain: input.githubDomain ?? null
  })).digest("hex").slice(0, 16);
  return {
    identity: {
      providerId: metadata.providerId,
      endpoint,
      accountFingerprint
    },
    credential: input.credential,
    options: input.authKind || input.query || input.credentials || input.accountId || input.githubDomain ? {
      authKind: input.authKind,
      accountId: input.accountId,
      githubDomain: input.githubDomain,
      query: input.query,
      credentials: input.credentials
    } : void 0
  };
}
function providerAccessKey(access) {
  const identity = access.identity;
  return `${identity.providerId}:${identity.endpoint}:${identity.accountFingerprint}`;
}
function resolveQueryKind(access) {
  const endpointKind = findProviderByUrl(access.identity.endpoint)?.queryKind ?? detectProviderKind(access.identity.endpoint);
  if (endpointKind !== "unknown") return endpointKind;
  if (!access.identity.endpoint && access.options?.authKind === "oauth") {
    return findProviderById(access.identity.providerId)?.queryKind ?? "unknown";
  }
  return "unknown";
}
async function queryProviderUsage(access, request = fetch) {
  const kind = resolveQueryKind(access);
  const explicitQuery = access.options?.query ?? null;
  if (!explicitQuery && kind === "unknown") return { status: "unsupported" };
  if (!explicitQuery && kind.endsWith("-subscription") && access.options?.authKind !== "oauth") {
    return { status: "unsupported" };
  }
  if (!explicitQuery && !access.credential && kind !== "volcengine") return { status: "unsupported" };
  const usage = await fetchProviderUsage(
    kind,
    access.identity.endpoint,
    access.credential,
    request,
    {
      oauthToken: access.options?.authKind === "oauth" ? access.credential : void 0,
      accountId: access.options?.accountId,
      githubDomain: access.options?.githubDomain,
      query: explicitQuery ?? void 0,
      credentials: access.options?.credentials
    }
  ).catch(() => null);
  if (!usage) return { status: "failed" };
  const providerId = usage.quota?.provider ?? explicitQuery?.id ?? access.identity.providerId;
  const metadata = resolveProviderMetadata(access.identity.endpoint, providerId);
  return {
    status: "success",
    snapshot: normalizeUsageSnapshot({
      providerId: metadata.providerId,
      brandName: explicitQuery?.displayName ?? metadata.brandName,
      billingMode: usage.mode,
      balance: usage.balance,
      windows: usage.quota?.windows
    })
  };
}
var UsageRuntime = class {
  keepLastGoodMs;
  retryBackoffMs;
  query;
  onChange;
  now;
  cache;
  inFlight = /* @__PURE__ */ new Map();
  retryAfter = /* @__PURE__ */ new Map();
  state = { status: "idle", provider: null, snapshot: null };
  activeKey = "";
  revision = 0;
  disposed = false;
  constructor(options = {}) {
    this.keepLastGoodMs = options.keepLastGoodMs ?? DEFAULT_KEEP_LAST_GOOD_MS;
    this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.query = options.query ?? ((access) => queryProviderUsage(access));
    this.onChange = options.onChange ?? (() => {
    });
    this.now = options.now ?? Date.now;
    this.cache = options.cache;
  }
  getState() {
    return this.state;
  }
  update(state) {
    if (this.disposed) return;
    this.state = state;
    this.onChange(state);
  }
  async refresh(access) {
    if (this.disposed) return;
    const revision = ++this.revision;
    if (!access) {
      this.activeKey = "";
      this.update({ status: "idle", provider: null, snapshot: null });
      return;
    }
    const key = providerAccessKey(access);
    const metadata = resolveProviderMetadata(access.identity.endpoint, access.identity.providerId);
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
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.revision += 1;
    this.inFlight.clear();
    this.retryAfter.clear();
  }
};

// adapter/provider-usage.ts
var OPENAI_AUTH_CLAIM = "https://api.openai.com/auth";
function extractCodexAccountId(providerId, credential) {
  if (providerId !== "openai-codex") return void 0;
  const payload = credential.split(".")[1];
  if (!payload) return void 0;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object") return void 0;
    const auth = claims[OPENAI_AUTH_CLAIM];
    if (!auth || typeof auth !== "object") return void 0;
    const accountId = auth.chatgpt_account_id;
    return typeof accountId === "string" && accountId.trim() ? accountId : void 0;
  } catch {
    return void 0;
  }
}
async function resolvePiProviderAccess(ctx, model = ctx.model, config = {}) {
  if (!model) return null;
  try {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) return null;
    const credential = auth.apiKey ?? "";
    const endpoint = auth.baseUrl ?? model.baseUrl;
    return createProviderAccess({
      providerId: model.provider,
      endpoint,
      credential,
      authKind: ctx.modelRegistry.isUsingOAuth(model) ? "oauth" : "api-key",
      accountId: extractCodexAccountId(model.provider, credential),
      githubDomain: config.githubDomain,
      query: findProviderQueryConfig(endpoint, config.queries ?? []),
      credentials: config.credentials
    });
  } catch {
    return null;
  }
}
var PiProviderUsageController = class {
  ctx;
  runtime;
  resolveAccess;
  accessConfig;
  refreshMs;
  interval;
  activeModelKey = "";
  activeAccessKey = "";
  revision = 0;
  disposed = false;
  constructor(ctx, onChange, options = {}) {
    this.ctx = ctx;
    this.refreshMs = options.refreshMs ?? 6e4;
    this.resolveAccess = options.resolveAccess ?? resolvePiProviderAccess;
    this.accessConfig = options.accessConfig ?? {};
    this.runtime = options.runtime ?? new UsageRuntime({
      onChange,
      cache: new FileUsageSnapshotCache(join2(homedir(), ".pi", "agent", "cache", "pi-tui", "usage"))
    });
  }
  getState() {
    return this.runtime.getState();
  }
  start() {
    if (this.disposed || this.interval) return Promise.resolve();
    const initialRefresh = this.refresh();
    this.interval = setInterval(() => void this.refresh(), this.refreshMs);
    this.interval.unref?.();
    return initialRefresh;
  }
  async refresh(model = this.ctx.model, isolateIdentity = false) {
    if (this.disposed) return;
    const revision = ++this.revision;
    const modelKey = model ? `${model.provider}\0${model.id}\0${model.baseUrl}` : "";
    if (modelKey !== this.activeModelKey || isolateIdentity) {
      this.activeModelKey = modelKey;
      this.activeAccessKey = "";
      await this.runtime.refresh(null);
      if (this.disposed || revision !== this.revision) return;
    }
    const access = await this.resolveAccess(this.ctx, model, this.accessConfig);
    if (this.disposed || revision !== this.revision) return;
    const accessKey = access ? providerAccessKey(access) : "";
    if (this.activeAccessKey && accessKey !== this.activeAccessKey) {
      await this.runtime.refresh(null);
      if (this.disposed || revision !== this.revision) return;
    }
    this.activeAccessKey = accessKey;
    await this.runtime.refresh(access);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.revision += 1;
    if (this.interval) clearInterval(this.interval);
    this.interval = void 0;
    this.runtime.dispose();
  }
};

// renderer/custom-header.ts
import { truncateToWidth as truncateToWidth2, visibleWidth as visibleWidth4 } from "@earendil-works/pi-tui";

// status/project-status.ts
import { posix, win32 } from "node:path";
import { stripTerminalSequences, visibleWidth as visibleWidth3 } from "@earendil-works/pi-tui";

// renderer/icons.ts
import { visibleWidth } from "@earendil-works/pi-tui";
var NERD_GLYPHS = Object.freeze({
  brand: "\uF487",
  project: "\uF115",
  runtime: "\uF487",
  gitBranch: "\uE0A0",
  model: "\u{F06A9}",
  thinking: "\uF1CC",
  context: "\uF080",
  duration: "\uF252",
  latency: "\u23F3",
  speed: "\uF0E7",
  session: "\uF4B6",
  inputTokens: "\uF062",
  outputTokens: "\uF063",
  cache: "\uF021",
  cost: "\uF0D6",
  usage: "\u{1F4F6}",
  turns: "\u{1F4AC}",
  provider: "\uF1AD",
  compaction: "\u{1F4E6}",
  extensions: "\uF12E",
  changed: "+",
  untracked: "~",
  ahead: "\u2191",
  behind: "\u2193"
});
var UNICODE_GLYPHS = Object.freeze({
  brand: "\u25C7",
  project: "\u{1F4C2}",
  runtime: "\u25E9",
  gitBranch: "\u2387",
  model: "\u25C6",
  thinking: "\u2726",
  context: "\u{1FA9F}",
  duration: "\u23F1\uFE0F",
  latency: "\u23F3",
  speed: "\u26A1",
  session: "\u25CF",
  inputTokens: "\u2191",
  outputTokens: "\u2193",
  cache: "\u21BB",
  cost: "\xA4",
  usage: "\u{1F4F6}",
  turns: "\u{1F4AC}",
  provider: "\u25C8",
  compaction: "\u{1F4E6}",
  extensions: "\u25C7",
  changed: "+",
  untracked: "~",
  ahead: "\u2191",
  behind: "\u2193"
});
var ASCII_GLYPHS = Object.freeze({
  brand: "pi",
  project: "dir",
  runtime: "runtime",
  gitBranch: "git",
  model: "model",
  thinking: "think",
  context: "ctx",
  duration: "time",
  latency: "~",
  speed: ">",
  session: "session",
  inputTokens: "in",
  outputTokens: "out",
  cache: "cache",
  cost: "$",
  usage: "sig",
  turns: "msg",
  provider: "provider",
  compaction: "cmp",
  extensions: "ext",
  changed: "+",
  untracked: "~",
  ahead: "^",
  behind: "v"
});
function formatLeadingIcon(glyph) {
  return `${glyph}${" ".repeat(Math.max(1, 3 - visibleWidth(glyph)))}`;
}
function isAsciiOnlyTerminal(env) {
  const locale = env.LC_ALL ?? env.LC_CTYPE ?? env.LANG;
  return /^(?:c|posix)$/i.test(locale?.trim() ?? "");
}
function resolveIconMode(mode, env = process.env) {
  if (mode !== "auto") return mode;
  if (isAsciiOnlyTerminal(env)) return "ascii";
  return "unicode";
}
function resolveGlyphs(mode, env = process.env) {
  switch (resolveIconMode(mode, env)) {
    case "nerd":
      return NERD_GLYPHS;
    case "ascii":
      return ASCII_GLYPHS;
    default:
      return UNICODE_GLYPHS;
  }
}

// status/status-segments.ts
import { truncateToWidth, visibleWidth as visibleWidth2 } from "@earendil-works/pi-tui";
var SEGMENT_SEPARATOR = " \xB7 ";
var EDITOR_STATUS_CHROME_WIDTH = 11;
function renderSide(states, side) {
  return states.filter((state) => state.side === side && !state.hidden && state.text).map((state) => state.text).join(side === "right" ? " " : SEGMENT_SEPARATOR);
}
function layoutWidth(layout) {
  const gap = layout.left && layout.right ? 1 : 0;
  return visibleWidth2(layout.left) + visibleWidth2(layout.right) + gap;
}
function renderLayout(states) {
  return {
    left: renderSide(states, "left"),
    right: renderSide(states, "right")
  };
}
function nextReduction(states) {
  return states.filter((state) => {
    if (state.hidden) return false;
    const compact = state.segment.compactText;
    return !state.compacted && compact !== void 0 && compact !== state.text || !state.segment.required;
  }).sort(
    (left, right) => right.segment.priority - left.segment.priority || left.order - right.order
  )[0];
}
function reduceState(state) {
  const compact = state.segment.compactText;
  if (!state.compacted && compact !== void 0 && compact !== state.text) {
    state.text = compact;
    state.compacted = true;
    return;
  }
  state.hidden = true;
}
function truncateRequiredLayout(layout, budget) {
  if (budget <= 0) return { left: "", right: "" };
  if (!layout.left) return { left: "", right: truncateToWidth(layout.right, budget, "") };
  if (!layout.right) return { left: truncateToWidth(layout.left, budget, "\u2026"), right: "" };
  const rightBudget = Math.min(visibleWidth2(layout.right), Math.max(1, Math.floor(budget * 0.4)));
  const right = truncateToWidth(layout.right, rightBudget, "");
  const leftBudget = Math.max(0, budget - visibleWidth2(right) - 1);
  return {
    left: truncateToWidth(layout.left, leftBudget, "\u2026"),
    right
  };
}
function layoutEditorStatus(left, right, terminalWidth) {
  const budget = Math.max(0, terminalWidth - EDITOR_STATUS_CHROME_WIDTH);
  const states = [
    ...left.map((segment, order) => ({
      segment,
      side: "left",
      order,
      text: segment.text,
      compacted: false,
      hidden: !segment.text
    })),
    ...right.map((segment, order) => ({
      segment,
      side: "right",
      order: left.length + order,
      text: segment.text,
      compacted: false,
      hidden: !segment.text
    }))
  ];
  let layout = renderLayout(states);
  while (layoutWidth(layout) > budget) {
    const candidate = nextReduction(states);
    if (!candidate) break;
    reduceState(candidate);
    layout = renderLayout(states);
  }
  return layoutWidth(layout) <= budget ? layout : truncateRequiredLayout(layout, budget);
}
var THINKING_COLORS = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  xhigh: "thinkingXhigh",
  max: "thinkingMax"
};
function thinkingStatusColor(level) {
  return THINKING_COLORS[level ?? "off"] ?? "thinkingOff";
}
function cacheHitStatusColor(percent) {
  if (percent === null || percent === void 0 || !Number.isFinite(percent) || percent < 0) return "muted";
  if (percent < 30) return "error";
  if (percent < 70) return "warning";
  if (percent < 90) return "accent";
  return "success";
}
function contextUsageStatusColor(percent) {
  if (percent === null || percent === void 0 || !Number.isFinite(percent) || percent <= 0) return "muted";
  if (percent <= 10) return "success";
  if (percent <= 30) return "accent";
  if (percent <= 60) return "warning";
  return "error";
}
function turnStatusColor(turns) {
  if (!Number.isFinite(turns) || turns <= 10) return "muted";
  if (turns <= 20) return "success";
  if (turns < 40) return "warning";
  return "error";
}
function compactionStatusColor(compactions) {
  if (!Number.isFinite(compactions) || compactions <= 0) return "muted";
  if (compactions === 1) return "success";
  if (compactions === 2) return "accent";
  if (compactions === 3) return "warning";
  return "error";
}
function durationStatusColor(state) {
  if (state === "working") return "accent";
  if (state === "done") return "success";
  return "dim";
}
function formatElapsed(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1e3));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 1) return `${seconds}s`;
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
var TurnTimerController = class {
  requestRender;
  intervalMs;
  now;
  startedAt;
  completedElapsedMs;
  interval;
  disposed = false;
  constructor(requestRender, intervalMs = 1e3, now = Date.now, completedElapsedMs) {
    this.requestRender = requestRender;
    this.intervalMs = intervalMs;
    this.now = now;
    if (Number.isFinite(completedElapsedMs) && (completedElapsedMs ?? -1) >= 0) {
      this.completedElapsedMs = completedElapsedMs;
    }
  }
  start() {
    if (this.disposed) return;
    this.stopInterval();
    this.startedAt = this.now();
    this.completedElapsedMs = void 0;
    this.interval = setInterval(() => this.requestRender(), this.intervalMs);
    this.interval.unref();
    this.requestRender();
  }
  end() {
    if (this.disposed || this.startedAt === void 0) return void 0;
    this.completedElapsedMs = Math.max(0, this.now() - this.startedAt);
    this.startedAt = void 0;
    this.stopInterval();
    this.requestRender();
    return this.completedElapsedMs;
  }
  restore(elapsedMs) {
    if (this.disposed || !Number.isFinite(elapsedMs) || elapsedMs < 0) return;
    this.startedAt = void 0;
    this.completedElapsedMs = elapsedMs;
    this.stopInterval();
    this.requestRender();
  }
  getSnapshot() {
    if (this.startedAt !== void 0) {
      return {
        state: "working",
        elapsedMs: Math.max(0, this.now() - this.startedAt)
      };
    }
    if (this.completedElapsedMs !== void 0) {
      return { state: "done", elapsedMs: this.completedElapsedMs };
    }
    return { state: "idle", elapsedMs: 0 };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopInterval();
  }
  stopInterval() {
    if (this.interval) clearInterval(this.interval);
    this.interval = void 0;
  }
};

// status/project-status.ts
var SEPARATOR = " \xB7 ";
var MIN_SEGMENT_WIDTH = 8;
var DEFAULT_GLYPHS = resolveGlyphs("unicode");
var DEFAULT_PROJECT_STATUS_SEGMENTS = ["project", "git"];
var SAFE_SGR_SEQUENCE = /\x1b\[[0-9:;]*m/g;
var STYLE_MARKER_START = "\uFDD0";
var STYLE_MARKER_END = "\uFDD1";
var STYLE_MARKER_SEQUENCE = /\ufdd0(\d+)\ufdd1/g;
var ROLE_COLORS = {
  path: "text",
  separator: "text",
  branch: "accent",
  "branch-pending": "dim",
  changed: "success",
  untracked: "error",
  ahead: "warning",
  behind: "warning",
  duration: "dim",
  runtime: "success"
};
function sanitizeSingleLine(text) {
  return stripTerminalSequences(text).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/ +/g, " ").trim();
}
function sanitizeStyledSingleLine(text) {
  const styles = [];
  const input = text.replaceAll(STYLE_MARKER_START, "").replaceAll(STYLE_MARKER_END, "");
  const masked = input.replace(SAFE_SGR_SEQUENCE, (sequence) => {
    const index = styles.push(sequence) - 1;
    return `${STYLE_MARKER_START}${index}${STYLE_MARKER_END}`;
  });
  const restored = sanitizeSingleLine(masked).replace(
    STYLE_MARKER_SEQUENCE,
    (_match, index) => styles[Number(index)] ?? ""
  );
  if (!stripTerminalSequences(restored).trim()) return "";
  return styles.length > 0 ? `${restored}\x1B[0m` : restored;
}
function formatProjectPath(cwd, home) {
  const safeCwd = sanitizeSingleLine(cwd).replaceAll("\\", "/") || ".";
  if (!home) return safeCwd;
  const pathApi = win32.isAbsolute(cwd) || win32.isAbsolute(home) ? win32 : posix;
  const resolvedCwd = pathApi.resolve(cwd);
  const resolvedHome = pathApi.resolve(home);
  const relativeToHome = pathApi.relative(resolvedHome, resolvedCwd);
  const isInsideHome = relativeToHome === "" || relativeToHome !== ".." && !relativeToHome.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relativeToHome);
  if (!isInsideHome) return safeCwd;
  const displayRelative = sanitizeSingleLine(relativeToHome).replaceAll("\\", "/");
  return relativeToHome === "" ? "~" : `~/${displayRelative}`;
}
function truncateFromStart(text, width) {
  if (width <= 0) return "";
  if (visibleWidth3(text) <= width) return text;
  if (width === 1) return "\u2026";
  let suffix = "";
  for (const character of Array.from(text).reverse()) {
    if (visibleWidth3(`\u2026${character}${suffix}`) > width) break;
    suffix = `${character}${suffix}`;
  }
  return `\u2026${suffix}`;
}
function truncateFromEnd(text, width) {
  if (width <= 0) return "";
  if (visibleWidth3(text) <= width) return text;
  if (width === 1) return "\u2026";
  let prefix = "";
  for (const character of Array.from(text)) {
    if (visibleWidth3(`${prefix}${character}\u2026`) > width) break;
    prefix += character;
  }
  return `${prefix}\u2026`;
}
function fitProjectPath(path, width, glyphs) {
  const prefix = formatLeadingIcon(glyphs.project);
  const prefixWidth = visibleWidth3(prefix);
  if (width <= prefixWidth) return truncateFromEnd(glyphs.project, width);
  return `${prefix}${truncateFromStart(path, width - prefixWidth)}`;
}
function partsWidth(parts) {
  return parts.reduce((width, part) => width + visibleWidth3(part.text), 0);
}
function branchName(snapshot) {
  if (snapshot.detached || snapshot.branch === "detached" || snapshot.branch === "(detached)") {
    return "(detached)";
  }
  const branch = sanitizeSingleLine(snapshot.branch ?? "");
  return branch || null;
}
function projectGitParts(snapshot, glyphs) {
  const branch = branchName(snapshot);
  if (!branch) {
    if (snapshot.refreshState === "loading" || snapshot.refreshState === "idle") {
      return [{ text: `${glyphs.gitBranch} \u2026`, role: "branch-pending" }];
    }
    return [];
  }
  let changed = 0;
  let untracked = 0;
  for (const entry of snapshot.statusCodes ?? []) {
    if (entry.code === "?") untracked += entry.count;
    else changed += entry.count;
  }
  const parts = [
    { text: `${glyphs.gitBranch} ${branch}`, role: "branch" }
  ];
  if (changed > 0) parts.push({ text: ` ${glyphs.changed}${changed}`, role: "changed" });
  if (untracked > 0) parts.push({ text: ` ${glyphs.untracked}${untracked}`, role: "untracked" });
  if ((snapshot.ahead ?? 0) > 0) {
    parts.push({ text: ` ${glyphs.ahead}${snapshot.ahead}`, role: "ahead" });
  }
  if ((snapshot.behind ?? 0) > 0) {
    parts.push({ text: ` ${glyphs.behind}${snapshot.behind}`, role: "behind" });
  }
  return parts;
}
function projectRuntimeParts(snapshot, glyphs) {
  if (!snapshot.runtime) return [];
  const name = sanitizeSingleLine(snapshot.runtime.name);
  if (!name) return [];
  const version = sanitizeSingleLine(snapshot.runtime.version ?? "");
  return [{
    text: `${glyphs.runtime} ${name}${version ? ` ${version}` : ""}`,
    role: "runtime"
  }];
}
function projectDurationParts(snapshot, glyphs) {
  if (!snapshot.duration) return [];
  return [{
    text: `${glyphs.duration} ${formatElapsed(snapshot.duration.elapsedMs)}`,
    role: "duration"
  }];
}
function fitGitParts(snapshot, width, glyphs) {
  if (width <= 0) return [];
  const full = projectGitParts(snapshot, glyphs);
  if (partsWidth(full) <= width) return full;
  const branch = full[0];
  if (!branch) return [];
  const suffix = full.slice(1);
  while (suffix.length > 0 && visibleWidth3(`${glyphs.gitBranch} \u2026`) + partsWidth(suffix) > width) {
    suffix.pop();
  }
  const branchWidth = Math.max(1, width - partsWidth(suffix));
  return [{ ...branch, text: truncateFromEnd(branch.text, branchWidth) }, ...suffix];
}
function joinProjectStatusGroups(path, git, duration, runtime, order) {
  const groups = order.map((segment) => {
    if (segment === "project") return path;
    if (segment === "git") return git;
    if (segment === "duration") return duration;
    return runtime;
  }).filter((group) => group.length > 0);
  if (groups.length === 0) return [];
  return groups.flatMap((group, index) => index === 0 ? group : [{ text: SEPARATOR, role: "separator" }, ...group]);
}
function layoutProjectStatusLine(snapshot, width, home = process.env.HOME ?? process.env.USERPROFILE, glyphs = DEFAULT_GLYPHS, segments = DEFAULT_PROJECT_STATUS_SEGMENTS) {
  if (width <= 0) return [];
  const order = [...new Set(segments)].filter(
    (segment) => segment === "project" || segment === "git" || segment === "duration" || segment === "runtime"
  );
  const showPath = order.includes("project");
  const showGit = order.includes("git");
  const showDuration = order.includes("duration");
  const showRuntime = order.includes("runtime");
  if (!showPath && !showGit && !showDuration && !showRuntime) return [];
  const path = formatProjectPath(snapshot.cwd, home);
  const projectPath = `${formatLeadingIcon(glyphs.project)}${path}`;
  const fullPath = showPath ? [{ text: projectPath, role: "path" }] : [];
  const fullGit = showGit ? projectGitParts(snapshot, glyphs) : [];
  const fullDuration = showDuration ? projectDurationParts(snapshot, glyphs) : [];
  const fullRuntime = showRuntime ? projectRuntimeParts(snapshot, glyphs) : [];
  if (!showPath && fullGit.length === 0 && fullDuration.length === 0) {
    return fullRuntime.length > 0 ? [{ ...fullRuntime[0], text: truncateFromEnd(fullRuntime[0].text, width) }] : [];
  }
  const allGroups = joinProjectStatusGroups(fullPath, fullGit, fullDuration, fullRuntime, order);
  if (partsWidth(allGroups) <= width) return allGroups;
  if (fullDuration.length > 0) {
    const durationWidth = partsWidth(fullDuration);
    const baseWidth = width - durationWidth - visibleWidth3(SEPARATOR);
    if (baseWidth >= MIN_SEGMENT_WIDTH) {
      const baseOrder = order.filter(
        (segment) => segment === "project" || segment === "git"
      );
      const base = layoutProjectStatusLine(
        { ...snapshot, duration: void 0, runtime: void 0 },
        baseWidth,
        home,
        glyphs,
        baseOrder
      );
      if (base.length > 0) {
        return [...base, { text: SEPARATOR, role: "separator" }, ...fullDuration];
      }
    }
  }
  const reducedOrder = order.filter((segment) => segment !== "duration");
  if (fullGit.length === 0 && showPath) {
    return [{ text: fitProjectPath(path, width, glyphs), role: "path" }];
  }
  if (!showPath) return fitGitParts(snapshot, width, glyphs);
  const fullWidth = visibleWidth3(projectPath) + visibleWidth3(SEPARATOR) + partsWidth(fullGit);
  if (fullWidth <= width) {
    return joinProjectStatusGroups(fullPath, fullGit, [], [], reducedOrder);
  }
  const minProjectWidth = MIN_SEGMENT_WIDTH + visibleWidth3(formatLeadingIcon(glyphs.project));
  if (width < visibleWidth3(SEPARATOR) + MIN_SEGMENT_WIDTH * 2) {
    return [{ text: fitProjectPath(path, width, glyphs), role: "path" }];
  }
  const contentWidth = width - visibleWidth3(SEPARATOR);
  const gitBudget = contentWidth - minProjectWidth;
  const fittedGit = fitGitParts(snapshot, gitBudget, glyphs);
  const pathWidth = contentWidth - partsWidth(fittedGit);
  return joinProjectStatusGroups(
    [{ text: fitProjectPath(path, pathWidth, glyphs), role: "path" }],
    fittedGit,
    [],
    [],
    reducedOrder
  );
}
function renderProjectStatusLine(snapshot, width, theme, home = process.env.HOME ?? process.env.USERPROFILE, glyphs = DEFAULT_GLYPHS, segments = DEFAULT_PROJECT_STATUS_SEGMENTS) {
  return layoutProjectStatusLine(snapshot, width, home, glyphs, segments).map((part) => {
    if (part.role === "path" && part.text.startsWith(glyphs.project)) {
      return `${theme.fg("accent", glyphs.project)}${theme.fg(
        ROLE_COLORS.path,
        part.text.slice(glyphs.project.length)
      )}`;
    }
    return theme.fg(
      part.role === "duration" ? durationStatusColor(snapshot.duration?.state ?? "idle") : ROLE_COLORS[part.role],
      part.text
    );
  }).join("");
}
function parseGitStatusV2(stdout, exactTag) {
  const status = {
    branch: null,
    detached: false,
    unborn: false,
    ahead: 0,
    behind: 0,
    stashed: 0,
    statusCodes: [],
    dirty: false
  };
  const statusCodes = /* @__PURE__ */ new Map();
  const addStatusCode = (code, unmerged) => {
    const previous = statusCodes.get(code);
    if (previous) {
      previous.count += 1;
      previous.unmerged ||= unmerged;
      return;
    }
    statusCodes.set(code, { code, count: 1, unmerged });
  };
  for (const line of stdout.split("\n")) {
    if (line.startsWith("# branch.oid ")) {
      const value = line.slice("# branch.oid ".length).trim();
      if (value === "(initial)") status.unborn = true;
      else if (value) status.oid = value;
      continue;
    }
    if (line.startsWith("# branch.head ")) {
      const value = sanitizeSingleLine(line.slice("# branch.head ".length));
      status.detached = value === "(detached)";
      status.branch = status.detached ? null : value || null;
      continue;
    }
    if (line.startsWith("# branch.upstream ")) {
      status.upstream = sanitizeSingleLine(line.slice("# branch.upstream ".length)) || void 0;
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const match = line.match(/^# branch\.ab \+(\d+) -(\d+)$/);
      if (match) {
        status.ahead = Number.parseInt(match[1] ?? "0", 10);
        status.behind = Number.parseInt(match[2] ?? "0", 10);
      }
      continue;
    }
    if (line.startsWith("# stash ")) {
      const count = Number.parseInt(line.slice("# stash ".length).trim(), 10);
      if (Number.isFinite(count)) status.stashed = count;
      continue;
    }
    const unmerged = line.match(/^u ([.MTADRCU]{2}) /);
    if (unmerged) {
      addStatusCode(unmerged[1] ?? "UU", true);
      status.dirty = true;
      continue;
    }
    if (line.startsWith("? ")) {
      addStatusCode("?", false);
      status.dirty = true;
      continue;
    }
    const tracked = line.match(/^[12] ([.MTADRCU]{2}) /);
    if (!tracked) continue;
    addStatusCode(tracked[1] ?? "..", false);
    status.dirty = true;
  }
  status.statusCodes = [...statusCodes.values()];
  if (status.detached && exactTag) status.exactTag = sanitizeSingleLine(exactTag) || void 0;
  return status;
}
var ProjectStatusController = class {
  cwd;
  queryGitStatus;
  debounceMs;
  pollIntervalMs;
  provisionalBranch = null;
  details;
  refreshState = "idle";
  requestRender;
  unsubscribeBranch;
  refreshTimer;
  pollTimer;
  refreshInFlight = false;
  refreshPending = false;
  abortController;
  connected = false;
  disposed = false;
  constructor(cwd, queryGitStatus, debounceMs = 120, pollIntervalMs = 1e3) {
    this.cwd = cwd;
    this.queryGitStatus = queryGitStatus;
    this.debounceMs = debounceMs;
    this.pollIntervalMs = pollIntervalMs;
  }
  connect(footerData, requestRender) {
    this.disconnect();
    if (this.disposed) return;
    this.connected = true;
    this.requestRender = requestRender;
    this.provisionalBranch = footerData.getGitBranch();
    this.unsubscribeBranch = footerData.onBranchChange(() => {
      const nextBranch = footerData.getGitBranch();
      if (nextBranch !== this.provisionalBranch) {
        this.provisionalBranch = nextBranch;
        this.details = void 0;
        this.refreshState = "loading";
        this.requestRender?.();
      }
      this.requestRefresh();
    });
    this.requestRefresh(0);
    if (this.pollIntervalMs > 0) {
      this.pollTimer = setInterval(() => this.requestPollRefresh(), this.pollIntervalMs);
      this.pollTimer.unref();
    }
  }
  disconnect() {
    this.connected = false;
    this.unsubscribeBranch?.();
    this.unsubscribeBranch = void 0;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = void 0;
    this.requestRender = void 0;
  }
  getSnapshot() {
    return {
      cwd: this.cwd,
      branch: this.details?.branch ?? this.provisionalBranch,
      ...this.details,
      refreshState: this.refreshState
    };
  }
  requestRefresh(delay = this.debounceMs) {
    if (this.disposed || !this.connected || this.refreshTimer) return;
    if (this.refreshInFlight) {
      this.refreshPending = true;
      return;
    }
    this.scheduleRefresh(delay);
  }
  requestPollRefresh() {
    if (this.disposed || !this.connected || this.refreshTimer || this.refreshInFlight) return;
    this.scheduleRefresh(0);
  }
  scheduleRefresh(delay) {
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = void 0;
      void this.refresh();
    }, delay);
  }
  async refresh() {
    if (this.disposed || !this.connected) return;
    if (this.refreshInFlight) {
      this.refreshPending = true;
      return;
    }
    this.refreshInFlight = true;
    const wasError = this.refreshState === "error";
    if (this.refreshState === "idle") this.refreshState = "loading";
    const branchAtStart = this.provisionalBranch;
    const abortController = new AbortController();
    this.abortController = abortController;
    try {
      const result = await this.queryGitStatus(this.cwd, abortController.signal);
      if (this.disposed || branchAtStart !== this.provisionalBranch) {
        this.refreshPending = !this.disposed;
        return;
      }
      if (!result) {
        this.refreshState = "error";
        if (!wasError) this.requestRender?.();
        return;
      }
      const changed = JSON.stringify(result) !== JSON.stringify(this.details);
      this.details = result;
      this.provisionalBranch = result.branch;
      this.refreshState = "ready";
      if (changed || wasError) this.requestRender?.();
    } finally {
      if (this.abortController === abortController) this.abortController = void 0;
      this.refreshInFlight = false;
      if (this.refreshPending && !this.disposed) {
        this.refreshPending = false;
        this.requestRefresh(0);
      }
    }
  }
  dispose() {
    this.disposed = true;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = void 0;
    this.abortController?.abort();
    this.abortController = void 0;
    this.disconnect();
  }
};

// renderer/pi-installer-logo.ts
var SOURCE_WIDTH = 8;
var SOURCE_HEIGHT = 9;
var CROP_LEFT = 1;
var CROP_TOP = 3;
var CROP_WIDTH = 6;
var CROP_HEIGHT = 4;
var LEFT_PIECE = [
  [0, 0],
  [1, 0],
  [1, 1],
  [2, 0]
];
var TOP_PIECE = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 2]
];
var RIGHT_PIECE = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1]
];
var WHITE_CELLS = [
  [3, 2],
  [3, 3],
  [3, 4],
  [4, 2],
  [4, 4],
  [5, 2],
  [5, 3],
  [5, 5],
  [6, 2],
  [6, 5]
];
var CYAN_CELLS = [
  [2, 2],
  [2, 3],
  [2, 4],
  [3, 4]
];
var RED_CELLS = [
  [3, 2],
  [4, 2],
  [4, 3],
  [5, 2]
];
var GREEN_CELLS = [
  [4, 5],
  [5, 5],
  [6, 5],
  [6, 6]
];
function contains(cells, y, x) {
  return cells.some(([cellY, cellX]) => cellY === y && cellX === x);
}
function containsPiece(cells, y, x, pieceY, pieceX) {
  return cells.some(([dy, dx]) => y === pieceY + dy && x === pieceX + dx);
}
function sourceCellColor(phase, active, activeX, activeY, flash, white, y, x) {
  if (white) return contains(WHITE_CELLS, y, x) ? "white" : "panel";
  if (flash && y === 6 && x >= 1 && x <= 6) return "flash";
  if (active === "left" && containsPiece(LEFT_PIECE, y, x, activeY, activeX)) return "red";
  if (active === "top" && containsPiece(TOP_PIECE, y, x, activeY, activeX)) return "cyan";
  if (active === "right" && containsPiece(RIGHT_PIECE, y, x, activeY, activeX)) return "green";
  if (phase === 4) {
    if (contains(CYAN_CELLS, y, x)) return "cyan";
    if (contains(RED_CELLS, y, x)) return "red";
    if (contains([[4, 5], [5, 5]], y, x)) return "green";
    return "panel";
  }
  if (phase >= 5) {
    if (contains([[3, 2], [3, 3], [3, 4], [4, 4]], y, x)) return "cyan";
    if (contains([[4, 2], [5, 2], [5, 3], [6, 2]], y, x)) return "red";
    if (contains([[5, 5], [6, 5]], y, x)) return "green";
    return "panel";
  }
  if (phase <= 3 && contains([[6, 1], [6, 2], [6, 3], [6, 4]], y, x)) return "orange";
  if (phase >= 2 && contains(CYAN_CELLS, y, x)) return "cyan";
  if (phase >= 1 && contains(RED_CELLS, y, x)) return "red";
  if (phase >= 3 && contains(GREEN_CELLS, y, x)) return "green";
  return "panel";
}
function makeFrame(phase, active, activeX, activeY, flash, white) {
  const source = Array.from(
    { length: SOURCE_HEIGHT },
    (_, y) => Array.from(
      { length: SOURCE_WIDTH },
      (_2, x) => sourceCellColor(phase, active, activeX, activeY, flash, white, y, x + 1)
    )
  );
  return Array.from(
    { length: CROP_HEIGHT },
    (_, row) => source.slice(CROP_TOP, CROP_TOP + CROP_HEIGHT)[row].slice(CROP_LEFT, CROP_LEFT + CROP_WIDTH)
  );
}
var animationFrames = [];
var addFrame = (phase, active, activeX, activeY, flash, white, durationMs) => {
  animationFrames.push({
    frame: makeFrame(phase, active, activeX, activeY, flash, white),
    durationMs
  });
};
for (const y of [0, 1, 2, 3]) addFrame(0, "left", 2, y, false, false, 75);
for (const y of [0, 1, 2]) addFrame(1, "top", 2, y, false, false, 75);
for (const y of [0, 1, 2, 3, 4]) addFrame(2, "right", 5, y, false, false, 75);
addFrame(3, "none", 0, 0, false, false, 250);
addFrame(3, "none", 0, 0, true, false, 80);
addFrame(3, "none", 0, 0, false, false, 80);
addFrame(3, "none", 0, 0, true, false, 80);
addFrame(4, "none", 0, 0, false, false, 100);
addFrame(5, "none", 0, 0, false, false, 450);
addFrame(5, "none", 0, 0, false, true, 120);
addFrame(5, "none", 0, 0, false, false, 120);
addFrame(5, "none", 0, 0, false, true, 450);
function frameWidth(frame) {
  let maxCell = 0;
  for (const row of frame) {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index] !== "panel") {
        maxCell = Math.max(maxCell, index + 1);
        break;
      }
    }
  }
  return maxCell * 2;
}
var PI_INSTALLER_LOGO_FRAMES = animationFrames.map(({ frame }) => frame);
var PI_INSTALLER_LOGO_DURATIONS_MS = animationFrames.map(({ durationMs }) => durationMs);
var PI_INSTALLER_LOGO_WIDTH = Math.max(...PI_INSTALLER_LOGO_FRAMES.map(frameWidth));

// renderer/custom-header.ts
var BANNER_MIN_WIDTH = 64;
var BANNER_GAP = 1;
var BANNER_PADDING_X = 1;
var CUSTOM_HEADER_LOGO_FRAMES = PI_INSTALLER_LOGO_FRAMES;
var CUSTOM_HEADER_ANIMATION_DURATIONS_MS = PI_INSTALLER_LOGO_DURATIONS_MS;
var LOGO_THEME_COLORS = {
  panel: void 0,
  cyan: "accent",
  red: "error",
  green: "success",
  orange: "warning",
  white: "text",
  flash: "warning"
};
function joinSides(left, right, width) {
  if (!right) return truncateToWidth2(left, width);
  const gap = width - visibleWidth4(left) - visibleWidth4(right);
  if (gap >= 1) return `${left}${" ".repeat(gap)}${right}`;
  return truncateToWidth2(`${left} \xB7 ${right}`, width);
}
function joinColumns(left, right, width, leftColumnWidth = visibleWidth4(left)) {
  const leftWidth = visibleWidth4(left);
  const availableRightWidth = width - leftColumnWidth - BANNER_GAP;
  if (availableRightWidth < 1) return truncateToWidth2(left, width);
  const paddedLeft = `${left}${" ".repeat(Math.max(0, leftColumnWidth - leftWidth))}`;
  return `${paddedLeft}${" ".repeat(BANNER_GAP)}${truncateToWidth2(right, availableRightWidth)}`;
}
function renderLogoFrame(frame, theme) {
  return frame.map((row) => {
    let line = "";
    let run = "";
    let runColor;
    const flush = () => {
      if (!run) return;
      line += runColor ? theme.fg(runColor, run) : run;
      run = "";
    };
    for (const cell of row) {
      const color = LOGO_THEME_COLORS[cell];
      if (color !== runColor && run) flush();
      runColor = color;
      run += cell === "panel" ? "  " : "\u2588\u2588";
    }
    flush();
    return line.trimEnd();
  });
}
function formatHeaderModel(model) {
  const separator = model.lastIndexOf("/");
  return separator >= 0 ? model.slice(separator + 1) : model;
}
function alignRowsToBottom(rows, height) {
  const visibleRows = rows.slice(-height);
  const leadingEmptyRows = height - visibleRows.length;
  return Array.from({ length: height }, (_, index) => visibleRows[index - leadingEmptyRows] ?? "");
}
function renderCompactHeader(snapshot, width, theme, glyphs) {
  const brand = theme.bold(theme.fg("border", `${glyphs.brand} Pi Tui`));
  const version = theme.fg("muted", `Pi v${snapshot.version}`);
  const first = joinSides(brand, version, width);
  if (width < 32) return [first];
  const model = theme.fg("accent", `${glyphs.model} ${snapshot.model}`);
  const thinking = snapshot.thinking ? theme.fg("muted", `${glyphs.thinking} ${snapshot.thinking}`) : "";
  const left = thinking ? `${model} \xB7 ${thinking}` : model;
  const path = `${theme.fg("accent", glyphs.project)}${theme.fg(
    "dim",
    ` ${formatProjectPath(snapshot.cwd)}`
  )}`;
  return [first, joinSides(left, path, width)];
}
function renderCustomHeader(snapshot, width, theme, glyphs, logoFrame = CUSTOM_HEADER_LOGO_FRAMES.at(-1)) {
  if (width <= 0) return [];
  const paddingX = width >= BANNER_PADDING_X * 2 + 1 ? BANNER_PADDING_X : 0;
  const contentWidth = Math.max(1, width - paddingX * 2);
  if (width < BANNER_MIN_WIDTH) {
    const compact = renderCompactHeader(snapshot, contentWidth, theme, glyphs);
    return compact.map((line) => `${" ".repeat(paddingX)}${line}`);
  }
  const logo = renderLogoFrame(logoFrame, theme).map((line) => theme.bold(line));
  const logoWidth = PI_INSTALLER_LOGO_WIDTH;
  const title = `${theme.bold(theme.fg("border", "Pi"))}${theme.fg("dim", ` v${snapshot.version}`)}`;
  const modelName = formatHeaderModel(snapshot.model);
  const modelDetails = snapshot.thinking ? `${modelName} \xB7 ${snapshot.thinking}` : modelName;
  const model = theme.fg("dim", modelDetails);
  const path = theme.fg("dim", formatProjectPath(snapshot.cwd));
  const shortcuts = theme.fg(
    "dim",
    "Escape interrupt \xB7 Ctrl+C/Ctrl+D clear/exit \xB7 / commands \xB7 ! bash \xB7 Ctrl+O more"
  );
  const details = [
    title,
    model,
    path,
    shortcuts
  ];
  const alignedDetails = alignRowsToBottom(details, logo.length);
  return logo.map(
    (line, index) => `${" ".repeat(paddingX)}${joinColumns(line, alignedDetails[index] ?? "", contentWidth, logoWidth)}`
  );
}

// renderer/header.ts
function renderPiTuiHeader(snapshot, width, theme, glyphs, logoFrame) {
  return renderCustomHeader(snapshot, width, theme, glyphs, logoFrame);
}
var PiTuiHeader = class {
  getSnapshot;
  getTheme;
  getGlyphs;
  requestRender;
  animationFrame = 0;
  animationTimer;
  constructor(getSnapshot, getTheme, getGlyphs, requestRender = () => {
  }) {
    this.getSnapshot = getSnapshot;
    this.getTheme = getTheme;
    this.getGlyphs = getGlyphs;
    this.requestRender = requestRender;
    this.scheduleNextAnimationFrame();
  }
  scheduleNextAnimationFrame() {
    if (this.animationFrame >= CUSTOM_HEADER_LOGO_FRAMES.length - 1) return;
    this.animationTimer = setTimeout(() => {
      this.animationTimer = void 0;
      this.animationFrame += 1;
      this.requestRender();
      this.scheduleNextAnimationFrame();
    }, CUSTOM_HEADER_ANIMATION_DURATIONS_MS[this.animationFrame] ?? 80);
  }
  stopAnimation() {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = void 0;
    }
  }
  invalidate() {
  }
  render(width) {
    return renderPiTuiHeader(
      this.getSnapshot(),
      width,
      this.getTheme(),
      this.getGlyphs(),
      CUSTOM_HEADER_LOGO_FRAMES[this.animationFrame]
    );
  }
  dispose() {
    this.stopAnimation();
  }
};

// status/runtime-status.ts
import { readdir, stat } from "node:fs/promises";
import { join as join3 } from "node:path";
var CACHE_LIMIT = 32;
var RUNTIME_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "NVM_BIN",
  "NVM_SYMLINK",
  "VOLTA_HOME",
  "ASDF_DIR",
  "MISE_ENV_FILE",
  "PYENV_VERSION",
  "VIRTUAL_ENV"
];
var RUNTIMES = [
  { id: "nodejs", name: "Node.js", files: ["package.json", ".nvmrc", ".node-version"], version: { command: "node", args: ["--version"], pattern: /v(\d+\.\d+\.\d+)/ } },
  { id: "rust", name: "Rust", files: ["Cargo.toml"], version: { command: "rustc", args: ["--version"], pattern: /rustc\s+(\d+\.\d+\.\d+)/ } },
  { id: "go", name: "Go", files: ["go.mod"], version: { command: "go", args: ["version"], pattern: /go(\d+\.\d+(?:\.\d+)?)/ } },
  { id: "python", name: "Python", files: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", ".python-version"], version: { command: process.platform === "win32" ? "python" : "python3", args: ["--version"], pattern: /Python\s+(\d+\.\d+\.\d+)/ } },
  { id: "ruby", name: "Ruby", files: ["Gemfile", ".ruby-version"], version: { command: "ruby", args: ["--version"], pattern: /ruby\s+(\d+\.\d+\.\d+)/ } },
  { id: "java", name: "Java", files: ["pom.xml", "build.gradle", "build.gradle.kts", ".java-version"], version: { command: "java", args: ["-version"], pattern: /version\s+"(\d+\.\d+[.\d]*)"/ } },
  { id: "swift", name: "Swift", files: ["Package.swift"], version: { command: "swift", args: ["--version"], pattern: /Swift\s+(\d+\.\d+(?:\.\d+)?)/ } },
  { id: "kotlin", name: "Kotlin", files: ["settings.gradle.kts"] },
  { id: "deno", name: "Deno", files: ["deno.json", "deno.jsonc", "deno.lock"], version: { command: "deno", args: ["--version"], pattern: /deno\s+(\d+\.\d+\.\d+)/ } },
  { id: "bun", name: "Bun", files: ["bun.lock", "bun.lockb"], version: { command: "bun", args: ["--version"], pattern: /(\d+\.\d+\.\d+)/ } },
  { id: "php", name: "PHP", files: ["composer.json"], version: { command: "php", args: ["--version"], pattern: /PHP\s+(\d+\.\d+\.\d+)/ } },
  { id: "haskell", name: "Haskell", files: ["stack.yaml", "cabal.project"], extensions: [".cabal"], version: { command: "ghc", args: ["--version"], pattern: /(\d+\.\d+\.\d+)/ } },
  { id: "julia", name: "Julia", files: ["Project.toml", "Manifest.toml"], version: { command: "julia", args: ["--version"], pattern: /julia\s+(\d+\.\d+\.\d+)/i } },
  { id: "lua", name: "Lua", files: ["stylua.toml", ".luarc.json"], version: { command: "lua", args: ["-v"], pattern: /Lua\s+(\d+\.\d+(?:\.\d+)?)/ } },
  { id: "elixir", name: "Elixir", files: ["mix.exs"], version: { command: "elixir", args: ["--version"], pattern: /Elixir\s+(\d+\.\d+\.\d+)/ } },
  { id: "erlang", name: "Erlang", files: ["rebar.config", "erlang.mk"] },
  { id: "gleam", name: "Gleam", files: ["gleam.toml"], version: { command: "gleam", args: ["--version"], pattern: /gleam\s+(\d+\.\d+\.\d+)/i } },
  { id: "crystal", name: "Crystal", files: ["shard.yml"], version: { command: "crystal", args: ["--version"], pattern: /Crystal\s+(\d+\.\d+\.\d+)/ } },
  { id: "dart", name: "Dart", files: ["pubspec.yaml"], version: { command: "dart", args: ["--version"], pattern: /Dart\s+SDK\s+version:\s+(\d+\.\d+\.\d+)/ } },
  { id: "nim", name: "Nim", files: ["nim.cfg"], extensions: [".nimble"] },
  { id: "zig", name: "Zig", files: ["build.zig"], version: { command: "zig", args: ["version"], pattern: /(\d+\.\d+\.\d+)/ } },
  { id: "ocaml", name: "OCaml", files: ["dune", "dune-project"], extensions: [".opam"] },
  { id: "clojure", name: "Clojure", files: ["project.clj", "deps.edn"] },
  { id: "scala", name: "Scala", files: ["build.sbt"], folders: [".metals"] },
  { id: "perl", name: "Perl", files: ["Makefile.PL", "cpanfile"] },
  { id: "r", name: "R", files: ["DESCRIPTION"], extensions: [".Rproj"] },
  { id: "elm", name: "Elm", files: ["elm.json"] },
  { id: "haxe", name: "Haxe", files: ["haxelib.json", ".haxerc"] },
  { id: "vagrant", name: "Vagrant", files: ["Vagrantfile"] },
  { id: "terraform", name: "Terraform", files: ["main.tf", "variables.tf"], folders: [".terraform"] },
  { id: "helm", name: "Helm", files: ["Chart.yaml", "helmfile.yaml"] },
  { id: "solidity", name: "Solidity", extensions: [".sol"] },
  { id: "fortran", name: "Fortran", files: ["fpm.toml"], extensions: [".f", ".f90", ".f95"] },
  { id: "mojo", name: "Mojo", extensions: [".mojo"] },
  { id: "red", name: "Red", extensions: [".red", ".reds"] },
  { id: "raku", name: "Raku", files: ["META6.json"], extensions: [".raku", ".rakumod"] },
  { id: "purescript", name: "PureScript", files: ["spago.dhall", "spago.yaml"] },
  { id: "fennel", name: "Fennel", extensions: [".fnl"] },
  { id: "odin", name: "Odin", extensions: [".odin"] },
  { id: "v", name: "V", files: ["v.mod", "vpkg.json"], extensions: [".v"] },
  { id: "xmake", name: "xmake", files: ["xmake.lua"] },
  { id: "gradle", name: "Gradle", files: ["build.gradle", "build.gradle.kts"], folders: ["gradle"] },
  { id: "maven", name: "Maven", files: ["pom.xml"] },
  { id: "cmake", name: "CMake", files: ["CMakeLists.txt", "CMakeCache.txt"] },
  { id: "meson", name: "Meson", files: ["meson.build"], env: "MESON_DEVENV" },
  { id: "nix", name: "Nix", files: ["flake.nix", "shell.nix"], env: "IN_NIX_SHELL" },
  { id: "guix", name: "Guix", env: "GUIX_ENVIRONMENT" },
  { id: "conda", name: "Conda", env: "CONDA_DEFAULT_ENV" },
  { id: "pixi", name: "Pixi", files: ["pixi.toml", "pixi.lock"], env: "PIXI_ENVIRONMENT_NAME" },
  { id: "spack", name: "Spack", env: "SPACK_ENV" },
  { id: "pulumi", name: "Pulumi", files: ["Pulumi.yaml", "Pulumi.yml"] },
  { id: "typst", name: "Typst", files: ["template.typ"], extensions: [".typ"] },
  { id: "buf", name: "Buf", files: ["buf.yaml", "buf.gen.yaml", "buf.work.yaml"] },
  { id: "dotnet", name: ".NET", files: ["global.json", "Directory.Build.props"], extensions: [".csproj", ".fsproj"] },
  { id: "cobol", name: "COBOL", extensions: [".cbl", ".cob"] },
  { id: "cpp", name: "C++", files: ["CMakeLists.txt"], extensions: [".cpp", ".cc", ".cxx"] },
  { id: "c", name: "C", files: ["Makefile"], extensions: [".c"] }
];
var cache = /* @__PURE__ */ new Map();
function matchesRuntime(definition, entries, env) {
  if (definition.env && env[definition.env]) return true;
  if (definition.files?.some((name) => entries.has(name))) return true;
  if (definition.folders?.some((name) => entries.get(name) === true)) return true;
  return definition.extensions?.some((extension) => [...entries.keys()].some((name) => name.endsWith(extension))) ?? false;
}
async function runtimeFingerprint(cwd, definition, entryNames, env) {
  const parts = [`runtime:${definition.id}`, ...entryNames.slice().sort()];
  for (const name of definition.files ?? []) {
    if (!entryNames.includes(name)) continue;
    try {
      parts.push(`${name}:${(await stat(join3(cwd, name))).mtimeMs}`);
    } catch {
    }
  }
  if (definition.env && env[definition.env]) {
    parts.push(`${definition.env}=${env[definition.env]}`);
  }
  for (const name of RUNTIME_ENV_KEYS) {
    if (env[name]) parts.push(`${name}=${env[name]}`);
  }
  return parts.join("\0");
}
async function readVersion(definition, cwd, queryVersion, signal) {
  if (!definition.version) return void 0;
  try {
    const result = await queryVersion(
      definition.version.command,
      definition.version.args,
      cwd,
      signal
    );
    signal.throwIfAborted();
    if (result.killed || result.code !== 0) return void 0;
    const match = `${result.stdout}
${result.stderr}`.match(definition.version.pattern);
    return match?.[1];
  } catch (error) {
    if (signal.aborted) throw error;
    return void 0;
  }
}
async function detectRuntimeStatus(cwd, queryVersion, signal, env = process.env) {
  signal.throwIfAborted();
  let directoryEntries;
  try {
    directoryEntries = await readdir(cwd, { withFileTypes: true });
  } catch {
    return null;
  }
  signal.throwIfAborted();
  const entries = new Map(directoryEntries.map((entry) => [entry.name, entry.isDirectory()]));
  const definition = RUNTIMES.find((candidate) => matchesRuntime(candidate, entries, env));
  if (!definition) return null;
  const fingerprint = await runtimeFingerprint(cwd, definition, [...entries.keys()], env);
  const cached = cache.get(cwd);
  if (cached?.fingerprint === fingerprint) return cached.value;
  const version = await readVersion(definition, cwd, queryVersion, signal);
  const value = {
    name: definition.name,
    ...version ? { version } : {}
  };
  cache.delete(cwd);
  cache.set(cwd, { fingerprint, value });
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === void 0) break;
    cache.delete(oldest);
  }
  return value;
}
var RuntimeStatusController = class {
  cwd;
  queryRuntimeStatus;
  debounceMs;
  snapshot = null;
  requestRender;
  refreshTimer;
  refreshInFlight = false;
  refreshPending = false;
  abortController;
  disposed = false;
  constructor(cwd, queryRuntimeStatus, debounceMs = 120) {
    this.cwd = cwd;
    this.queryRuntimeStatus = queryRuntimeStatus;
    this.debounceMs = debounceMs;
  }
  connect(requestRender) {
    if (this.disposed) return;
    this.requestRender = requestRender;
    this.requestRefresh(0);
  }
  disconnect() {
    this.requestRender = void 0;
  }
  getSnapshot() {
    return this.snapshot;
  }
  requestRefresh(delay = this.debounceMs) {
    if (this.disposed || this.refreshTimer) return;
    if (this.refreshInFlight) {
      this.refreshPending = true;
      return;
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = void 0;
      void this.refresh();
    }, delay);
  }
  async refresh() {
    if (this.disposed || this.refreshInFlight) return;
    this.refreshInFlight = true;
    const abortController = new AbortController();
    this.abortController = abortController;
    try {
      const result = await this.queryRuntimeStatus(this.cwd, abortController.signal);
      if (this.disposed || result === void 0) return;
      if (JSON.stringify(result) !== JSON.stringify(this.snapshot)) {
        this.snapshot = result;
        this.requestRender?.();
      }
    } catch {
    } finally {
      if (this.abortController === abortController) this.abortController = void 0;
      this.refreshInFlight = false;
      if (this.refreshPending && !this.disposed) {
        this.refreshPending = false;
        this.requestRefresh(0);
      }
    }
  }
  dispose() {
    this.disposed = true;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = void 0;
    this.abortController?.abort();
    this.abortController = void 0;
    this.disconnect();
  }
};

// status/status-config.ts
var PRESET_SEGMENTS = {
  minimal: ["model", "context", "project", "git"],
  default: ["provider", "model", "thinking", "balance", "subscription", "tokens", "cache", "context", "project", "git", "duration", "extensions"],
  full: ["provider", "model", "thinking", "balance", "subscription", "tokens", "cache", "context", "project", "git", "duration", "runtime", "extensions"]
};
var VALID_PRESETS = /* @__PURE__ */ new Set(["minimal", "default", "full"]);
var VALID_SEGMENTS = new Set(PRESET_SEGMENTS.full);
var EDITOR_LEFT = /* @__PURE__ */ new Set(["provider", "model", "thinking", "balance", "subscription", "duration"]);
var FOOTER_USAGE = /* @__PURE__ */ new Set(["tokens", "cache", "context"]);
var FOOTER_PRIMARY = /* @__PURE__ */ new Set(["project", "git", "runtime"]);
var FOOTER_EXTRA = /* @__PURE__ */ new Set(["extensions"]);
var STATUS_PRESET_NAMES = ["minimal", "default", "full"];
var STATUS_SEGMENT_IDS = PRESET_SEGMENTS.full;
function statusPresetSegments(preset) {
  return [...PRESET_SEGMENTS[preset]];
}
function readStatusPreset(env = process.env) {
  const candidate = env.PI_UI_STATUS_PRESET?.trim().toLowerCase();
  return candidate && VALID_PRESETS.has(candidate) ? candidate : "default";
}
function readSegmentOrder(preset, env) {
  const raw = env.PI_UI_STATUS_SEGMENTS?.trim();
  if (!raw) return [...PRESET_SEGMENTS[preset]];
  const seen = /* @__PURE__ */ new Set();
  for (const token of raw.split(",")) {
    const segment = token.trim().toLowerCase();
    if (VALID_SEGMENTS.has(segment)) seen.add(segment);
  }
  return seen.size > 0 ? [...seen] : [...PRESET_SEGMENTS[preset]];
}
function normalizeSegmentOrder(segments) {
  const seen = /* @__PURE__ */ new Set();
  for (const segment of segments) {
    if (VALID_SEGMENTS.has(segment)) seen.add(segment);
  }
  return [...seen];
}
function resolveStatusSettings(env = process.env, override = {}) {
  const preset = env.PI_UI_STATUS_PRESET?.trim() ? readStatusPreset(env) : override.preset ?? "default";
  const segments = env.PI_UI_STATUS_SEGMENTS?.trim() ? readSegmentOrder(preset, env) : override.segments === void 0 || override.segments === null ? statusPresetSegments(preset) : normalizeSegmentOrder(override.segments);
  return {
    preset,
    editorLeft: segments.filter((segment) => EDITOR_LEFT.has(segment)),
    footerUsage: segments.filter((segment) => FOOTER_USAGE.has(segment)),
    footerPrimary: segments.filter((segment) => FOOTER_PRIMARY.has(segment)),
    footerExtra: segments.filter((segment) => FOOTER_EXTRA.has(segment))
  };
}

// status/session-status.ts
import { stripTerminalSequences as stripTerminalSequences2, visibleWidth as visibleWidth5 } from "@earendil-works/pi-tui";
var SEPARATOR2 = " \xB7 ";
var DEFAULT_GLYPHS2 = resolveGlyphs("unicode");
function sanitizeSingleLine2(text) {
  return stripTerminalSequences2(text).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/ +/g, " ").trim();
}
function safeAmount(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
function addUsage(snapshot, usage) {
  snapshot.inputTokens += safeAmount(usage.input);
  snapshot.outputTokens += safeAmount(usage.output);
  snapshot.cacheReadTokens += safeAmount(usage.cacheRead);
  snapshot.cacheWriteTokens += safeAmount(usage.cacheWrite);
  snapshot.cost += safeAmount(usage.cost.total);
}
function collectSessionStatus(sessionManager) {
  const entries = sessionManager.getEntries();
  const branchEntries = sessionManager.getBranch?.() ?? entries;
  const snapshot = {
    sessionId: sanitizeSingleLine2(sessionManager.getSessionId()),
    sessionName: sanitizeSingleLine2(sessionManager.getSessionName() ?? "") || void 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 0,
    turns: branchEntries.filter((entry) => entry.type === "message" && entry.message.role === "user").length,
    compactions: branchEntries.filter((entry) => entry.type === "compaction").length
  };
  let latestCacheHitPercent;
  for (const entry of entries) {
    let usage;
    if (entry.type === "message" && entry.message.role === "assistant") {
      usage = entry.message.usage;
      if (usage) {
        const promptTokens = safeAmount(usage.input) + safeAmount(usage.cacheRead) + safeAmount(usage.cacheWrite);
        latestCacheHitPercent = promptTokens > 0 ? safeAmount(usage.cacheRead) / promptTokens * 100 : void 0;
      }
    } else if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.usage) {
      usage = entry.message.usage;
    } else if ((entry.type === "compaction" || entry.type === "branch_summary") && entry.usage) {
      usage = entry.usage;
    }
    if (usage) addUsage(snapshot, usage);
  }
  snapshot.cacheHitPercent = latestCacheHitPercent;
  return snapshot;
}
function formatTokenCount(count) {
  if (count < 1e3) return String(count);
  if (count < 1e4) return `${(count / 1e3).toFixed(1)}k`;
  if (count < 1e6) return `${Math.round(count / 1e3)}k`;
  if (count < 1e7) return `${(count / 1e6).toFixed(1)}M`;
  return `${Math.round(count / 1e6)}M`;
}
function formatContextTokenCount(count) {
  if (count < 1e3) return String(count);
  if (count < 1e6) return `${(count / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  if (count < 1e9) return `${(count / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  return `${(count / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
}
function formatContextUsageTokenCount(count) {
  return safeAmount(count) === 0 ? "0k" : formatContextTokenCount(count);
}
function formatCacheHitPercent(percent) {
  const safePercent = Number.isFinite(percent) && percent !== void 0 && percent >= 0 ? percent : 0;
  return safePercent.toFixed(1).replace(/\.0$/, "");
}
function buildEditorUsageSegments(snapshot, contextUsage, contextWindowFallback, theme, glyphs, segments, autoCompactionEnabled = false) {
  const statsParts = [
    theme.fg("muted", `${glyphs.inputTokens}${formatTokenCount(safeAmount(snapshot.inputTokens))}`),
    theme.fg("muted", `${glyphs.outputTokens}${formatTokenCount(safeAmount(snapshot.outputTokens))}`),
    theme.fg("muted", `R${safeAmount(snapshot.cacheReadTokens) > 0 ? formatTokenCount(snapshot.cacheReadTokens) : "0k"}`)
  ];
  const cacheHit = theme.fg(
    cacheHitStatusColor(snapshot.cacheHitPercent),
    `CH${formatCacheHitPercent(snapshot.cacheHitPercent)}%`
  );
  const statsSeparator = theme.fg("muted", " \xB7 ");
  const statsText = `${statsParts.join(" ")}${statsSeparator}${cacheHit}`;
  const statsCompact = `${statsParts[2]}${statsSeparator}${cacheHit}`;
  const contextWindow = contextUsage?.contextWindow ?? contextWindowFallback;
  const contextTokens = contextUsage?.tokens ?? 0;
  const contextValue = contextWindow ? `${formatContextUsageTokenCount(contextTokens)}/${formatContextTokenCount(contextWindow)}` : `${formatContextUsageTokenCount(contextTokens)}/?`;
  const contextText = `${glyphs.context} ${contextValue}`;
  const stats = {
    id: "tokens",
    text: statsText,
    compactText: statsCompact,
    priority: 4
  };
  const byId = {
    // tokens 与 cache 已合并为统计组，两个段 id 任一启用即显示
    tokens: stats,
    cache: stats,
    context: {
      id: "context",
      text: theme.fg(contextUsageStatusColor(contextUsage?.percent), contextText),
      priority: 0,
      required: true
    }
  };
  const showConversationCounts = segments.includes("tokens") || segments.includes("cache") || snapshot.turns > 0 || snapshot.compactions > 0;
  const turnStatus = {
    id: "turns",
    text: snapshot.turns > 0 ? theme.fg(turnStatusColor(snapshot.turns), `${glyphs.turns} T${snapshot.turns}`) : "",
    priority: 6
  };
  const compactionStatus = {
    id: "compactions",
    text: theme.fg(
      compactionStatusColor(snapshot.compactions),
      `${glyphs.compaction} ${autoCompactionEnabled ? "Auto" : "Off"}${snapshot.compactions > 0 ? `\uFF08C${snapshot.compactions}\uFF09` : ""}`
    ),
    priority: 5
  };
  const seen = /* @__PURE__ */ new Set();
  return segments.flatMap((segment) => {
    const status = byId[segment];
    if (!status.text || seen.has(status.id)) return [];
    seen.add(status.id);
    if (segment !== "context") return [status];
    const extras = [compactionStatus];
    const ordered = showConversationCounts ? [turnStatus, status, ...extras] : [status, ...extras];
    return ordered.filter((extra) => extra.text);
  });
}
function renderStates(states, separator) {
  return states.filter((state) => !state.hidden && state.text).map((state) => state.text).join(separator);
}
function renderStatusLineSegments(segments, width, separator = SEPARATOR2) {
  if (width <= 0) return "";
  const states = segments.map((segment) => ({
    segment,
    text: segment.text,
    compacted: false,
    hidden: !segment.text
  }));
  let line = renderStates(states, separator);
  while (visibleWidth5(line) > width) {
    const state = states.filter((candidate) => !candidate.hidden).sort((left, right) => right.segment.priority - left.segment.priority)[0];
    if (!state) return "";
    const compact = state.segment.compactText;
    if (!state.compacted && compact && compact !== state.text) {
      state.text = compact;
      state.compacted = true;
    } else {
      state.hidden = true;
    }
    line = renderStates(states, separator);
  }
  return line;
}

// status/turn-telemetry.ts
var TURN_TELEMETRY_ENTRY_TYPE = "pi-tui.turn-telemetry";
var TURN_DURATION_ENTRY_TYPE = "pi-tui.turn-duration";
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function isNonNegativeFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function isNullableNonNegativeFinite(value) {
  return value === null || isNonNegativeFinite(value);
}
function isTurnTelemetrySnapshot(value) {
  if (!isRecord(value)) return false;
  return isNullableNonNegativeFinite(value.tokensPerSecond) && isNonNegativeFinite(value.ttftMs) && isNonNegativeFinite(value.totalMs) && isNonNegativeFinite(value.inputTokens) && isNonNegativeFinite(value.outputTokens) && (value.cacheReadTokens === void 0 || isNullableNonNegativeFinite(value.cacheReadTokens)) && (value.cacheWriteTokens === void 0 || isNullableNonNegativeFinite(value.cacheWriteTokens)) && isNonNegativeFinite(value.generationMs) && isNonNegativeFinite(value.costUsd);
}
function createTurnTelemetryEntryData(telemetry) {
  return { schemaVersion: 1, telemetry: { ...telemetry } };
}
function readTurnTelemetryEntryData(value) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isTurnTelemetrySnapshot(value.telemetry)) {
    return void 0;
  }
  return {
    ...value.telemetry,
    cacheReadTokens: value.telemetry.cacheReadTokens ?? null,
    cacheWriteTokens: value.telemetry.cacheWriteTokens ?? null
  };
}
function createTurnDurationEntryData(elapsedMs) {
  return { schemaVersion: 1, elapsedMs: Math.max(0, elapsedMs) };
}
function readTurnDurationEntryData(value) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isNonNegativeFinite(value.elapsedMs)) {
    return void 0;
  }
  return value.elapsedMs;
}
function readLatestTurnDuration(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "custom") continue;
    if (entry.customType === TURN_DURATION_ENTRY_TYPE) {
      const elapsedMs = readTurnDurationEntryData(entry.data);
      if (elapsedMs !== void 0) return elapsedMs;
    }
    if (entry.customType === TURN_TELEMETRY_ENTRY_TYPE) {
      const telemetry = readTurnTelemetryEntryData(entry.data);
      if (telemetry) return telemetry.totalMs;
    }
  }
  return void 0;
}
function isAssistantMessage(message) {
  return message.role === "assistant";
}
function finitePositive(value) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value : 0;
}
function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
function aggregateTelemetry(turns, totalMs) {
  if (turns.length === 0) return void 0;
  const inputTokens = turns.reduce((sum, turn) => sum + turn.inputTokens, 0);
  const outputTokens = turns.reduce((sum, turn) => sum + turn.outputTokens, 0);
  const hasCacheTelemetry = turns.every(
    (turn) => turn.cacheReadTokens !== null && turn.cacheWriteTokens !== null
  );
  const cacheReadTokens = hasCacheTelemetry ? turns.reduce((sum, turn) => sum + turn.cacheReadTokens, 0) : null;
  const cacheWriteTokens = hasCacheTelemetry ? turns.reduce((sum, turn) => sum + turn.cacheWriteTokens, 0) : null;
  const costUsd = turns.reduce((sum, turn) => sum + turn.costUsd, 0);
  const generationMs = turns.reduce((sum, turn) => sum + turn.generationMs, 0);
  const tokensPerSecond = outputTokens > 0 && generationMs > 0 ? round(outputTokens / (generationMs / 1e3), 1) : null;
  return {
    tokensPerSecond,
    ttftMs: turns[0].ttftMs,
    totalMs: Math.max(0, totalMs),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    generationMs,
    costUsd
  };
}
var TurnTelemetryTracker = class {
  now;
  turn;
  agentStartMs = null;
  agentTurns = [];
  constructor(now = () => performance.now()) {
    this.now = now;
  }
  handle(event) {
    switch (event.type) {
      case "agent_start":
        if (this.agentStartMs === null) {
          this.agentStartMs = this.now();
          this.agentTurns = [];
        }
        return void 0;
      case "agent_settled":
        return this.endAgent();
      case "turn_start":
        this.startTurn();
        return void 0;
      case "message_start":
        this.startMessage(event.message);
        return void 0;
      case "message_update":
        this.updateMessage(event);
        return void 0;
      case "message_end":
        this.endMessage(event.message);
        return void 0;
      case "turn_end":
        this.endTurnAndCollect();
        return void 0;
    }
  }
  reset() {
    this.turn = void 0;
    this.agentStartMs = null;
    this.agentTurns = [];
  }
  startTurn() {
    this.turn = {
      startMs: this.now(),
      firstTokenMs: null,
      currentMessage: null,
      messages: [],
      generationMs: 0
    };
  }
  startMessage(message) {
    if (!this.turn || !isAssistantMessage(message)) return;
    this.turn.currentMessage = {
      firstOutputMs: null
    };
  }
  updateMessage(event) {
    const streamEvent = event.assistantMessageEvent;
    if (streamEvent.type !== "text_delta" && streamEvent.type !== "thinking_delta" && streamEvent.type !== "toolcall_delta") return;
    if (streamEvent.delta.length === 0) return;
    const turn = this.turn;
    const current = turn?.currentMessage;
    if (!turn || !current || !isAssistantMessage(event.message)) return;
    if (current.firstOutputMs === null) {
      const now = this.now();
      current.firstOutputMs = now;
      turn.firstTokenMs ??= now;
    }
  }
  endMessage(message) {
    const turn = this.turn;
    if (!turn || !isAssistantMessage(message)) return;
    if (turn.currentMessage) {
      const endMs = this.now();
      if (turn.currentMessage.firstOutputMs !== null) {
        turn.generationMs += Math.max(0, endMs - turn.currentMessage.firstOutputMs);
      }
      if (turn.currentMessage.firstOutputMs === null && finitePositive(message.usage?.output) > 0) {
        turn.firstTokenMs ??= endMs;
      }
      turn.currentMessage = null;
    }
    turn.messages.push(message);
  }
  endTurnAndCollect() {
    const telemetry = this.endTurn();
    if (telemetry && this.agentStartMs !== null) this.agentTurns.push(telemetry);
  }
  endTurn() {
    const turn = this.turn;
    this.turn = void 0;
    if (!turn || turn.firstTokenMs === null || turn.messages.length === 0) return void 0;
    const inputTokens = turn.messages.reduce(
      (sum, message) => sum + finitePositive(message.usage?.input),
      0
    );
    const outputTokens = turn.messages.reduce(
      (sum, message) => sum + finitePositive(message.usage?.output),
      0
    );
    const cacheReadTokens = turn.messages.reduce(
      (sum, message) => sum + finitePositive(message.usage?.cacheRead),
      0
    );
    const cacheWriteTokens = turn.messages.reduce(
      (sum, message) => sum + finitePositive(message.usage?.cacheWrite),
      0
    );
    const costUsd = turn.messages.reduce(
      (sum, message) => sum + finitePositive(message.usage?.cost?.total),
      0
    );
    const tokensPerSecond = outputTokens > 0 && turn.generationMs > 0 ? round(outputTokens / (turn.generationMs / 1e3), 1) : null;
    return {
      tokensPerSecond,
      ttftMs: turn.firstTokenMs - turn.startMs,
      totalMs: this.now() - turn.startMs,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      generationMs: turn.generationMs,
      costUsd
    };
  }
  endAgent() {
    const startMs = this.agentStartMs;
    const turns = this.agentTurns;
    this.reset();
    return startMs === null ? void 0 : aggregateTelemetry(turns, this.now() - startMs);
  }
};
function formatTelemetryDuration(ms) {
  return ms < 6e4 ? `${(Math.max(0, ms) / 1e3).toFixed(1)}s` : formatElapsed(ms);
}
function getTtftColor(ttftMs) {
  if (ttftMs < 3e3) return "success";
  if (ttftMs < 8e3) return "accent";
  if (ttftMs < 15e3) return "warning";
  return "error";
}
function formatTokensPerSecond(value) {
  return round(value, 1).toString();
}
function formatEstimatedCost(costUsd) {
  if (costUsd < 1e-4) return "<$0.0001";
  const decimals = costUsd < 1 ? 4 : 2;
  const amount = costUsd.toFixed(decimals).replace(/\.?0+$/, "");
  return `$${amount}`;
}
function formatTurnTelemetry(telemetry, theme, glyphs = resolveGlyphs("unicode")) {
  const parts = [];
  const speed = telemetry.tokensPerSecond === null ? "\u2014" : `${formatTokensPerSecond(telemetry.tokensPerSecond)} tok/s`;
  parts.push(theme.fg(
    getTtftColor(telemetry.ttftMs),
    `${glyphs.latency} ${formatTelemetryDuration(telemetry.ttftMs)}`
  ));
  parts.push(theme.fg(
    telemetry.tokensPerSecond === null ? "muted" : "accent",
    `${glyphs.speed} ${speed}`
  ));
  const contextParts = [];
  if (telemetry.inputTokens > 0) {
    contextParts.push(theme.fg("muted", `${glyphs.inputTokens}${formatTokenCount(telemetry.inputTokens)}`));
  }
  if (telemetry.outputTokens > 0) {
    contextParts.push(theme.fg("muted", `${glyphs.outputTokens}${formatTokenCount(telemetry.outputTokens)}`));
  }
  if (telemetry.cacheReadTokens !== null && telemetry.cacheWriteTokens !== null && (telemetry.cacheReadTokens > 0 || telemetry.cacheWriteTokens > 0)) {
    contextParts.push(theme.fg("muted", `R${formatTokenCount(telemetry.cacheReadTokens)}`));
  }
  if (contextParts.length > 0) parts.push(contextParts.join(" "));
  if (telemetry.costUsd > 0) {
    parts.push(theme.fg("warning", formatEstimatedCost(telemetry.costUsd)));
  }
  const separator = glyphs.cost === "$" ? "|" : "\xB7";
  return parts.join(` ${theme.fg("dim", separator)} `);
}

// status/auto-compaction.ts
import { watch } from "node:fs";
function watchAgentSettings(agentDir, onChange) {
  try {
    const watcher = watch(agentDir, { persistent: false }, (_eventType, filename) => {
      if (filename && filename.toString().toLowerCase() !== "settings.json") return;
      onChange();
    });
    watcher.on("error", () => {
    });
    return () => watcher.close();
  } catch {
    return () => {
    };
  }
}
var AutoCompactionStatusController = class {
  enabled;
  readEnabled;
  requestRender;
  stopWatching;
  disposed = false;
  constructor(readEnabled, subscribe, requestRender) {
    this.readEnabled = readEnabled;
    this.requestRender = requestRender;
    this.enabled = this.readCurrentValue();
    try {
      this.stopWatching = subscribe(() => this.refresh());
    } catch {
      this.stopWatching = () => {
      };
    }
  }
  getSnapshot() {
    return this.enabled;
  }
  refresh() {
    if (this.disposed) return;
    const enabled = this.readCurrentValue();
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.requestRender();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.stopWatching();
    } catch {
    }
  }
  readCurrentValue() {
    try {
      return this.readEnabled();
    } catch {
      return false;
    }
  }
};

// plugin/settings-config.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { basename, dirname, join as join4 } from "node:path";
var PI_TUI_CONFIG_VERSION = 1;
var PROVIDER_REFRESH_INTERVALS = [3e4, 6e4, 12e4, 3e5];
var DEFAULT_PI_TUI_CONFIG = Object.freeze({
  schemaVersion: PI_TUI_CONFIG_VERSION,
  appearance: Object.freeze({ editor: true, header: true }),
  status: Object.freeze({ preset: "default", segments: null }),
  data: Object.freeze({ providerRefreshMs: 6e4, telemetry: true }),
  advanced: Object.freeze({ spinner: "default" })
});
var PRESETS = new Set(STATUS_PRESET_NAMES);
var SEGMENTS = new Set(STATUS_SEGMENT_IDS);
var REFRESH_INTERVALS = new Set(PROVIDER_REFRESH_INTERVALS);
var SPINNER_MODES = /* @__PURE__ */ new Set(["default", "static", "hidden"]);
function cloneDefault() {
  return {
    schemaVersion: PI_TUI_CONFIG_VERSION,
    appearance: { ...DEFAULT_PI_TUI_CONFIG.appearance },
    status: { preset: DEFAULT_PI_TUI_CONFIG.status.preset, segments: null },
    data: { ...DEFAULT_PI_TUI_CONFIG.data },
    advanced: { ...DEFAULT_PI_TUI_CONFIG.advanced }
  };
}
function isRecord2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requireRecord(value, field) {
  if (!isRecord2(value)) throw new Error(`${field} \u5FC5\u987B\u662F\u5BF9\u8C61`);
  return value;
}
function optionalRecord(value, field) {
  return value === void 0 ? {} : requireRecord(value, field);
}
function readChoice(value, choices, fallback, field) {
  if (value === void 0) return fallback;
  if (typeof value !== "string" || !choices.has(value)) {
    throw new Error(`${field} \u7684\u503C\u65E0\u6548`);
  }
  return value;
}
function readSegments(value) {
  if (value === void 0 || value === null) return null;
  if (!Array.isArray(value)) throw new Error("status.segments \u5FC5\u987B\u662F\u6570\u7EC4\u6216 null");
  const seen = /* @__PURE__ */ new Set();
  for (const segment of value) {
    if (typeof segment !== "string" || !SEGMENTS.has(segment)) {
      throw new Error(`status.segments \u5305\u542B\u65E0\u6548\u503C: ${String(segment)}`);
    }
    seen.add(segment);
  }
  return [...seen];
}
function readStatusPresetValue(value, fallback) {
  if (value === "ascii") return "default";
  return readChoice(value, PRESETS, fallback, "status.preset");
}
function readBoolean(value, fallback, field) {
  if (value === void 0) return fallback;
  if (typeof value !== "boolean") throw new Error(`${field} \u5FC5\u987B\u662F\u5E03\u5C14\u503C`);
  return value;
}
function optionalString(value, field) {
  if (value === void 0) return void 0;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  return value.trim();
}
function requiredString(value, field) {
  const parsed = optionalString(value, field);
  if (!parsed) throw new Error(`${field} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  return parsed;
}
function optionalSecret(value, field) {
  if (value === void 0) return void 0;
  if (typeof value !== "string" || value.length === 0) throw new Error(`${field} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  return value;
}
function requiredSecret(value, field) {
  const parsed = optionalSecret(value, field);
  if (!parsed) throw new Error(`${field} \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
  return parsed;
}
var PROVIDER_QUERY_PROTOCOLS = /* @__PURE__ */ new Set([
  "sub2api",
  "new-api",
  "generic-balance",
  "zenmux"
]);
function readProviderQuery(value, index) {
  const field = `data.providerAccess.queries[${index}]`;
  const query = requireRecord(value, field);
  const id = requiredString(query.id, `${field}.id`);
  if (!Array.isArray(query.matchHosts) || query.matchHosts.length === 0) {
    throw new Error(`${field}.matchHosts \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4`);
  }
  const matchHosts = query.matchHosts.map((host, hostIndex) => {
    return requiredString(host, `${field}.matchHosts[${hostIndex}]`);
  });
  if (typeof query.protocol !== "string" || !PROVIDER_QUERY_PROTOCOLS.has(query.protocol)) {
    throw new Error(`${field}.protocol \u7684\u503C\u65E0\u6548`);
  }
  const currency = query.currency === void 0 ? void 0 : readChoice(query.currency, /* @__PURE__ */ new Set(["CNY", "USD"]), "USD", `${field}.currency`);
  return {
    id,
    matchHosts,
    protocol: query.protocol,
    ...optionalString(query.displayName, `${field}.displayName`) ? { displayName: String(query.displayName).trim() } : {},
    ...optionalString(query.baseUrl, `${field}.baseUrl`) ? { baseUrl: String(query.baseUrl).trim() } : {},
    ...optionalString(query.path, `${field}.path`) ? { path: String(query.path).trim() } : {},
    ...optionalSecret(query.apiKey, `${field}.apiKey`) ? { apiKey: String(query.apiKey) } : {},
    ...optionalSecret(query.accessToken, `${field}.accessToken`) ? { accessToken: String(query.accessToken) } : {},
    ...optionalString(query.userId, `${field}.userId`) ? { userId: String(query.userId).trim() } : {},
    ...currency ? { currency } : {}
  };
}
function readProviderQueries(value) {
  if (value === void 0) return void 0;
  if (!Array.isArray(value)) throw new Error("data.providerAccess.queries \u5FC5\u987B\u662F\u6570\u7EC4");
  return value.map(readProviderQuery);
}
function readGithubDomain(value) {
  const domain = optionalString(value, "data.providerAccess.githubDomain")?.toLowerCase();
  if (!domain) return void 0;
  try {
    const url = new URL(`https://${domain}`);
    if (url.hostname !== domain || url.port || url.pathname !== "/" || url.username || url.password) {
      throw new Error();
    }
    return domain;
  } catch {
    throw new Error("data.providerAccess.githubDomain \u5FC5\u987B\u662F\u4E3B\u673A\u540D");
  }
}
function readProviderAccess(value) {
  if (value === void 0) return void 0;
  const access = requireRecord(value, "data.providerAccess");
  const queries = readProviderQueries(access.queries);
  const githubDomain = readGithubDomain(access.githubDomain);
  const credentialsValue = optionalRecord(access.credentials, "data.providerAccess.credentials");
  const volcengineValue = credentialsValue.volcengine === void 0 ? void 0 : requireRecord(credentialsValue.volcengine, "data.providerAccess.credentials.volcengine");
  const zhipuTeamValue = credentialsValue.zhipuTeam === void 0 ? void 0 : requireRecord(credentialsValue.zhipuTeam, "data.providerAccess.credentials.zhipuTeam");
  const credentials = {
    ...volcengineValue ? {
      volcengine: {
        accessKeyId: requiredSecret(volcengineValue.accessKeyId, "data.providerAccess.credentials.volcengine.accessKeyId"),
        secretAccessKey: requiredSecret(volcengineValue.secretAccessKey, "data.providerAccess.credentials.volcengine.secretAccessKey")
      }
    } : {},
    ...zhipuTeamValue ? {
      zhipuTeam: {
        organizationId: requiredString(zhipuTeamValue.organizationId, "data.providerAccess.credentials.zhipuTeam.organizationId"),
        projectId: requiredString(zhipuTeamValue.projectId, "data.providerAccess.credentials.zhipuTeam.projectId")
      }
    } : {}
  };
  return {
    ...queries ? { queries } : {},
    ...Object.keys(credentials).length > 0 ? { credentials } : {},
    ...githubDomain ? { githubDomain } : {}
  };
}
function parsePiTuiConfig(value) {
  const root = requireRecord(value, "config");
  if (root.schemaVersion !== PI_TUI_CONFIG_VERSION) {
    throw new Error(`\u4E0D\u652F\u6301 schemaVersion: ${String(root.schemaVersion)}`);
  }
  const defaults = cloneDefault();
  const appearance = optionalRecord(root.appearance, "appearance");
  const status = optionalRecord(root.status, "status");
  const data = optionalRecord(root.data, "data");
  const advanced = optionalRecord(root.advanced, "advanced");
  const refresh = data.providerRefreshMs ?? defaults.data.providerRefreshMs;
  const providerAccess = readProviderAccess(data.providerAccess);
  if (typeof refresh !== "number" || !REFRESH_INTERVALS.has(refresh)) {
    throw new Error("data.providerRefreshMs \u7684\u503C\u65E0\u6548");
  }
  return {
    schemaVersion: PI_TUI_CONFIG_VERSION,
    appearance: {
      editor: readBoolean(
        appearance.editor,
        defaults.appearance.editor,
        "appearance.editor"
      ),
      header: readBoolean(
        appearance.header,
        defaults.appearance.header,
        "appearance.header"
      )
    },
    status: {
      preset: readStatusPresetValue(status.preset, defaults.status.preset),
      segments: readSegments(status.segments)
    },
    data: {
      providerRefreshMs: refresh,
      telemetry: readBoolean(data.telemetry, defaults.data.telemetry, "data.telemetry"),
      ...providerAccess ? { providerAccess } : {}
    },
    advanced: {
      spinner: readChoice(
        advanced.spinner,
        SPINNER_MODES,
        defaults.advanced.spinner,
        "advanced.spinner"
      )
    }
  };
}
function readJsonSync(path) {
  return JSON.parse(readFileSync2(path, "utf8"));
}
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function isMissing(error) {
  return error.code === "ENOENT";
}
function loadPiTuiConfig(path) {
  let primaryError;
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
      warnings: primaryError ? [`${path} \u65E0\u6548\uFF0C\u5DF2\u6539\u7528\u5907\u4EFD: ${errorText(primaryError)}`] : []
    };
  } catch (backupError) {
    if (!primaryError && isMissing(backupError)) return { config: cloneDefault(), warnings: [] };
    const reason = primaryError ?? backupError;
    return {
      config: cloneDefault(),
      warnings: [`${path} \u65E0\u6548\uFF0C\u5DF2\u4F7F\u7528\u9ED8\u8BA4\u8BBE\u7F6E: ${errorText(reason)}`]
    };
  }
}
function piTuiConfigPath(agentDir) {
  return join4(agentDir, "pi-tui.json");
}

// plugin/transition-gate.ts
var CLEAR_VISIBLE_SCREEN = "\x1B[2J\x1B[H";
var BEGIN_SYNCHRONIZED_OUTPUT = "\x1B[?2026h";
var END_SYNCHRONIZED_OUTPUT = "\x1B[?2026l";
var MAX_HELD_OUTPUT_BYTES = 2 * 1024 * 1024;
var FAIL_OPEN_AFTER_MS = 1e4;
var GUARD_CLEAR_INTERVAL_MS = 16;
var GLOBAL_GATE_KEY = "__piTuiTerminalTransitionGateV1";
function isMainScreenTui(tui) {
  return tui.mode === "regular" && typeof tui.captureRenderState === "function" && typeof tui.restoreRenderState === "function";
}
function canRedrawVisibleViewport(tui, state) {
  const width = tui.terminal.columns;
  const height = tui.terminal.rows;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    return false;
  }
  if (!Array.isArray(state.previousLines) || state.previousLines.length === 0) return false;
  if (state.previousLines.some((line) => line.includes("\x1B_G") || line.includes("\x1B]1337;File="))) {
    return false;
  }
  return Number.isSafeInteger(state.previousViewportTop) && state.previousViewportTop >= 0;
}
var TerminalTransitionGate = class {
  output;
  holding = false;
  heldWrites = [];
  heldOutputBytes = 0;
  failOpenTimer;
  hasVisibleFrame = false;
  // 实例级拦截：宿主真实 terminal（jiti 双副本下 prototype patch 拦不到宿主）。
  hookedTerminal;
  instanceOriginalWrite;
  // 拦截挂接前的看门狗：holding 且 hook 未挂期间宿主仍在渲染原生帧（真实配置
  // 下扩展初始化可达数秒），以约一帧的间隔清屏，落屏帧最多存活 16ms——
  // 低于单行文字的感知阈值；空屏上的清屏是视觉 no-op，不会闪烁。
  guardTimer;
  constructor(terminalPrototype, output = process.stdout) {
    this.output = output;
    if (!terminalPrototype) return;
    const original = terminalPrototype.write;
    const gate = this;
    terminalPrototype.write = function(data) {
      if (!gate.holding) {
        original.call(this, data);
        return;
      }
      gate.captureWrite(this, data);
    };
  }
  /** 挂接宿主真实 terminal 实例；重复挂接同一实例时幂等。 */
  hookTerminal(terminal) {
    if (this.hookedTerminal === terminal) return;
    this.stopGuardTimer();
    this.hookedTerminal = terminal;
    this.instanceOriginalWrite = terminal.write;
    const gate = this;
    terminal.write = (data) => {
      if (!gate.holding) {
        gate.instanceOriginalWrite?.call(terminal, data);
        return;
      }
      gate.captureWrite(terminal, data);
    };
  }
  /** 经实例 hook 的原始通道直写（清屏/揭示/回放），绕过拦截逻辑。 */
  writeThrough(data) {
    if (this.hookedTerminal && this.instanceOriginalWrite) {
      this.instanceOriginalWrite.call(this.hookedTerminal, data);
      return;
    }
    this.output.write(data);
  }
  isHolding() {
    return this.holding;
  }
  hold(tui, options = {}) {
    if (!this.output.isTTY) return false;
    if (this.holding) {
      if (options.clearVisibleScreen) this.clearVisibleScreen(tui);
      return true;
    }
    if (!this.hasVisibleFrame || options.clearVisibleScreen) {
      this.writeThrough(CLEAR_VISIBLE_SCREEN);
    }
    this.holding = true;
    this.heldWrites = [];
    this.heldOutputBytes = 0;
    this.armFailOpen();
    this.startGuardTimer();
    return true;
  }
  startGuardTimer() {
    if (this.guardTimer || this.hookedTerminal) return;
    this.guardTimer = setInterval(() => {
      if (!this.holding || this.hookedTerminal) {
        this.stopGuardTimer();
        return;
      }
      this.output.write(CLEAR_VISIBLE_SCREEN);
    }, GUARD_CLEAR_INTERVAL_MS);
    this.guardTimer.unref?.();
  }
  stopGuardTimer() {
    if (!this.guardTimer) return;
    clearInterval(this.guardTimer);
    this.guardTimer = void 0;
  }
  clearVisibleScreen(_tui) {
    this.writeThrough(CLEAR_VISIBLE_SCREEN);
  }
  reveal(tui) {
    if (!this.holding) return false;
    try {
      tui.renderNow(false);
      if (isMainScreenTui(tui)) {
        const state = tui.captureRenderState();
        if (canRedrawVisibleViewport(tui, state)) {
          const height = tui.terminal.rows;
          const maxViewportTop = Math.max(0, state.previousLines.length - height);
          const top = Math.min(state.previousViewportTop, maxViewportTop);
          const bottom = Math.min(state.previousLines.length, top + height);
          tui.restoreRenderState({
            ...state,
            hardwareCursorRow: Math.max(top, bottom - 1)
          });
          this.release(false);
          const visibleLines = state.previousLines.slice(top, bottom);
          this.writeThrough(
            `${BEGIN_SYNCHRONIZED_OUTPUT}\x1B[H${visibleLines.join("\r\n")}\x1B[J${END_SYNCHRONIZED_OUTPUT}`
          );
          this.hasVisibleFrame = true;
          tui.renderNow(false);
          return true;
        }
      }
      this.release(false);
      tui.renderNow(true);
      this.hasVisibleFrame = true;
      return true;
    } catch {
      this.release(true);
      try {
        tui.renderNow(true);
      } catch {
      }
      return false;
    }
  }
  release(replayHeldOutput = false) {
    if (!this.holding) return;
    this.stopGuardTimer();
    this.holding = false;
    this.clearFailOpenTimer();
    const heldWrites = this.heldWrites;
    this.heldWrites = [];
    this.heldOutputBytes = 0;
    if (!replayHeldOutput) return;
    for (const held of heldWrites) {
      this.writeThrough(held.data);
    }
  }
  captureWrite(terminal, data) {
    this.heldWrites.push({ terminal, data });
    this.heldOutputBytes += Buffer.byteLength(data);
    if (this.heldOutputBytes > MAX_HELD_OUTPUT_BYTES) this.release(true);
  }
  armFailOpen() {
    this.clearFailOpenTimer();
    this.failOpenTimer = setTimeout(() => this.release(true), FAIL_OPEN_AFTER_MS);
    this.failOpenTimer.unref?.();
  }
  clearFailOpenTimer() {
    if (!this.failOpenTimer) return;
    clearTimeout(this.failOpenTimer);
    this.failOpenTimer = void 0;
  }
};
function getTerminalTransitionGate(output = process.stdout) {
  const globalState = globalThis;
  const existing = globalState[GLOBAL_GATE_KEY];
  if (existing !== null && typeof existing === "object" && "hold" in existing && typeof existing.hold === "function" && "reveal" in existing && typeof existing.reveal === "function" && "release" in existing && typeof existing.release === "function") {
    const gate2 = existing;
    Object.setPrototypeOf(gate2, TerminalTransitionGate.prototype);
    if (typeof gate2.hasVisibleFrame !== "boolean") {
      gate2.hasVisibleFrame = true;
    }
    return gate2;
  }
  const gate = new TerminalTransitionGate(void 0, output);
  globalState[GLOBAL_GATE_KEY] = gate;
  return gate;
}

// plugin/package-order.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync2, renameSync as renameSync2, existsSync } from "node:fs";
import { dirname as dirname2, isAbsolute, join as join5, normalize } from "node:path";
import { fileURLToPath } from "node:url";
function entrySource(entry) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object" || !("source" in entry)) return void 0;
  const source = entry.source;
  return typeof source === "string" ? source : void 0;
}
function npmPackageName(source) {
  if (!source.startsWith("npm:")) return void 0;
  const spec = source.slice(4).trim();
  if (!spec) return void 0;
  if (!spec.startsWith("@")) return spec.split("@", 1)[0] || void 0;
  const slash = spec.indexOf("/");
  if (slash < 0) return void 0;
  const version = spec.indexOf("@", slash);
  return version < 0 ? spec : spec.slice(0, version);
}
function gitRepositoryIdentity(source) {
  let value = source.trim();
  const prefixed = value.startsWith("git:") && !value.startsWith("git://");
  if (prefixed) value = value.slice(4).trim();
  value = value.replace(/^git\+/, "");
  let host;
  let path;
  const scp = value.match(/^git@([^:]+):(.+)$/);
  if (scp) {
    if (!prefixed) return void 0;
    host = scp[1];
    path = scp[2];
  } else if (/^(?:https?|ssh|git):\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      host = parsed.hostname;
      path = parsed.pathname.replace(/^\/+/, "");
    } catch {
      return void 0;
    }
  } else if (prefixed) {
    const slash = value.indexOf("/");
    if (slash < 0) return void 0;
    host = value.slice(0, slash);
    path = value.slice(slash + 1);
  } else {
    return void 0;
  }
  path = path.split(/[?#]/, 1)[0].split("@", 1)[0].replace(/\/+$/, "").replace(/\.git$/i, "");
  if (!host || !path || !path.includes("/")) return void 0;
  return { host: host.toLowerCase(), path };
}
function isSelfEntry(entry, self, baseDir) {
  const source = entrySource(entry);
  if (!source) return false;
  const npmName = npmPackageName(source);
  if (npmName) return npmName === self.name;
  const repository = gitRepositoryIdentity(source);
  if (repository) {
    return repository.host === self.repository?.host && repository.path === self.repository.path;
  }
  if (/^(?:git:|https?:|ssh:)/i.test(source)) return false;
  try {
    const resolved = normalize(isAbsolute(source) ? source : join5(baseDir, source));
    return resolved === self.dir;
  } catch {
    return false;
  }
}
function resolveSelfPackage() {
  let dir = dirname2(fileURLToPath(import.meta.url));
  for (let i = 0; i < 3; i += 1) {
    const manifest = join5(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync3(manifest, "utf8"));
        if (parsed.pi?.extensions && typeof parsed.name === "string") {
          const repositoryUrl = typeof parsed.repository === "string" ? parsed.repository : typeof parsed.repository?.url === "string" ? parsed.repository.url : void 0;
          return {
            dir: normalize(dir),
            name: parsed.name,
            repository: repositoryUrl ? gitRepositoryIdentity(repositoryUrl) : void 0
          };
        }
      } catch {
      }
    }
    const parent = dirname2(dir);
    if (parent === dir) return void 0;
    dir = parent;
  }
  return void 0;
}
function ensureFirstPackage(agentDir, env = process.env) {
  if (env.PI_TUI_KEEP_PACKAGE_ORDER === "1") return { adjusted: false, reason: "disabled-env" };
  const settingsPath = join5(agentDir, "settings.json");
  try {
    const raw = readFileSync3(settingsPath, "utf8");
    const settings = JSON.parse(raw);
    if (settings.piTuiKeepPackageOrder === true) return { adjusted: false, reason: "disabled-settings" };
    const packages = settings.packages;
    if (!Array.isArray(packages) || packages.length < 2) return { adjusted: false };
    const self = resolveSelfPackage();
    if (!self) return { adjusted: false, reason: "self-not-found" };
    const index = packages.findIndex((entry) => isSelfEntry(entry, self, agentDir));
    if (index <= 0) return { adjusted: false };
    const next = [...packages];
    const [selfEntry] = next.splice(index, 1);
    next.unshift(selfEntry);
    settings.packages = next;
    const tmpPath = `${settingsPath}.pi-tui.tmp`;
    writeFileSync2(tmpPath, JSON.stringify(settings, null, "	") + "\n");
    renameSync2(tmpPath, settingsPath);
    return { adjusted: true };
  } catch {
    return { adjusted: false, reason: "error" };
  }
}

// plugin/screen-transition.ts
var CLEAR_VISIBLE_SCREEN2 = "\x1B[2J\x1B[H";
var DIRTY_RENDER_SUFFIX = "\0";
var TRANSITION_SETTLE_MS = 32;
function isInteractiveLaunch() {
  if (!process.stdout.isTTY) return false;
  const nonInteractiveFlags = /* @__PURE__ */ new Set([
    "-p",
    "--print",
    "--help",
    "-h",
    "--version",
    "-v",
    "--list-models",
    "--export"
  ]);
  return process.argv.slice(2).every((arg) => !nonInteractiveFlags.has(arg) && !arg.startsWith("--mode"));
}
function isMainScreenTui2(tui) {
  return tui.mode === "regular" && typeof tui.captureRenderState === "function" && typeof tui.restoreRenderState === "function";
}
function hasImageLine(lines) {
  return lines.some((line) => line.includes("\x1B_G") || line.includes("\x1B]1337;File="));
}
function isSafeRenderState(tui, state) {
  const width = tui.terminal.columns;
  const height = tui.terminal.rows;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    return false;
  }
  if (state.previousWidth !== width || state.previousHeight !== height) return false;
  if (!Array.isArray(state.previousLines) || state.previousLines.length === 0) return false;
  if (hasImageLine(state.previousLines)) return false;
  if (!Number.isSafeInteger(state.previousViewportTop) || state.previousViewportTop < 0) return false;
  return state.previousViewportTop === Math.max(0, state.previousLines.length - height);
}
function isPristineRenderState(state) {
  return Array.isArray(state.previousLines) && state.previousLines.length === 0 && state.previousWidth === 0 && state.previousHeight === 0 && state.previousViewportTop === 0 && state.cursorRow === 0 && state.hardwareCursorRow === 0 && state.maxLinesRendered === 0;
}
function hasStableRenderState(left, right) {
  if (left.previousWidth !== right.previousWidth || left.previousHeight !== right.previousHeight || left.previousViewportTop !== right.previousViewportTop || left.previousLines.length !== right.previousLines.length) {
    return false;
  }
  return left.previousLines.every((line, index) => line === right.previousLines[index]);
}
function flashVisibleScreen(tui, output = process.stdout) {
  if (!output.isTTY || !isMainScreenTui2(tui) || tui.hasOverlay()) return void 0;
  let state;
  try {
    state = tui.captureRenderState();
  } catch {
    return void 0;
  }
  if (!isPristineRenderState(state) && !isSafeRenderState(tui, state)) return void 0;
  try {
    tui.terminal.write(CLEAR_VISIBLE_SCREEN2);
    return state;
  } catch {
    forceRestoreClearedScreen(tui);
    return void 0;
  }
}
function forceRestoreClearedScreen(tui) {
  try {
    tui.renderNow(true);
  } catch {
  }
}
function captureStableMainScreenState(tui) {
  try {
    tui.renderNow(false);
    if (!isMainScreenTui2(tui) || tui.hasOverlay()) return void 0;
    const firstState = tui.captureRenderState();
    if (!isSafeRenderState(tui, firstState)) return void 0;
    tui.renderNow(false);
    const state = tui.captureRenderState();
    if (!isSafeRenderState(tui, state) || !hasStableRenderState(firstState, state)) {
      return void 0;
    }
    return state;
  } catch {
    return void 0;
  }
}
function revealPreparedMainScreen(tui, deferred, screenAlreadyCleared) {
  try {
    if (deferred) tui.requestRender(false);
    else tui.renderNow(false);
    return true;
  } catch {
    if (screenAlreadyCleared) forceRestoreClearedScreen(tui);
    return false;
  }
}
function restoreVisibleMainScreen(tui, preClearState, deferred = false) {
  const screenAlreadyCleared = preClearState !== void 0;
  const state = preClearState ?? captureStableMainScreenState(tui);
  if (!state) {
    if (screenAlreadyCleared) forceRestoreClearedScreen(tui);
    return false;
  }
  if (!isMainScreenTui2(tui)) {
    if (screenAlreadyCleared) forceRestoreClearedScreen(tui);
    return false;
  }
  if (screenAlreadyCleared && isPristineRenderState(state)) {
    return revealPreparedMainScreen(tui, deferred, true);
  }
  const top = state.previousViewportTop;
  const bottom = Math.min(state.previousLines.length, top + state.previousHeight);
  if (bottom <= top) {
    if (screenAlreadyCleared) forceRestoreClearedScreen(tui);
    return false;
  }
  const previousLines = state.previousLines.map(
    (line, index) => index >= top && index < bottom ? `${line}${DIRTY_RENDER_SUFFIX}` : line
  );
  try {
    tui.restoreRenderState({
      ...state,
      previousLines,
      cursorRow: top,
      hardwareCursorRow: top,
      maxLinesRendered: 0
    });
  } catch {
    try {
      tui.restoreRenderState(state);
    } catch {
    }
    if (screenAlreadyCleared) forceRestoreClearedScreen(tui);
    else tui.renderNow(false);
    return false;
  }
  if (!screenAlreadyCleared) tui.terminal.write(CLEAR_VISIBLE_SCREEN2);
  return revealPreparedMainScreen(tui, deferred, screenAlreadyCleared);
}

// plugin/editor.ts
import {
  CustomEditor
} from "@earendil-works/pi-coding-agent";
import {
  CURSOR_MARKER,
  stripTerminalSequences as stripTerminalSequences4,
  truncateToWidth as truncateToWidth3,
  visibleWidth as visibleWidth7
} from "@earendil-works/pi-tui";

// renderer/editor.ts
import { stripTerminalSequences as stripTerminalSequences3, visibleWidth as visibleWidth6 } from "@earendil-works/pi-tui";
function plainLine(line) {
  return stripTerminalSequences3(line);
}
function isEditorBorder(line) {
  const plain = plainLine(line);
  return /^─+$/.test(plain) || /^─── [↑↓] \d+ more (?:─+|\.{1,3})$/.test(plain);
}
function findBottomBorder(lines) {
  for (let index = lines.length - 1; index >= 2; index -= 1) {
    if (isEditorBorder(lines[index] ?? "")) return index;
  }
  return -1;
}
function splitNativeEditorRender(lines) {
  const bottomBorderIndex = findBottomBorder(lines);
  if (bottomBorderIndex < 2) return { editor: [...lines], autocomplete: [] };
  return {
    editor: lines.slice(0, bottomBorderIndex + 1),
    autocomplete: lines.slice(bottomBorderIndex + 1)
  };
}
function insertTopBorderStatus(baseLines, options) {
  if (baseLines.length === 0) return [...baseLines];
  const top = baseLines[0] ?? "";
  const plain = plainLine(top);
  if (!/^─+$/.test(plain)) return [...baseLines];
  const segment = options.left ? ` ${options.left} ` : "";
  const segmentWidth = visibleWidth6(segment);
  const lineWidth = visibleWidth6(plain);
  if (segmentWidth === 0 || segmentWidth > lineWidth - 4) return [...baseLines];
  const fill = "\u2500".repeat(lineWidth - segmentWidth - 2);
  const decorated = `${options.borderColor("\u2500\u2500")}${segment}${options.borderColor(fill)}`;
  return [decorated, ...baseLines.slice(1)];
}

// status/provider-status.ts
var PROVIDER_CORAL = {
  dark: {
    truecolor: "38;2;217;119;87",
    "256color": "38;5;173"
  },
  light: {
    truecolor: "38;2;168;78;51",
    "256color": "38;5;130"
  }
};
function isLightThemeName(name) {
  return /(?:^|[-_])(light|latte|dawn)(?:$|[-_])/.test(name?.toLowerCase() ?? "");
}
function colorProviderBrand(theme, text) {
  const palette = isLightThemeName(theme.name) ? PROVIDER_CORAL.light : PROVIDER_CORAL.dark;
  const mode = typeof theme.getColorMode === "function" ? theme.getColorMode() : "truecolor";
  return `\x1B[${palette[mode]}m${text}\x1B[39m`;
}
function formatMoney(amount, currency) {
  const value = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return currency === "CNY" ? `\xA5${value}` : `$${value}`;
}
function remainingColor(percent) {
  if (percent <= 10) return "error";
  if (percent <= 30) return "warning";
  if (percent < 60) return "accent";
  return "success";
}
function formatResetCountdown(resetMs2, now = Date.now()) {
  if (resetMs2 === null) return "";
  const remainingMinutes = Math.max(0, Math.ceil((resetMs2 - now) / 6e4));
  if (remainingMinutes < 60) return `${remainingMinutes}m`;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
}
function providerBrand(brandName) {
  return sanitizeSingleLine(brandName) || "Provider";
}
function buildSubscriptionSegment(state, theme, now = Date.now()) {
  const snapshot = state.snapshot;
  if (!snapshot || snapshot.billingMode !== "subscription" && snapshot.billingMode !== "hybrid" || snapshot.windows.length === 0) {
    return null;
  }
  const renderWindow = (withReset) => snapshot.windows.map((window2) => {
    const label = sanitizeQuotaWindowLabel(window2.label);
    const percent = theme.bold(`${Math.round(window2.remainingPercent)}%`);
    const base = theme.fg(remainingColor(window2.remainingPercent), `${label} ${percent}`);
    if (!withReset) return base;
    const reset = formatResetCountdown(window2.resetMs, now);
    return reset ? `${base} ${theme.fg("muted", reset)}` : base;
  }).join(theme.fg("muted", " \xB7 "));
  return {
    id: "subscription",
    text: renderWindow(true),
    compactText: renderWindow(false),
    priority: 3
  };
}
function buildEditorProviderSegments(state, theme, now = Date.now()) {
  if (!state.provider) return null;
  const snapshot = state.status === "ready" ? state.snapshot : null;
  const brand = providerBrand(state.provider.brandName);
  return {
    provider: {
      id: "provider",
      text: colorProviderBrand(theme, brand),
      priority: 4
    },
    balance: snapshot?.balance && (snapshot.billingMode === "api" || snapshot.billingMode === "hybrid") ? {
      id: "balance",
      text: theme.fg("warning", formatMoney(snapshot.balance.amount, snapshot.balance.currency)),
      priority: 3
    } : null,
    subscription: snapshot ? buildSubscriptionSegment(state, theme, now) : null
  };
}

// plugin/editor.ts
var MIN_DECORATED_WIDTH = 6;
function cropAutocompleteLines(lines, maxHeight) {
  const height = Math.max(0, Math.floor(maxHeight));
  if (height === 0) return [];
  if (lines.length <= height) return [...lines];
  const selectedIndex = lines.findIndex(
    (line) => stripTerminalSequences4(line).trimStart().startsWith("\u2192 ")
  );
  const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const start = Math.max(
    0,
    Math.min(targetIndex - Math.floor((height - 1) / 2), lines.length - height)
  );
  return lines.slice(start, start + height);
}
function formatModel(ctx) {
  const model = ctx.model;
  if (!model) return "no model";
  return sanitizeSingleLine(model.provider ? `${model.provider}/${model.id}` : model.id) || "no model";
}
function formatCompactModel(ctx) {
  return sanitizeSingleLine(ctx.model?.id ?? "no model") || "no model";
}
function getFrameStatus(ctx, theme, glyphs, width, settings, providerState, timer) {
  const thinking = ctx.thinkingLevel ?? "off";
  const color = (role, text) => theme.fg(role, text);
  const provider = providerState ? buildEditorProviderSegments(providerState, theme) : null;
  const leftById = {
    provider: provider?.provider ?? {
      id: "provider",
      text: "",
      priority: 4
    },
    model: {
      id: "model",
      text: color("accent", formatCompactModel(ctx)),
      compactText: color("accent", formatCompactModel(ctx)),
      priority: 0,
      required: true
    },
    thinking: {
      id: "thinking",
      text: color(thinkingStatusColor(thinking), thinking),
      priority: 2
    },
    duration: {
      id: "duration",
      text: timer.state === "idle" ? "" : color(durationStatusColor(timer.state), formatElapsed(timer.elapsedMs)),
      priority: 1
    },
    balance: provider?.balance ?? {
      id: "balance",
      text: "",
      priority: 3
    },
    subscription: provider?.subscription ?? {
      id: "subscription",
      text: "",
      priority: 3
    }
  };
  const left = settings.editorLeft.map((id) => leftById[id]).filter((segment) => segment.text);
  return layoutEditorStatus(left, [], width);
}
var PiUiEditor = class extends CustomEditor {
  ctx;
  getGlyphs;
  settings;
  getFooterHeight;
  getProviderStatus;
  getTimer;
  appKeybindings;
  autocompleteOverlay;
  autocompleteOverlayOptions;
  autocompleteOverlayLines = [];
  autocompleteOverlayHandle;
  autocompleteOverlayToken = 0;
  frameHeight = 0;
  frameCursorRow = -1;
  suppressAutocompleteOverlay = false;
  disposed = false;
  hooks;
  constructor(tui, theme, keybindings, ctx, getGlyphs = () => resolveGlyphs("unicode"), settings = resolveStatusSettings({}), getFooterHeight = () => 0, getProviderStatus = () => void 0, hooks = {}, getTimer = () => ({ state: "idle", elapsedMs: 0 })) {
    super(tui, theme, keybindings);
    this.ctx = ctx;
    this.getGlyphs = getGlyphs;
    this.settings = settings;
    this.getFooterHeight = getFooterHeight;
    this.getProviderStatus = getProviderStatus;
    this.hooks = hooks;
    this.getTimer = getTimer;
    this.appKeybindings = keybindings;
    this.autocompleteOverlay = {
      setLines: (lines) => {
        this.autocompleteOverlayLines = [...lines];
      },
      invalidate() {
      },
      render: (overlayWidth) => this.autocompleteOverlayLines.map((line) => {
        const clipped = truncateToWidth3(line, overlayWidth, "");
        return `${clipped}${" ".repeat(Math.max(0, overlayWidth - visibleWidth7(clipped)))}`;
      })
    };
    const margin = {};
    Object.defineProperty(margin, "bottom", {
      enumerable: true,
      get: () => this.frameHeight + Math.max(0, this.getFooterHeight())
    });
    this.autocompleteOverlayOptions = {
      anchor: "bottom-left",
      width: 1,
      margin,
      nonCapturing: true
    };
  }
  render(width) {
    if (width < MIN_DECORATED_WIDTH) {
      const baseLines2 = super.render(width);
      return this.finishRender(this.renderWithAutocompleteOverlay(baseLines2, baseLines2, width));
    }
    const baseLines = super.render(width);
    const renderedLines = insertTopBorderStatus(baseLines, {
      left: getFrameStatus(
        this.ctx,
        this.ctx.ui.theme,
        this.getGlyphs(),
        width,
        this.settings,
        this.getProviderStatus(),
        this.getTimer()
      ).left,
      borderColor: (text) => this.borderColor(text)
    });
    return this.finishRender(this.renderWithAutocompleteOverlay(baseLines, renderedLines, width));
  }
  handleInput(data) {
    const submitsInput = this.appKeybindings.matches(data, "tui.input.submit");
    const submitsAutocomplete = this.tui.mode === "regular" && this.autocompleteOverlayHandle && submitsInput;
    if (!submitsAutocomplete) {
      if (submitsInput && this.getText().trim() === "/reload") this.hooks.onReloadSubmit?.();
      super.handleInput(data);
      return;
    }
    const originalOnSubmit = this.onSubmit;
    let didSubmit = false;
    this.suppressAutocompleteOverlay = true;
    this.hideAutocompleteOverlay();
    this.onSubmit = (text) => {
      didSubmit = true;
      if (text.trim() === "/reload") this.hooks.onReloadSubmit?.();
      else this.tui.renderNow(false);
      originalOnSubmit?.(text);
    };
    try {
      super.handleInput(data);
      if (!didSubmit) this.tui.renderNow(false);
    } finally {
      this.onSubmit = originalOnSubmit;
      this.suppressAutocompleteOverlay = false;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.hideAutocompleteOverlay();
  }
  finishRender(lines) {
    this.hooks.onFrameRendered?.();
    return lines;
  }
  renderWithAutocompleteOverlay(baseLines, renderedLines, width) {
    const autocompleteCount = splitNativeEditorRender(baseLines).autocomplete.length;
    const frameEnd = Math.max(0, renderedLines.length - autocompleteCount);
    const frameLines = renderedLines.slice(0, frameEnd);
    this.frameHeight = frameLines.length;
    this.frameCursorRow = frameLines.findIndex((line) => line.includes(CURSOR_MARKER));
    if (this.tui.mode !== "regular") {
      this.updateAutocompleteOverlay([], width);
      return [...renderedLines];
    }
    const autocompleteLines = this.suppressAutocompleteOverlay ? [] : renderedLines.slice(frameEnd);
    const layout = autocompleteLines.length > 0 ? this.resolveAutocompleteOverlayLayout(autocompleteLines.length) : void 0;
    if (layout?.maxHeight === 0) {
      this.updateAutocompleteOverlay([], width);
      return [...renderedLines];
    }
    this.updateAutocompleteOverlay(autocompleteLines, width, layout);
    return frameLines;
  }
  hideAutocompleteOverlay() {
    this.autocompleteOverlayToken += 1;
    this.autocompleteOverlay.setLines([]);
    delete this.autocompleteOverlayOptions.row;
    this.autocompleteOverlayHandle?.hide();
    this.autocompleteOverlayHandle = void 0;
  }
  updateAutocompleteOverlay(lines, width, initialLayout = this.resolveAutocompleteOverlayLayout(lines.length)) {
    const initialLines = initialLayout ? cropAutocompleteLines(lines, initialLayout.maxHeight) : [...lines];
    this.setAutocompleteOverlayLines(initialLines);
    this.setAutocompleteOverlayRow(initialLayout);
    this.autocompleteOverlayOptions.width = Math.max(1, width);
    const token = ++this.autocompleteOverlayToken;
    if (initialLines.length > 0) {
      queueMicrotask(() => {
        if (this.disposed || token !== this.autocompleteOverlayToken) return;
        const layout = this.resolveAutocompleteOverlayLayout(lines.length);
        const visibleLines = layout ? cropAutocompleteLines(lines, layout.maxHeight) : [...lines];
        const linesChanged = this.setAutocompleteOverlayLines(visibleLines);
        const positionChanged = this.setAutocompleteOverlayRow(layout);
        if (visibleLines.length === 0) {
          this.autocompleteOverlayHandle?.hide();
          this.autocompleteOverlayHandle = void 0;
          return;
        }
        if (!this.autocompleteOverlayHandle) {
          this.autocompleteOverlayHandle = this.tui.showOverlay(
            this.autocompleteOverlay,
            this.autocompleteOverlayOptions
          );
        } else if (positionChanged || linesChanged) {
          this.tui.requestRender();
        }
      });
      return;
    }
    if (lines.length === 0 && this.autocompleteOverlayHandle) {
      queueMicrotask(() => {
        if (token !== this.autocompleteOverlayToken || !this.autocompleteOverlayHandle) return;
        this.autocompleteOverlayHandle.hide();
        this.autocompleteOverlayHandle = void 0;
      });
    }
  }
  resolveAutocompleteOverlayLayout(autocompleteHeight) {
    if (!isMainScreenTui2(this.tui) || this.frameCursorRow < 0) {
      return void 0;
    }
    let state;
    try {
      state = this.tui.captureRenderState();
    } catch {
      return void 0;
    }
    if (!isSafeRenderState(this.tui, state)) return void 0;
    const editorTop = state.hardwareCursorRow - this.frameCursorRow - state.previousViewportTop;
    const maxHeight = Math.max(0, Math.min(editorTop, this.tui.terminal.rows));
    return {
      row: Math.max(0, editorTop - Math.min(autocompleteHeight, maxHeight)),
      maxHeight
    };
  }
  setAutocompleteOverlayLines(lines) {
    if (lines.length === this.autocompleteOverlayLines.length && lines.every((line, index) => line === this.autocompleteOverlayLines[index])) {
      return false;
    }
    this.autocompleteOverlay.setLines(lines);
    return true;
  }
  setAutocompleteOverlayRow(layout) {
    if (!layout) {
      if (this.autocompleteOverlayOptions.row === void 0) return false;
      delete this.autocompleteOverlayOptions.row;
      return true;
    }
    if (this.autocompleteOverlayOptions.row === layout.row) return false;
    this.autocompleteOverlayOptions.row = layout.row;
    return true;
  }
};

// plugin/footer.ts
import {
  truncateToWidth as truncateToWidth4
} from "@earendil-works/pi-tui";
var FOOTER_PADDING_X = 1;
var ProjectStatusFooter = class {
  theme;
  footerData;
  projectStatus;
  cwd;
  beforeDispose;
  getGlyphs;
  settings;
  runtimeStatus;
  reportHeight;
  requestStatusRender;
  getTimer;
  getSessionStatus;
  getContextUsage;
  getContextWindow;
  getAutoCompactionEnabled;
  statusQueriesStarted = false;
  disposed = false;
  constructor(tui, theme, footerData, projectStatus, beforeDispose, getGlyphs = () => resolveGlyphs("unicode"), settings = resolveStatusSettings({}), runtimeStatus, cwd = process.cwd(), reportHeight, requestStatusRender = () => tui.requestRender(), getTimer = () => ({ state: "idle", elapsedMs: 0 }), getSessionStatus = () => ({
    sessionId: "",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 0,
    turns: 0,
    compactions: 0
  }), getContextUsage = () => void 0, getContextWindow = () => void 0, getAutoCompactionEnabled = () => false) {
    this.theme = theme;
    this.footerData = footerData;
    this.projectStatus = projectStatus;
    this.beforeDispose = beforeDispose;
    this.getGlyphs = getGlyphs;
    this.settings = settings;
    this.runtimeStatus = runtimeStatus;
    this.cwd = cwd;
    this.reportHeight = reportHeight;
    this.requestStatusRender = requestStatusRender;
    this.getTimer = getTimer;
    this.getSessionStatus = getSessionStatus;
    this.getContextUsage = getContextUsage;
    this.getContextWindow = getContextWindow;
    this.getAutoCompactionEnabled = getAutoCompactionEnabled;
  }
  startStatusQueries() {
    if (this.disposed || this.statusQueriesStarted) return;
    this.statusQueriesStarted = true;
    this.projectStatus?.connect(this.footerData, this.requestStatusRender);
    this.runtimeStatus?.connect(this.requestStatusRender);
  }
  invalidate() {
  }
  render(width) {
    const glyphs = this.getGlyphs();
    const paddingX = width >= FOOTER_PADDING_X * 2 + 1 ? FOOTER_PADDING_X : 0;
    const contentWidth = Math.max(1, width - paddingX * 2);
    const projectLine = renderProjectStatusLine(
      {
        // 无控制器（Git 段未启用或查询未接线）时占位为待查询，
        // 保证 Footer 结构从首帧起定型。
        ...this.projectStatus?.getSnapshot() ?? { cwd: this.cwd, branch: null, refreshState: this.projectStatus ? "idle" : void 0 },
        runtime: this.runtimeStatus?.getSnapshot(),
        duration: this.getTimer()
      },
      contentWidth,
      this.theme,
      void 0,
      glyphs,
      this.settings.footerPrimary
    );
    const contextUsage = this.getContextUsage();
    const usageSegments = buildEditorUsageSegments(
      this.getSessionStatus(),
      contextUsage,
      this.getContextWindow(),
      this.theme,
      glyphs,
      contextUsage === void 0 ? this.settings.footerUsage.filter((segment) => segment === "context") : this.settings.footerUsage,
      this.getAutoCompactionEnabled()
    );
    const usageLine = usageSegments.length > 0 ? `${this.theme.fg("muted", formatLeadingIcon(glyphs.usage))}${renderStatusLineSegments(usageSegments, contentWidth, this.theme.fg("muted", " \xB7 "))}` : "";
    const showExtensions = this.settings.footerExtra.includes("extensions");
    const statuses = showExtensions ? [...this.footerData.getExtensionStatuses().entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, status]) => sanitizeStyledSingleLine(status)).filter(Boolean) : [];
    const lines = projectLine ? [projectLine] : [];
    if (usageLine) lines.push(usageLine);
    if (statuses.length > 0) {
      lines.push(truncateToWidth4(statuses.join(" \xB7 "), contentWidth, this.theme.fg("dim", "\u2026")));
    }
    this.reportHeight?.(lines.length);
    return paddingX > 0 ? lines.map((line) => `${" ".repeat(paddingX)}${line}`) : lines;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.beforeDispose?.();
    this.reportHeight?.(0);
    this.projectStatus?.disconnect();
    this.runtimeStatus?.disconnect();
  }
};

// plugin/lifecycle.ts
function registerPiTuiLifecycle(pi, output = process.stdout, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const agentDir = dependencies.agentDir ?? getAgentDir();
  const configPath = piTuiConfigPath(agentDir);
  const readConfig = dependencies.loadConfig ?? loadPiTuiConfig;
  const watchAutoCompactionSettings = dependencies.watchAutoCompactionSettings ?? watchAgentSettings;
  const readAutoCompactionEnabled = dependencies.readAutoCompactionEnabled ?? ((ctx) => {
    try {
      return SettingsManager.create(ctx.cwd, agentDir, {
        projectTrusted: ctx.isProjectTrusted?.() ?? false
      }).getCompactionEnabled();
    } catch {
      return false;
    }
  });
  let loadedConfig = readConfig(configPath);
  let currentConfig = loadedConfig.config;
  let configWarningsShown = false;
  let active = false;
  let cleanupEditor;
  let cleanupFooter;
  let cleanupHeader;
  let projectStatus;
  let runtimeStatus;
  let providerUsage;
  let turnTimer;
  let autoCompactionStatus;
  let cleanupSpinner;
  const turnTelemetry = new TurnTelemetryTracker();
  const getTurnTelemetryGlyphs = () => resolveGlyphs("auto", env);
  let installedTui;
  let activeFooter;
  let statusQueriesStarted = false;
  let deferredStatusImmediate;
  let modelSwitchRepaintImmediate;
  const cancelModelSwitchRepaint = () => {
    if (!modelSwitchRepaintImmediate) return;
    clearImmediate(modelSwitchRepaintImmediate);
    modelSwitchRepaintImmediate = void 0;
  };
  const scheduleModelSwitchRepaint = () => {
    if (modelSwitchRepaintImmediate) return;
    modelSwitchRepaintImmediate = setImmediate(() => {
      modelSwitchRepaintImmediate = void 0;
      const tui = installedTui;
      if (!active || !tui || transitionGate?.isHolding()) return;
      restoreVisibleMainScreen(tui);
    });
    modelSwitchRepaintImmediate.unref?.();
  };
  let originalEditorFactory;
  let lastOwnEditorFactory;
  let installedEditorRef;
  const transitionGate = dependencies.transitionGate === null ? void 0 : dependencies.transitionGate ?? (output === process.stdout && isInteractiveLaunch() ? getTerminalTransitionGate() : void 0);
  const requestStatusRender = () => {
    if (transitionGate?.isHolding()) return;
    installedTui?.requestRender();
  };
  let transitionRevealEnabled = true;
  let transitionRevealTimer;
  const layoutState = { footerHeight: 0 };
  statusQueriesStarted = false;
  if (deferredStatusImmediate) {
    clearImmediate(deferredStatusImmediate);
    deferredStatusImmediate = void 0;
  }
  const startStatusQueries = () => {
    if (statusQueriesStarted || !active) return;
    statusQueriesStarted = true;
    activeFooter?.startStatusQueries();
    void providerUsage?.start();
  };
  const scheduleStatusQueries = () => {
    if (statusQueriesStarted || deferredStatusImmediate) return;
    deferredStatusImmediate = setImmediate(() => {
      deferredStatusImmediate = void 0;
      startStatusQueries();
    });
    deferredStatusImmediate.unref?.();
  };
  const ensureStatusQueriesScheduled = () => {
    if (!statusQueriesStarted) scheduleStatusQueries();
  };
  const scheduleTransitionReveal = (tui) => {
    if (!transitionRevealEnabled || !transitionGate?.isHolding()) return;
    if (layoutState.footerHeight < 1) return;
    if (transitionRevealTimer) clearTimeout(transitionRevealTimer);
    transitionRevealTimer = setTimeout(() => {
      transitionRevealTimer = void 0;
      if (!transitionRevealEnabled || !transitionGate.isHolding()) return;
      if (layoutState.footerHeight < 1) return;
      transitionGate.reveal(tui);
      startStatusQueries();
    }, TRANSITION_SETTLE_MS);
    transitionRevealTimer.unref?.();
  };
  pi.registerEntryRenderer?.(
    TURN_TELEMETRY_ENTRY_TYPE,
    (entry, _options, theme) => {
      const telemetry = readTurnTelemetryEntryData(entry.data);
      if (!telemetry) return void 0;
      return new Text(formatTurnTelemetry(telemetry, theme, getTurnTelemetryGlyphs()), 1, 0);
    }
  );
  pi.registerEntryRenderer?.(TURN_DURATION_ENTRY_TYPE, () => void 0);
  const disposeInstalledControllers = () => {
    cancelModelSwitchRepaint();
    installedEditorRef?.dispose();
    installedEditorRef = void 0;
    activeFooter = void 0;
    turnTimer?.dispose();
    autoCompactionStatus?.dispose();
    providerUsage?.dispose();
    projectStatus?.dispose();
    runtimeStatus?.dispose();
    turnTimer = void 0;
    autoCompactionStatus = void 0;
    providerUsage = void 0;
    projectStatus = void 0;
    runtimeStatus = void 0;
    cleanupFooter = void 0;
    cleanupHeader = void 0;
    cleanupEditor = void 0;
    cleanupSpinner = void 0;
    installedTui = void 0;
  };
  const installUi = (ctx) => {
    if (active) {
      statusQueriesStarted = false;
      active = false;
      disposeInstalledControllers();
    }
    transitionRevealEnabled = true;
    if (transitionRevealTimer) clearTimeout(transitionRevealTimer);
    transitionRevealTimer = void 0;
    const currentFactory = ctx.ui.getEditorComponent();
    const previousFactory = currentFactory !== void 0 && currentFactory === lastOwnEditorFactory ? originalEditorFactory : currentFactory;
    originalEditorFactory = previousFactory;
    const statusSettings = resolveStatusSettings(env, {
      preset: currentConfig.status.preset,
      segments: currentConfig.status.segments
    });
    const autoCompaction = currentConfig.appearance.editor && statusSettings.footerUsage.includes("context") ? new AutoCompactionStatusController(
      () => readAutoCompactionEnabled(ctx, agentDir),
      (onChange) => watchAutoCompactionSettings(agentDir, onChange),
      requestStatusRender
    ) : void 0;
    autoCompactionStatus = autoCompaction;
    const getGlyphs = () => resolveGlyphs("auto", env);
    const timer = statusSettings.editorLeft.includes("duration") ? new TurnTimerController(
      requestStatusRender,
      1e3,
      Date.now,
      readLatestTurnDuration(ctx.sessionManager?.getEntries?.() ?? [])
    ) : void 0;
    const usage = statusSettings.editorLeft.some(
      (segment) => segment === "provider" || segment === "balance" || segment === "subscription"
    ) ? new PiProviderUsageController(ctx, requestStatusRender, {
      refreshMs: currentConfig.data.providerRefreshMs,
      accessConfig: currentConfig.data.providerAccess
    }) : void 0;
    const runtime = statusSettings.footerPrimary.includes("runtime") ? new RuntimeStatusController(
      ctx.cwd,
      async (cwd, signal) => detectRuntimeStatus(
        cwd,
        async (command, args, commandCwd, commandSignal) => {
          const result = await pi.exec(command, [...args], {
            cwd: commandCwd,
            signal: commandSignal,
            timeout: 2500
          });
          return {
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code,
            killed: result.killed
          };
        },
        signal,
        env
      )
    ) : void 0;
    let activeTui;
    let preClearState;
    let headerInstalled = false;
    let installedEditor;
    let installedFooter;
    const controller = statusSettings.footerPrimary.includes("git") ? new ProjectStatusController(ctx.cwd, async (cwd, signal) => {
      try {
        const result = await pi.exec(
          "git",
          [
            "--no-optional-locks",
            "status",
            "--porcelain=v2",
            "--branch",
            "--show-stash",
            "--untracked-files=normal",
            "--ignore-submodules=dirty"
          ],
          { cwd, signal, timeout: 2e3 }
        );
        if (result.killed || result.code !== 0) return void 0;
        const status = parseGitStatusV2(result.stdout);
        if (!status.detached || !status.oid) return status;
        const tags = await pi.exec(
          "git",
          [
            "--no-optional-locks",
            "tag",
            "--points-at",
            status.oid,
            "--sort=refname"
          ],
          { cwd, signal, timeout: 2e3 }
        );
        if (tags.killed || tags.code !== 0) return status;
        const exactTag = tags.stdout.split("\n").map((tag) => tag.trim()).filter(Boolean)[0];
        return exactTag ? { ...status, exactTag } : status;
      } catch {
        return void 0;
      }
    }) : void 0;
    const ownFactory = (tui, theme, keybindings) => {
      activeTui = tui;
      installedTui = tui;
      transitionGate?.hookTerminal(tui.terminal);
      const editor = new PiUiEditor(
        tui,
        theme,
        keybindings,
        ctx,
        getGlyphs,
        statusSettings,
        () => layoutState.footerHeight,
        usage ? () => usage.getState() : void 0,
        {
          onReloadSubmit: () => {
            transitionRevealEnabled = false;
            transitionGate?.hold(tui, { clearVisibleScreen: true });
          },
          onFrameRendered: () => {
            if (transitionGate?.isHolding() && transitionRevealEnabled) scheduleTransitionReveal(tui);
            else scheduleStatusQueries();
          }
        },
        timer ? () => timer.getSnapshot() : void 0
      );
      installedEditor?.dispose();
      installedEditor = editor;
      installedEditorRef = editor;
      if (!transitionGate) preClearState = flashVisibleScreen(tui, output);
      return editor;
    };
    lastOwnEditorFactory = ownFactory;
    try {
      if (currentConfig.appearance.editor) ctx.ui.setEditorComponent(ownFactory);
      if (currentConfig.appearance.header && typeof ctx.ui.setHeader === "function") {
        ctx.ui.setHeader((tui) => new PiTuiHeader(
          () => ({
            version: VERSION2,
            model: formatModel(ctx),
            thinking: ctx.thinkingLevel ?? "off",
            cwd: ctx.cwd
          }),
          () => ctx.ui.theme,
          getGlyphs,
          tui.requestRender.bind(tui)
        ));
        headerInstalled = true;
      }
      ctx.ui.setFooter((tui, theme, footerData) => {
        activeTui ??= tui;
        installedTui = tui;
        activeFooter = installedFooter = new ProjectStatusFooter(
          tui,
          theme,
          footerData,
          controller,
          () => transitionGate?.hold(tui),
          getGlyphs,
          statusSettings,
          runtime,
          ctx.cwd,
          (height) => {
            layoutState.footerHeight = height;
          },
          requestStatusRender,
          () => timer?.getSnapshot() ?? { state: "idle", elapsedMs: 0 },
          () => collectSessionStatus(ctx.sessionManager),
          () => ctx.getContextUsage(),
          () => ctx.model?.contextWindow,
          () => autoCompaction?.getSnapshot() ?? false
        );
        if (transitionGate?.isHolding()) {
          installedFooter.render(Math.max(1, tui.terminal.columns));
        }
        return installedFooter;
      });
      if (currentConfig.advanced.spinner === "hidden") {
        ctx.ui.setWorkingVisible?.(false);
      } else {
        ctx.ui.setWorkingVisible?.(true);
        ctx.ui.setWorkingIndicator?.(
          currentConfig.advanced.spinner === "static" ? { frames: ["\u25CF"] } : void 0
        );
      }
      if (!transitionGate && activeTui && preClearState) {
        restoreVisibleMainScreen(activeTui, preClearState, true);
      }
    } catch (error) {
      if (deferredStatusImmediate) clearImmediate(deferredStatusImmediate);
      deferredStatusImmediate = void 0;
      installedEditor?.dispose();
      autoCompaction?.dispose();
      if (autoCompactionStatus === autoCompaction) autoCompactionStatus = void 0;
      controller?.dispose();
      runtime?.dispose();
      timer?.dispose();
      usage?.dispose();
      ctx.ui.setWorkingIndicator?.();
      ctx.ui.setWorkingVisible?.(true);
      try {
        ctx.ui.setFooter(void 0);
      } finally {
        try {
          if (headerInstalled) ctx.ui.setHeader(void 0);
        } finally {
          if (currentConfig.appearance.editor && ctx.ui.getEditorComponent() === ownFactory) {
            ctx.ui.setEditorComponent(previousFactory);
          }
        }
      }
      if (activeTui && preClearState) {
        restoreVisibleMainScreen(activeTui, preClearState);
      }
      if (transitionGate?.isHolding()) {
        if (activeTui) transitionGate.reveal(activeTui);
        else transitionGate.release(true);
      }
      throw error;
    }
    projectStatus = controller;
    runtimeStatus = runtime;
    providerUsage = usage;
    turnTimer = timer;
    cleanupEditor = currentConfig.appearance.editor ? () => {
      installedEditor?.dispose();
      installedEditor = void 0;
      if (ctx.ui.getEditorComponent() === ownFactory) {
        ctx.ui.setEditorComponent(previousFactory);
      }
    } : void 0;
    cleanupFooter = () => ctx.ui.setFooter(void 0);
    cleanupHeader = headerInstalled ? () => ctx.ui.setHeader(void 0) : void 0;
    cleanupSpinner = () => {
      ctx.ui.setWorkingIndicator?.();
      ctx.ui.setWorkingVisible?.(true);
    };
    active = true;
    ensureStatusQueriesScheduled();
    if (!currentConfig.appearance.editor) {
      if (transitionGate?.isHolding()) {
        if (activeTui) transitionGate.reveal(activeTui);
        else transitionGate.release(false);
      }
      startStatusQueries();
    }
    const previousCleanupFooter = cleanupFooter;
    cleanupFooter = () => {
      if (deferredStatusImmediate) clearImmediate(deferredStatusImmediate);
      deferredStatusImmediate = void 0;
      statusQueriesStarted = false;
      previousCleanupFooter?.();
    };
  };
  const uninstallUi = () => {
    if (!active && !projectStatus && !runtimeStatus && !providerUsage && !turnTimer && !autoCompactionStatus && !cleanupEditor && !cleanupFooter && !cleanupHeader && !cleanupSpinner) return;
    active = false;
    cancelModelSwitchRepaint();
    const controller = projectStatus;
    const runtime = runtimeStatus;
    const usage = providerUsage;
    const timer = turnTimer;
    const autoCompaction = autoCompactionStatus;
    const restoreFooter = cleanupFooter;
    const restoreHeader = cleanupHeader;
    const restoreEditor = cleanupEditor;
    const restoreSpinner = cleanupSpinner;
    projectStatus = void 0;
    runtimeStatus = void 0;
    providerUsage = void 0;
    turnTimer = void 0;
    autoCompactionStatus = void 0;
    cleanupFooter = void 0;
    cleanupHeader = void 0;
    cleanupEditor = void 0;
    cleanupSpinner = void 0;
    installedTui = void 0;
    timer?.dispose();
    autoCompaction?.dispose();
    usage?.dispose();
    controller?.dispose();
    runtime?.dispose();
    try {
      restoreFooter?.();
    } finally {
      try {
        restoreHeader?.();
      } finally {
        try {
          restoreEditor?.();
        } finally {
          restoreSpinner?.();
        }
      }
    }
  };
  let pendingOrderNotice;
  pi.on("session_start", (event, ctx) => {
    if (event.reason !== "reload") {
      if (ensureFirstPackage(agentDir, env).adjusted && !pendingOrderNotice) {
        pendingOrderNotice = setTimeout(() => {
          pendingOrderNotice = void 0;
          ctx.ui.notify?.("\u5DF2\u5C06 pi-tui \u8C03\u6574\u5230\u542F\u52A8\u9996\u4F4D\uFF0C\u91CD\u542F Pi \u540E\u751F\u6548", "info");
        }, 2500);
        pendingOrderNotice.unref?.();
      }
    }
    if (ctx.mode !== "tui") {
      transitionGate?.release(true);
      return;
    }
    if (!active) {
      transitionGate?.hold(installedTui, { clearVisibleScreen: true });
    }
    if (active) {
      transitionRevealEnabled = true;
      installedTui?.requestRender(true);
      return;
    }
    if (!configWarningsShown && loadedConfig.warnings.length > 0) {
      configWarningsShown = true;
      ctx.ui.notify(loadedConfig.warnings.join("\n"), "warning");
    }
    installUi(ctx);
  });
  pi.on("tool_execution_end", () => {
    projectStatus?.requestRefresh();
    runtimeStatus?.requestRefresh();
  });
  pi.on("model_select", (event) => {
    void providerUsage?.refresh(event.model, true);
    requestStatusRender();
    scheduleModelSwitchRepaint();
  });
  pi.on("turn_start", (event) => {
    if (currentConfig.data.telemetry) turnTelemetry.handle(event);
  });
  pi.on("message_start", (event) => {
    if (currentConfig.data.telemetry) turnTelemetry.handle(event);
  });
  pi.on("message_update", (event) => {
    if (currentConfig.data.telemetry) turnTelemetry.handle(event);
  });
  pi.on("message_end", (event) => {
    if (currentConfig.data.telemetry) turnTelemetry.handle(event);
    requestStatusRender();
  });
  pi.on("turn_end", (event) => {
    if (currentConfig.data.telemetry) turnTelemetry.handle(event);
  });
  pi.on("session_info_changed", requestStatusRender);
  pi.on("session_compact", requestStatusRender);
  pi.on("session_tree", requestStatusRender);
  pi.on("agent_start", (event) => {
    if (currentConfig.data.telemetry) turnTelemetry.handle(event);
    turnTimer?.start();
  });
  pi.on("agent_end", () => {
    const elapsedMs = turnTimer?.end();
    if (elapsedMs !== void 0) {
      pi.appendEntry(TURN_DURATION_ENTRY_TYPE, createTurnDurationEntryData(elapsedMs));
    }
  });
  pi.on("agent_settled", (event, ctx) => {
    void providerUsage?.refresh(ctx.model);
    if (!currentConfig.data.telemetry) return;
    const telemetry = turnTelemetry.handle(event);
    if (!telemetry || ctx.mode !== "tui") return;
    turnTimer?.restore(telemetry.totalMs);
    pi.appendEntry(TURN_TELEMETRY_ENTRY_TYPE, createTurnTelemetryEntryData(telemetry));
  });
  pi.on("session_shutdown", (event) => {
    turnTelemetry.reset();
    uninstallUi();
    if (event.reason === "quit") transitionGate?.release(false);
  });
}

// plugin/index.ts
function index_default(pi, output = process.stdout, dependencies = {}) {
  registerPiTuiLifecycle(pi, output, dependencies);
}
export {
  AutoCompactionStatusController,
  PiUiEditor,
  ProjectStatusFooter,
  index_default as default,
  flashVisibleScreen,
  formatModel,
  restoreVisibleMainScreen
};
