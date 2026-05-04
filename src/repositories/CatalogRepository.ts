import {Image} from 'react-native';
import type {ICatalogRepository} from '../core/domain/repositories/ICatalogRepository';
import {
  fetchCatalogBootstrap,
  type CatalogBootstrap,
} from '../services/catalogService';
import {setCachedImageAspect} from '../utils/imageAspectCache';
import {
  imagesBaseUrlFromWireRow,
  kioskLogoImageUri,
  kioskSplashImageUri,
  resolveProductImageUri,
} from '../utils/productImage';

const PREFETCH_CONCURRENCY = 8;

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

async function prefetchAndPrimeAspect(uri: string): Promise<void> {
  try {
    await Image.prefetch(uri);
  } catch {
    return;
  }
  await new Promise<void>(resolve => {
    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0 && h > 0) {
          setCachedImageAspect(uri, w / h);
        }
        resolve();
      },
      () => resolve(),
    );
  });
}

async function prefetchAllUris(uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += PREFETCH_CONCURRENCY) {
    const batch = uris.slice(i, i + PREFETCH_CONCURRENCY);
    await Promise.all(batch.map(u => prefetchAndPrimeAspect(u)));
  }
}

export class CatalogRepository implements ICatalogRepository {
  fetchBootstrap = (): Promise<CatalogBootstrap> => fetchCatalogBootstrap();

  warmMenuImages = (
    catalog: CatalogBootstrap,
    wireRow: Record<string, unknown> | null,
  ): Promise<void> => {
    const uris = collectAllImageUris(catalog, wireRow);
    return prefetchAllUris(uris);
  };
}

export const catalogRepository = new CatalogRepository();
