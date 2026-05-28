import {
  extractLoginWireRow,
  mapLoginResponse,
  rowToFeatureFlags,
} from './adapters/authAdapter';
import {legacyPostText} from './http';
import {setApiCredentials} from './http/client';
import {resetRuntimeConfig, setRuntimeConfigFromWireRow} from '@constants/runtimeConfig';
import {API_BASE_URL, API_BASE_URL_ALT} from '@constants/config';

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
 * Login uses `service_go_v150/` + `select=login`. Tries primary host, then alternate on transport failure.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  setApiCredentials({user: email, password});
  const form = buildLoginForm(email, password);

  const primaryAuth = `${API_BASE_URL}service_go_v150/`;
  const altAuth = `${API_BASE_URL_ALT}service_go_v150/`;

  let text: string;
  try {
    text = await postLogin(primaryAuth, form);
  } catch (first) {
    if (__DEV__) {
      const firstErr = first as Error & {status?: number};
      console.warn(
        `[Garsonista HTTP] login primary failed host=${new URL(primaryAuth).host} status=${firstErr.status ?? 'n/a'} msg=${firstErr.message ?? 'unknown'}`,
      );
    }
    if (!shouldTryAlternateLoginHost(first)) {
      throw first;
    }
    try {
      text = await postLogin(altAuth, buildLoginForm(email, password));
    } catch (second) {
      if (__DEV__) {
        const secondErr = second as Error & {status?: number};
        console.warn(
          `[Garsonista HTTP] login alternate failed host=${new URL(altAuth).host} status=${secondErr.status ?? 'n/a'} msg=${secondErr.message ?? 'unknown'}`,
        );
      }
      throw first;
    }
  }

  const session = mapLoginResponse(text);
  const wireRow = extractLoginWireRow(text);
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
