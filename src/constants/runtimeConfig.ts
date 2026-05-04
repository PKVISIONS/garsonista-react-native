import {API_BASE_URL} from './config';

export type RuntimeConfig = {
  /** POST target for catalog / orders (service_go_v156 or local server). */
  catalogUrl: string;
  /** POST target for `seek_afm` (`main_plugins/`). */
  pluginsUrl: string;
  /** POST target for login (service_go_v150). */
  authUrl: string;
};

function apiBaseWithTrailingSlash(): string {
  return API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
}

let config: RuntimeConfig = {
  catalogUrl: `${apiBaseWithTrailingSlash()}service_go_v156/`,
  pluginsUrl: `${apiBaseWithTrailingSlash()}main_plugins/`,
  authUrl: `${apiBaseWithTrailingSlash()}service_go_v150/`,
};

export function getRuntimeConfig(): RuntimeConfig {
  return config;
}

/**
 * Mirrors legacy routing: local_ip + offline_basic_tables for catalog;
 * login stays on cloud unless product requirements change.
 */
export function setRuntimeConfigFromWireRow(row: Record<string, unknown>): void {
  const localIp = String(row.local_ip ?? '');
  const offlineBasic =
    Number((row as {offline_basic_tables?: number}).offline_basic_tables ?? 0) === 1;
  const root = apiBaseWithTrailingSlash();
  if (localIp !== '' && offlineBasic) {
    const base = localIp.endsWith('/') ? localIp : `${localIp}/`;
    config = {
      catalogUrl: localIp,
      pluginsUrl: `${base}main_plugins/`,
      authUrl: `${root}service_go_v150/`,
    };
  } else {
    config = {
      catalogUrl: `${root}service_go_v156/`,
      pluginsUrl: `${root}main_plugins/`,
      authUrl: `${root}service_go_v150/`,
    };
  }
}

export function resetRuntimeConfig(): void {
  const root = apiBaseWithTrailingSlash();
  config = {
    catalogUrl: `${root}service_go_v156/`,
    pluginsUrl: `${root}main_plugins/`,
    authUrl: `${root}service_go_v150/`,
  };
}
