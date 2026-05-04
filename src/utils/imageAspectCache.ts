/**
 * In-memory aspect ratio cache for remote image URIs.
 * `ProductCardImage` used to call `Image.getSize` on every mount, which
 * re-fetches/decodes the same URLs when navigating back to the menu. This cache
 * makes dimensions stable for the whole app session after the first probe.
 */
const aspectByUri = new Map<string, number>();

export function getCachedImageAspect(uri: string): number | null {
  return aspectByUri.get(uri) ?? null;
}

export function setCachedImageAspect(uri: string, aspect: number): void {
  if (uri && aspect > 0 && Number.isFinite(aspect)) {
    aspectByUri.set(uri, aspect);
  }
}

export function clearImageAspectCache(): void {
  aspectByUri.clear();
}
