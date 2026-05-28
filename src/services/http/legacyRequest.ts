import {applyCredentialsToFormData} from './client';
import {recordLegacyPost} from './requestMetrics';

const TIMEOUT_MS = 60_000;

function readFormSelect(form: FormData): string | undefined {
  const parts = (form as {_parts?: [string, unknown][]})._parts;
  if (!Array.isArray(parts)) {
    return undefined;
  }
  for (const [k, v] of parts) {
    if (k === 'select' && typeof v === 'string') {
      return v;
    }
  }
  return undefined;
}

/**
 * Legacy API POSTs use multipart FormData. On Android, Axios/XHR often
 * surfaces a generic "Network Error" for these calls; `fetch` uses the
 * native stack and is reliable for the same FormData.
 */
export async function legacyPostText(url: string, form: FormData): Promise<string> {
  applyCredentialsToFormData(form);
  const selectHint = readFormSelect(form);
  const t0 =
    typeof globalThis.performance?.now === 'function'
      ? globalThis.performance.now()
      : Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let recorded = false;

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const text = await res.text();
    const ms =
      (typeof globalThis.performance?.now === 'function'
        ? globalThis.performance.now()
        : Date.now()) - t0;
    if (__DEV__ && selectHint === 'insert_orders') {
      const bodyPreview = text.length > 300 ? `${text.slice(0, 300)}...` : text;
      console.log(
        `[Garsonista HTTP] RESPONSE ${Math.round(ms)}ms select=${selectHint} host=${new URL(url).host} bodyPreview=`,
        bodyPreview,
      );
    }
    if (!res.ok) {
      recordLegacyPost(url, selectHint, ms, false);
      recorded = true;
      const err = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      (err as Error & {status?: number; responseBody?: string}).status = res.status;
      (err as Error & {responseBody?: string}).responseBody = text;
      throw err;
    }
    recordLegacyPost(url, selectHint, ms, true);
    recorded = true;
    return text;
  } catch (e) {
    if (!recorded) {
      const ms =
        (typeof globalThis.performance?.now === 'function'
          ? globalThis.performance.now()
          : Date.now()) - t0;
      recordLegacyPost(url, selectHint, ms, false);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
