import {
  extractLoginWireRow,
  mapLoginResponse,
  rowToFeatureFlags,
} from './adapters/authAdapter';
import {legacyPostText} from './http';
import {setApiCredentials} from './http/client';
import {resetRuntimeConfig, setRuntimeConfigFromWireRow} from '@constants/runtimeConfig';
import {API_BASE_URL, API_BASE_URL_ALT} from '@constants/config';

const AUTH_SERVICE_PATH = 'service_go_v166/';
const LEGACY_MOBILEAPP_BASE_URL = 'https://mobileapp.garsonista.gr/';

export type LoginResult = {
  session: ReturnType<typeof mapLoginResponse>;
  wireRow: Record<string, unknown>;
  featureFlags: ReturnType<typeof rowToFeatureFlags>;
};

function buildLoginForm(email: string, password: string): FormData {
  const form = new FormData();
  form.append('ajax', 'true');
  form.append('select', 'login');
  form.append('user', email);
  form.append('p', password);
  return form;
}

async function postLogin(url: string, form: FormData): Promise<string> {
  return legacyPostText(url, form);
}

function isNetworkFailure(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'AbortError';
  }
  if (!(err instanceof Error)) {
    return false;
  }
  if (err.name === 'AbortError') {
    return true;
  }
  if (err instanceof TypeError) {
    return true;
  }
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.message === 'Network request failed' ||
    err.message === 'Network Error' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch')
  );
}

function shouldTryAlternateLoginHost(err: unknown): boolean {
  if (isNetworkFailure(err)) {
    return true;
  }
  const status = (err as Error & {status?: number}).status;
  if (typeof status !== 'number') {
    return false;
  }
  if (status === 401 || status === 403) {
    return false;
  }
  return status >= 400;
}

/**
 * Login uses `service_go_v166/` + `select=login`.
 * The legacy kiosk reads production POS/AADE fields from mobileapp first.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  setApiCredentials({user: email, password});
  const hosts = [
    `${LEGACY_MOBILEAPP_BASE_URL}${AUTH_SERVICE_PATH}`,
    `${API_BASE_URL}${AUTH_SERVICE_PATH}`,
    `${API_BASE_URL_ALT}${AUTH_SERVICE_PATH}`,
  ];

  let text = '';
  let firstFailure: unknown = null;
  for (let i = 0; i < hosts.length; i += 1) {
    const url = hosts[i];
    try {
      text = await postLogin(url, buildLoginForm(email, password));
      if (__DEV__) {
        console.log(`[Garsonista HTTP] login ok host=${new URL(url).host}`);
      }
      break;
    } catch (error) {
      if (!firstFailure) {
        firstFailure = error;
      }
      if (__DEV__) {
        const err = error as Error & {status?: number};
        console.warn(
          `[Garsonista HTTP] login failed host=${new URL(url).host} status=${err.status ?? 'n/a'} msg=${err.message ?? 'unknown'}`,
        );
      }
      if (!shouldTryAlternateLoginHost(error) || i === hosts.length - 1) {
        throw firstFailure ?? error;
      }
    }
  }

  if (!text) {
    throw firstFailure ?? new Error('Login failed');
  }

  const session = mapLoginResponse(text);
  const wireRow = extractLoginWireRow(text);
  if (__DEV__) {
    console.log(
      `[Auth] login table fields dineinbtn_table=${String(
        wireRow.dineinbtn_table ?? 'none',
      )} takeawaybtn_table=${String(
        wireRow.takeawaybtn_table ?? 'none',
      )} keys=${Object.keys(wireRow).slice(0, 80).join(',')}`,
    );
  }
  wireRow.user_login = email;
  wireRow.password_login = password;
  setRuntimeConfigFromWireRow(wireRow);
  const featureFlags = rowToFeatureFlags(wireRow);
  return {session, wireRow, featureFlags};
}

export function logout(): void {
  setApiCredentials(null);
  resetRuntimeConfig();
}
