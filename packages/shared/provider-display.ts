import { findProviderById } from './provider-catalog.ts';

const QUERY_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  zhipu: 'Zhipu',
  'z.ai': 'Zhipu',
  kimi: 'Kimi',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax',
  'minimax-en': 'MiniMax',
  zenmux: 'ZenMux',
  deepseek: 'DeepSeek',
  stepfun: 'StepFun',
  siliconflow: 'SiliconFlow',
  'siliconflow-cn': 'SiliconFlow',
  'siliconflow-en': 'SiliconFlow',
  openrouter: 'OpenRouter',
  novita: 'Novita',
  sub2api: 'Sub2API',
  'apikey.fun': 'ApiKey',
};

/** 内部标识只用于逻辑；状态栏显示官方拉丁品牌名，未知值保留宿主原文。 */
export function displayProviderName(providerId: string): string {
  const normalized = providerId.toLowerCase();
  return QUERY_DISPLAY_NAMES[normalized] ?? findProviderById(normalized)?.displayName ?? providerId;
}
