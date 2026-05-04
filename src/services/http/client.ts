import axios, {type AxiosInstance, type InternalAxiosRequestConfig} from 'axios';
import {API_BASE_URL} from '@constants/config';

export type Credentials = {user: string; password: string};

let credentials: Credentials | null = null;

export function setApiCredentials(next: Credentials | null): void {
  credentials = next;
}

export function getApiCredentials(): Credentials | null {
  return credentials;
}

/** RN FormData has `getAll`, not `get` (see Libraries/Network/FormData.js). */
function formDataHasKey(form: FormData, key: string): boolean {
  const gd = form as FormData & {getAll?: (k: string) => unknown[]};
  if (typeof gd.getAll === 'function') {
    const parts = gd.getAll(key);
    return Array.isArray(parts) && parts.length > 0;
  }
  return false;
}

/** Injects legacy `user` / `p` / `ajax` for every FormData POST (legacy client parity). */
export function applyCredentialsToFormData(form: FormData): void {
  if (!credentials) {
    return;
  }
  if (!formDataHasKey(form, 'user')) {
    form.append('user', credentials.user);
  }
  if (!formDataHasKey(form, 'p')) {
    form.append('p', credentials.password);
  }
  if (!formDataHasKey(form, 'ajax')) {
    form.append('ajax', 'true');
  }
}

function injectFormBody(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const data = config.data;
  if (!credentials) {
    return config;
  }
  if (data instanceof FormData) {
    applyCredentialsToFormData(data);
  } else if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    if (body.user == null) {
      body.user = credentials.user;
    }
    if (body.p == null) {
      body.p = credentials.password;
    }
  }
  return config;
}

export function createHttpClient(baseURL: string = API_BASE_URL): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 60_000,
  });

  client.interceptors.request.use(cfg => injectFormBody(cfg));

  return client;
}

export const httpClient = createHttpClient('');
