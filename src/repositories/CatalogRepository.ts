import type {ICatalogRepository} from '../core/domain/repositories/ICatalogRepository';
import {
  fetchCatalogBootstrap,
  type CatalogBootstrap,
} from '../services/catalogService';
import {
  imagesBaseUrlFromWireRow,
  kioskLogoImageUri,
  kioskSplashImageUri,
  prefetchProductImageOnce,
  resolveProductImageUri,
  warmRemoteImageCache,
} from '../utils/productImage';
import {prefetchKioskSplash} from '../utils/splashImage';

function collectAllImageUris(
  catalog: CatalogBootstrap,
  wireRow: Record<string, unknown> | null,
): string[] {
  const uris = new Set<string>();
  const pushUri = (uri: string | null | undefined) => {
    if (uri) {
      uris.add(uri);
    }
  };

  pushUri(kioskSplashImageUri(wireRow));
  pushUri(kioskLogoImageUri(wireRow));

  const base = imagesBaseUrlFromWireRow(wireRow);
  for (const c of catalog.categories) {
    pushUri(resolveProductImageUri(c.imageUrl, base));
  }
  for (const p of catalog.products) {
    pushUri(resolveProductImageUri(p.imageUrl, base));
  }
  for (const g of catalog.optionGroups) {
    for (const v of g.values) {
      pushUri(resolveProductImageUri(v.imageUrl ?? null, base));
    }
  }

  return Array.from(uris);
}

export class CatalogRepository implements ICatalogRepository {
  fetchBootstrap = (): Promise<CatalogBootstrap> => fetchCatalogBootstrap();

  warmMenuImages = async (
    catalog: CatalogBootstrap,
    wireRow: Record<string, unknown> | null,
  ): Promise<void> => {
    await prefetchKioskSplash(wireRow);
    const splash = kioskSplashImageUri(wireRow);
    const uris = collectAllImageUris(catalog, wireRow).filter(u => u !== splash);
    warmRemoteImageCache(uris);
    await Promise.all(
      uris.map(uri =>
        prefetchProductImageOnce(uri).catch(() => {
          /* best-effort */
        }),
      ),
    );
    if (__DEV__) {
      console.log(`[MenuPreload] prefetched ${uris.length} menu images`);
    }
  };
}

export const catalogRepository = new CatalogRepository();
