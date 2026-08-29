// 共享供应商目录。品牌收录与查询能力是两件事：目录负责识别和分组，
// queryKind 只标记已经有确定协议实现的查询后端。
//
// 主目录以 cc-switch 0b5da510168914b251481654a568c3ffacd62cf4 的
// Claude Code 77 个原始预设为固定快照，再通过 brandId 归并品牌；
// ZenMux 来自同一提交的 coding_plan 实现。

export type ProviderGroup = 'official' | 'relay';

export type BuiltinQueryKind =
  | 'claude-subscription'
  | 'codex-subscription'
  | 'gemini-subscription'
  | 'copilot-subscription'
  | 'grok-subscription'
  | 'zhipu'
  | 'kimi'
  | 'minimax-cn'
  | 'minimax-en'
  | 'volcengine'
  | 'deepseek'
  | 'stepfun'
  | 'siliconflow-cn'
  | 'siliconflow-en'
  | 'openrouter'
  | 'novita'
  | 'sub2api';

/** 查询所需凭据来源；none 表示目前只有品牌识别，没有确定的查询协议。 */
export type QueryAccess = 'api-key' | 'extra-credentials' | 'host-oauth' | 'generic' | 'none';

export interface ProviderRoute {
  /** 精确主机名；以 *. 开头时允许该域及其子域。 */
  host: string;
  /** 同一主机承载多个产品时，用路径前缀消歧。 */
  pathPrefix?: string;
}

export interface ProviderCatalogEntry {
  /** 路由/产品变体标识；同一品牌的国内站、国际站或套餐可以各自拥有独立条目。 */
  id: string;
  /** 去重后的品牌标识；界面和跨宿主统计以此为准。 */
  brandId: string;
  displayName: string;
  group: ProviderGroup;
  /** 仅描述站点、套餐或鉴权差异，不作为供应商品牌展示。 */
  variant?: string;
  /** cc-switch 中的原始预设名称；非预设查询后端为空。 */
  presetName?: string;
  /** 其它宿主中指向同一计费服务的预设名称。 */
  aliases?: readonly string[];
  routes: readonly ProviderRoute[];
  queryAccess: QueryAccess;
  queryKind?: BuiltinQueryKind;
}

export interface ProviderBrand {
  id: string;
  displayName: string;
  group: ProviderGroup;
  variants: readonly ProviderCatalogEntry[];
}

const route = (host: string, pathPrefix?: string): ProviderRoute => ({ host, pathPrefix });

const official = (
  id: string,
  displayName: string,
  presetName: string | undefined,
  routes: readonly ProviderRoute[],
  queryAccess: QueryAccess = 'none',
  queryKind?: BuiltinQueryKind,
  aliases: readonly string[] = [],
  brandId = id,
  variant?: string,
): ProviderCatalogEntry => ({
  id,
  brandId,
  displayName,
  variant,
  presetName,
  group: 'official',
  routes,
  queryAccess,
  queryKind,
  aliases,
});

const relay = (
  id: string,
  displayName: string,
  presetName: string | undefined,
  routes: readonly ProviderRoute[],
  queryAccess: QueryAccess = 'generic',
  queryKind?: BuiltinQueryKind,
  aliases: readonly string[] = [],
  brandId = id,
  variant?: string,
): ProviderCatalogEntry => ({
  id,
  brandId,
  displayName,
  variant,
  presetName,
  group: 'relay',
  routes,
  queryAccess,
  queryKind,
  aliases,
});

/** 第一方模型厂商、官方云平台及官方订阅。 */
export const OFFICIAL_PROVIDERS: readonly ProviderCatalogEntry[] = [
  official(
    'anthropic',
    'Anthropic',
    'Claude Official',
    [route('api.anthropic.com')],
    'host-oauth',
    'claude-subscription',
    ['Claude Desktop Official'],
  ),
  official('kimi-api', 'Kimi', 'Kimi', [route('api.moonshot.cn')], 'none', undefined, [], 'kimi', 'API'),
  official(
    'kimi',
    'Kimi',
    'Kimi For Coding',
    [route('api.kimi.com', '/coding')],
    'api-key',
    'kimi',
    [],
    'kimi',
    'Coding Plan',
  ),
  official(
    'volcengine-agent-plan',
    'Volcengine',
    '火山 Agent Plan',
    [route('ark.cn-beijing.volces.com', '/api/plan')],
    'extra-credentials',
    'volcengine',
    ['火山Agentplan'],
    'volcengine',
    'Agent Plan',
  ),
  official(
    'volcengine-coding-plan',
    'Volcengine',
    '火山 Coding Plan',
    [route('ark.cn-beijing.volces.com', '/api/coding')],
    'extra-credentials',
    'volcengine',
    [],
    'volcengine',
    'Coding Plan',
  ),
  official('byteplus', 'BytePlus', 'BytePlus', [route('ark.ap-southeast.bytepluses.com')]),
  official('doubao-seed', 'Doubao', 'DouBaoSeed', [route('ark.cn-beijing.volces.com')]),
  official(
    'gemini',
    'Gemini',
    'Gemini Native',
    [route('generativelanguage.googleapis.com')],
    'host-oauth',
    'gemini-subscription',
    ['Google Official'],
  ),
  official('deepseek', 'DeepSeek', 'DeepSeek', [route('api.deepseek.com')], 'api-key', 'deepseek'),
  official('zhipu', 'Zhipu', 'Zhipu GLM', [route('*.bigmodel.cn')], 'api-key', 'zhipu', [], 'zhipu', 'China'),
  official('z.ai', 'Zhipu', 'Zhipu GLM en', [route('api.z.ai')], 'api-key', 'zhipu', [], 'zhipu', 'International'),
  official(
    'baidu-qianfan-coding',
    'Baidu Qianfan',
    'Baidu Qianfan Coding Plan',
    [route('qianfan.baidubce.com', '/anthropic/coding')],
    'none',
    undefined,
    [],
    'baidu-qianfan',
    'Coding Plan',
  ),
  official(
    'baidu-qianfan-token-plan',
    'Baidu Qianfan',
    'Baidu Qianfan Token Plan',
    [route('qianfan.baidubce.com', '/anthropic/tokenplan')],
    'none',
    undefined,
    [],
    'baidu-qianfan',
    'Token Plan',
  ),
  official('bailian', 'Bailian', 'Bailian', [route('dashscope.aliyuncs.com')], 'none', undefined, ['Qwen Coder'], 'bailian', 'API'),
  official('bailian-coding', 'Bailian', 'Bailian For Coding', [route('coding.dashscope.aliyuncs.com')], 'none', undefined, [], 'bailian', 'Coding Plan'),
  official(
    'stepfun-cn',
    'StepFun',
    'StepFun',
    [route('api.stepfun.com')],
    'api-key',
    'stepfun',
    ['StepFun Step Plan'],
    'stepfun',
    'China',
  ),
  official('stepfun-en', 'StepFun', 'StepFun en', [route('api.stepfun.ai')], 'api-key', 'stepfun', [], 'stepfun', 'International'),
  official('kat-coder', 'KAT-Coder', 'KAT-Coder', [route('vanchin.streamlake.ai')]),
  official('longcat', 'LongCat', 'Longcat', [route('api.longcat.chat')]),
  official('minimax-cn', 'MiniMax', 'MiniMax', [route('api.minimaxi.com')], 'api-key', 'minimax-cn', [], 'minimax', 'China'),
  official('minimax-en', 'MiniMax', 'MiniMax en', [route('api.minimax.io')], 'api-key', 'minimax-en', [], 'minimax', 'International'),
  official('bailing', 'BaiLing', 'BaiLing', [route('api.tbox.cn')]),
  official('github-copilot', 'GitHub Copilot', 'GitHub Copilot', [route('api.githubcopilot.com')], 'host-oauth', 'copilot-subscription'),
  official('codex', 'Codex', 'Codex', [route('chatgpt.com', '/backend-api')], 'host-oauth', 'codex-subscription', ['openai-codex']),
  official('xai', 'xAI', 'xAI (Grok)', [route('api.x.ai')], 'host-oauth', 'grok-subscription', ['xAI (Grok) OAuth']),
  official('xiaomi-mimo', 'Xiaomi MiMo', 'Xiaomi MiMo', [route('api.xiaomimimo.com')], 'none', undefined, [], 'xiaomi-mimo', 'API'),
  official(
    'xiaomi-mimo-token-plan',
    'Xiaomi MiMo',
    'Xiaomi MiMo Token Plan (China)',
    [route('token-plan-cn.xiaomimimo.com')],
    'none',
    undefined,
    [],
    'xiaomi-mimo',
    'Token Plan (China)',
  ),
  official('aws-bedrock-aksk', 'AWS Bedrock', 'AWS Bedrock (AKSK)', [route('*.amazonaws.com')], 'none', undefined, [], 'aws-bedrock', 'AK/SK'),
  official('aws-bedrock-api-key', 'AWS Bedrock', 'AWS Bedrock (API Key)', [route('*.amazonaws.com')], 'none', undefined, [], 'aws-bedrock', 'API Key'),
  // cc-switch 其它宿主相对 Claude 目录新增的第一方服务。
  official('openai', 'OpenAI', undefined, [route('api.openai.com')], 'host-oauth', undefined, ['OpenAI Official']),
  official('azure-openai', 'Azure OpenAI', undefined, [route('*.openai.azure.com')], 'none', undefined, ['Azure OpenAI']),
  official(
    'tencent-hunyuan',
    'Tencent Hunyuan',
    undefined,
    [route('tokenhub.tencentmaas.com')],
    'none',
    undefined,
    ['Tencent Hunyuan'],
  ),
  official(
    'nous-research',
    'Nous Research',
    undefined,
    [route('inference-api.nousresearch.com')],
    'none',
    undefined,
    ['Nous Research'],
  ),
];

/** 第三方中转站与多模型聚合平台。 */
export const RELAY_PROVIDERS: readonly ProviderCatalogEntry[] = [
  relay('packycode', 'PackyCode', 'PackyCode', [route('www.packyapi.ai')]),
  relay('zetaapi', 'ZetaAPI', 'ZetaAPI', [route('api.zetaapi.ai')]),
  relay('apinebula', 'APINebula', 'APINebula', [route('apinebula.ai')]),
  relay('aicodemirror', 'AICodeMirror', 'AICodeMirror', [route('api.aicodemirror.ai')]),
  relay('patewayai', 'PatewayAI', 'PatewayAI', [route('api.pateway.ai')]),
  relay('fennoai', 'FennoAI', 'FennoAI', [route('api.fenno.ai')]),
  relay('runapi', 'RunAPI', 'RunAPI', [route('runapi.host'), route('runapi.co')]),
  relay('shengsuanyun', 'Shengsuanyun', 'Shengsuanyun', [route('router.shengsuanyun.com')]),
  relay('aigocode', 'AIGoCode', 'AIGoCode', [route('api.aigocode.app')]),
  relay('qiniu', 'Qiniu', 'Qiniu', [route('api.qnaigc.com')]),
  relay('aicoding', 'AICoding', 'AICoding', [route('api.aicoding.inc')]),
  relay('subrouter', 'SubRouter', 'SubRouter', [route('subrouter.ai')]),
  relay(
    'apikey',
    'ApiKey',
    'APIKEY.FUN',
    [route('api.apikey.fun'), route('slb.apikey.fun')],
    'api-key',
    'sub2api',
  ),
  relay('claudeapi', 'ClaudeAPI', 'ClaudeAPI', [route('gw.apito.ai')]),
  relay('code0', 'Code0', 'Code0', [route('code0.ai')]),
  relay('teamorouter', 'TeamoRouter', 'TeamoRouter', [route('api.teamorouter.com')]),
  relay('ppio', 'PPIO', 'PPIO', [route('api.ppio.com')]),
  relay('claudecn', 'ClaudeCN', 'ClaudeCN', [route('claudecn.top')]),
  relay(
    'siliconflow-cn',
    'SiliconFlow',
    'SiliconFlow',
    [route('api.siliconflow.cn')],
    'api-key',
    'siliconflow-cn',
    [],
    'siliconflow',
    'China',
  ),
  relay(
    'siliconflow-en',
    'SiliconFlow',
    'SiliconFlow en',
    [route('api.siliconflow.com')],
    'api-key',
    'siliconflow-en',
    [],
    'siliconflow',
    'International',
  ),
  relay('a6api', 'A6API', 'A6API', [route('api.a6api.com')]),
  relay('atlascloud', 'AtlasCloud', 'AtlasCloud', [route('api.atlascloud.ai')]),
  relay('compshare', 'Compshare', 'Compshare', [route('api.modelverse.cn')], 'generic', undefined, [], 'compshare', 'API'),
  relay('compshare-coding', 'Compshare', 'Compshare Coding Plan', [route('cp.compshare.cn')], 'generic', undefined, [], 'compshare', 'Coding Plan'),
  relay('ccsub', 'CCSub', 'CCSub', [route('www.ccsub.net')]),
  relay('sssaicode', 'SSSAiCode', 'SSSAiCode', [route('node-hk.sssaicodeapi.com')]),
  relay('micu', 'Micu', 'Micu', [route('www.micuapi.ai')]),
  relay('rightcode', 'RightCode', 'RightCode', [route('www.rightapi.ai')]),
  relay('etok', 'ETok', 'ETok.ai', [route('api.etok.ai')]),
  relay('cubence', 'Cubence', 'Cubence', [route('api.cubence.com')]),
  relay('crazyrouter', 'CrazyRouter', 'CrazyRouter', [route('cn.crazyrouter.com')]),
  relay('dmxapi', 'DMXAPI', 'DMXAPI', [route('www.dmxapi.cn')]),
  relay('sudocode-chat', 'SudoCode', 'SudoCode.chat', [route('api.sudocode.chat')], 'generic', undefined, [], 'sudocode', '.chat'),
  relay('sudocode-us', 'SudoCode', 'SudoCode.us', [route('sudocode.us')], 'generic', undefined, [], 'sudocode', '.us'),
  relay('xycai', 'XycAi', 'XycAi', [route('apicdn.xycai.us')]),
  relay('amux', 'Amux', 'Amux', [route('api.amux.ai')]),
  relay('opencode-go', 'OpenCode Go', 'OpenCode Go', [route('opencode.ai', '/zen/go')]),
  relay('modelscope', 'ModelScope', 'ModelScope', [route('api-inference.modelscope.cn')]),
  relay('aihubmix', 'AiHubMix', 'AiHubMix', [route('aihubmix.com')]),
  relay('cherryin', 'CherryIN', 'CherryIN', [route('open.cherryin.net')]),
  relay('relaxycode', 'RelaxyCode', 'RelaxyCode', [route('www.relaxycode.com')]),
  relay('eflowcode', 'E-FlowCode', 'E-FlowCode', [route('e-flowcode.cc')]),
  relay('openrouter', 'OpenRouter', 'OpenRouter', [route('openrouter.ai')], 'api-key', 'openrouter'),
  relay('therouter', 'TheRouter', 'TheRouter', [route('api.therouter.ai')]),
  relay('novita', 'Novita', 'Novita AI', [route('api.novita.ai')], 'api-key', 'novita'),
  relay('nvidia', 'NVIDIA', 'Nvidia', [route('integrate.api.nvidia.com')]),
  relay('pipellm', 'PIPELLM', 'PIPELLM', [route('cc-api.pipellm.ai')]),
  relay('jiekou', 'JieKou AI', 'JieKou AI', [route('api.jiekou.ai')]),
  // 同一参考提交内有专用 Coding Plan 查询，但没有 Claude 预设。
  relay('zenmux', 'ZenMux', undefined, [route('*.zenmux.ai')], 'generic'),
  // cc-switch 其它宿主相对 Claude 目录新增的聚合/网关服务。
  relay('together-ai', 'Together AI', undefined, [route('api.together.xyz')], 'generic', undefined, ['Together AI']),
  relay('new-api', 'New API', undefined, [], 'generic', undefined, ['NewAPI']),
];

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  ...OFFICIAL_PROVIDERS,
  ...RELAY_PROVIDERS,
];

/** 去重后的品牌目录；原始预设、站点和套餐差异保留在 variants 中。 */
export const PROVIDER_BRANDS: readonly ProviderBrand[] = [
  ...new Map(
    PROVIDER_CATALOG.map((entry) => [
      `${entry.group}:${entry.brandId}`,
      {
        id: entry.brandId,
        displayName: entry.displayName,
        group: entry.group,
        variants: PROVIDER_CATALOG.filter(
          (candidate) => candidate.group === entry.group && candidate.brandId === entry.brandId,
        ),
      },
    ]),
  ).values(),
];

export const CC_SWITCH_CLAUDE_PRESET_COUNT = 77;

const PROVIDER_ROUTES = PROVIDER_CATALOG.flatMap((entry) =>
  entry.routes.map((candidate) => ({ entry, candidate })),
).sort((a, b) => Number(Boolean(b.candidate.pathPrefix)) - Number(Boolean(a.candidate.pathPrefix)));

function hostMatches(hostname: string, pattern: string): boolean {
  if (!pattern.startsWith('*.')) return hostname === pattern;
  const domain = pattern.slice(2);
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function routeMatches(url: URL, candidate: ProviderRoute): boolean {
  if (!hostMatches(url.hostname.toLowerCase(), candidate.host.toLowerCase())) return false;
  if (!candidate.pathPrefix) return true;
  const prefix = candidate.pathPrefix.toLowerCase().replace(/\/+$/, '');
  const path = url.pathname.toLowerCase().replace(/\/+$/, '');
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** 路径更具体的规则优先，避免火山 Plan 被同主机的 Doubao 通用规则抢占。 */
export function findProviderByUrl(baseUrl: string): ProviderCatalogEntry | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  return PROVIDER_ROUTES.find(({ candidate }) => routeMatches(url, candidate))?.entry ?? null;
}

export function findProviderById(id: string): ProviderCatalogEntry | null {
  const normalized = id.toLowerCase();
  return PROVIDER_CATALOG.find((entry) => entry.id.toLowerCase() === normalized) ?? null;
}
