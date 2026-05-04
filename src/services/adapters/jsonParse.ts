export function parseJsonArray(raw: unknown): unknown[] {
  if (typeof raw === 'string') {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) {
      throw new Error('Expected JSON array');
    }
    return v;
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  throw new Error('Expected array or JSON string');
}

export function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  throw new Error('Expected object');
}
