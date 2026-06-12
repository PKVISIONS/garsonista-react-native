import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const MAX_FIELD_LENGTH = 700;
const MAX_RESPONSE_PREVIEW = 900;
const REDACTED = '***';
const SENSITIVE_KEYS = new Set([
  'p',
  'password',
  'password_login',
  'token',
  'userToken',
  'ISV_clientSecret',
  'isv_client_secret',
  'lastVivaRequest',
  'lastVivaResponse',
]);

type TimedConfig = InternalAxiosRequestConfig & {
  __apiLogStartedAt?: number;
};

function nowMs(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function truncate(value: string, maxLength = MAX_FIELD_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function safeJson(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function redactValue(key: string, value: unknown): string {
  if (SENSITIVE_KEYS.has(key)) {
    return REDACTED;
  }
  return truncate(safeJson(value));
}

function readFormParts(form: FormData): Array<[string, unknown]> {
  const parts = (form as {_parts?: Array<[string, unknown]>})._parts;
  return Array.isArray(parts) ? parts : [];
}

export function readFormField(form: FormData, key: string): string | undefined {
  for (const [partKey, value] of readFormParts(form)) {
    if (partKey === key && typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

function formatFormData(form: FormData): string {
  const parts = readFormParts(form);
  if (!parts.length) {
    return 'FormData';
  }
  return parts
    .map(([key, value]) => `${key}=${redactValue(key, value)}`)
    .join(' ');
}

function formatBody(body: unknown): string {
  if (body instanceof FormData) {
    return formatFormData(body);
  }
  if (body && typeof body === 'object') {
    const entries = Object.entries(body as Record<string, unknown>);
    return entries
      .map(([key, value]) => `${key}=${redactValue(key, value)}`)
      .join(' ');
  }
  return truncate(safeJson(body));
}

function describeUrl(url: string, baseUrl?: string): {host: string; path: string} {
  try {
    const parsed = new URL(url, baseUrl || undefined);
    return {host: parsed.host || 'relative', path: `${parsed.pathname}${parsed.search}`};
  } catch {
    return {host: 'unknown', path: url};
  }
}

function responsePreview(body: unknown): string {
  return truncate(safeJson(body), MAX_RESPONSE_PREVIEW);
}

export function logFetchRequest(method: string, url: string, body?: unknown): void {
  if (!__DEV__) {
    return;
  }
  const {host, path} = describeUrl(url);
  const select = body instanceof FormData ? readFormField(body, 'select') : undefined;
  console.log(
    `[Garsonista API] REQUEST ${method} host=${host} path=${path} select=${select ?? 'n/a'} body=${formatBody(
      body,
    )}`,
  );
}

export function logFetchResponse(
  method: string,
  url: string,
  status: number,
  startedAt: number,
  body: string,
): void {
  if (!__DEV__) {
    return;
  }
  const {host, path} = describeUrl(url);
  const ms = Math.round(nowMs() - startedAt);
  console.log(
    `[Garsonista API] RESPONSE ${method} ${status} ${ms}ms host=${host} path=${path} bodyPreview=${responsePreview(
      body,
    )}`,
  );
}

export function logFetchError(
  method: string,
  url: string,
  startedAt: number,
  error: unknown,
): void {
  if (!__DEV__) {
    return;
  }
  const {host, path} = describeUrl(url);
  const ms = Math.round(nowMs() - startedAt);
  const message = error instanceof Error ? error.message : String(error);
  console.log(
    `[Garsonista API] ERROR ${method} ${ms}ms host=${host} path=${path} message=${message}`,
  );
}

export function markAxiosRequestStart(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  if (!__DEV__) {
    return config;
  }
  const timed = config as TimedConfig;
  timed.__apiLogStartedAt = nowMs();
  const method = String(config.method ?? 'GET').toUpperCase();
  const {host, path} = describeUrl(String(config.url ?? ''), config.baseURL);
  console.log(
    `[Garsonista API] AXIOS REQUEST ${method} host=${host} path=${path} body=${formatBody(
      config.data,
    )}`,
  );
  return timed;
}

export function logAxiosResponse(response: AxiosResponse): AxiosResponse {
  if (!__DEV__) {
    return response;
  }
  const config = response.config as TimedConfig;
  const startedAt = config.__apiLogStartedAt ?? nowMs();
  const method = String(config.method ?? 'GET').toUpperCase();
  const {host, path} = describeUrl(String(config.url ?? ''), config.baseURL);
  const ms = Math.round(nowMs() - startedAt);
  console.log(
    `[Garsonista API] AXIOS RESPONSE ${method} ${response.status} ${ms}ms host=${host} path=${path} bodyPreview=${responsePreview(
      response.data,
    )}`,
  );
  return response;
}

export function logAxiosError(error: AxiosError): Promise<never> {
  if (__DEV__) {
    const config = error.config as TimedConfig | undefined;
    const startedAt = config?.__apiLogStartedAt ?? nowMs();
    const method = String(config?.method ?? 'GET').toUpperCase();
    const {host, path} = describeUrl(String(config?.url ?? ''), config?.baseURL);
    const ms = Math.round(nowMs() - startedAt);
    console.log(
      `[Garsonista API] AXIOS ERROR ${method} ${error.response?.status ?? 'n/a'} ${ms}ms host=${host} path=${path} message=${error.message} bodyPreview=${responsePreview(
        error.response?.data,
      )}`,
    );
  }
  return Promise.reject(error);
}
