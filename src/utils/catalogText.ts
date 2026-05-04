export function pickCatalogText(
  lang: string,
  base: string | null | undefined,
  english?: string | null,
): string {
  if (lang === 'en' && english && english.trim()) {
    return english.trim();
  }
  return (base ?? '').trim();
}
