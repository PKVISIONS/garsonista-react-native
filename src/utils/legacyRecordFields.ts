/** Read string fields from legacy API rows (`user_logedin`, `get_store_premises`). */
export function legacyStringField(
  row: Record<string, unknown>,
  ...keys: string[]
): string | null {
  const byLower = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    byLower.set(key.toLowerCase(), value);
  }
  for (const key of keys) {
    const value = byLower.get(key.toLowerCase());
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}
