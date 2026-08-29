export type BillingMode = 'subscription' | 'api' | 'hybrid' | 'unknown';

export interface QuotaWindow {
  label: string;
  remainingPercent: number;
  resetMs: number | null;
}

export interface QuotaInfo {
  provider: string;
  windows: QuotaWindow[];
}

export type RelayQueryProtocol = 'sub2api' | 'new-api' | 'generic-balance' | 'zenmux';

export interface ProviderQueryConfig {
  id: string;
  displayName?: string;
  matchHosts: string[];
  protocol: RelayQueryProtocol;
  baseUrl?: string;
  path?: string;
  apiKey?: string;
  accessToken?: string;
  userId?: string;
  currency?: 'CNY' | 'USD';
}

export interface ProviderCredentials {
  volcengine?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  zhipuTeam?: {
    organizationId: string;
    projectId: string;
  };
}
