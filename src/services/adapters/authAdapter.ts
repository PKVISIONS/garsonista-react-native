import type {AuthSession} from '@models/auth';
import type {FeatureFlags} from '@models/featureFlags';

/** Parse login JSON: array of rows, or legacy `{ error, message }` object. */
function loginResponseRows(raw: unknown): unknown[] {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) {
      throw new Error('Empty login response');
    }
    try {
      data = JSON.parse(t);
    } catch {
      throw new Error('Login response is not valid JSON');
    }
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid login response');
  }
  if (!Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (o.error === true && typeof o.message === 'string') {
      throw new Error(o.message);
    }
    throw new Error('Invalid login response');
  }
  return data;
}

export function mapLoginResponse(raw: unknown): AuthSession {
  const arr = loginResponseRows(raw);
  const row = arr[0] as Record<string, unknown>;
  if (!row || typeof row !== 'object') {
    throw new Error('Invalid login response');
  }
  return {
    userId: Number(row.id) || 0,
    token: String(row.descr ?? ''),
    email: String(row.user_login ?? ''),
    expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
  };
}

/** Full first row from login — used for runtime routing + feature flags. */
export function extractLoginWireRow(raw: unknown): Record<string, unknown> {
  const arr = loginResponseRows(raw);
  const row = arr[0] as Record<string, unknown>;
  if (!row) {
    throw new Error('Invalid login payload');
  }
  return row;
}

export function rowToFeatureFlags(row: Record<string, unknown>): FeatureFlags {
  const out: FeatureFlags = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'p' || k === 'password_login') {
      continue;
    }
    if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
      out[k] = v;
    }
  }
  return out;
}
