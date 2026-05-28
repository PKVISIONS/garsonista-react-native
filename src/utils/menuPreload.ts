import type {CatalogBootstrap} from '@services/catalogService';
import {catalogRepository} from '../repositories/CatalogRepository';
import {useCartStore} from '@store';
import {useMenuPreloadStore} from '@store';
import {warmRemoteImageCache} from './productImage';

type ServiceType = 'dine-in' | 'takeaway';

/** Build menu navigation state (table ids, category ids) from catalog data. */
export function indexMenuFromCatalog(
  catalog: CatalogBootstrap,
  wireRow: Record<string, unknown> | null,
): void {
  useMenuPreloadStore.getState().markFromCatalog(catalog, wireRow);
}

/** Sync cart before navigating to Menu so the screen mounts without extra work. */
export function prepareCartForMenu(serviceType: ServiceType): void {
  const {tableIds} = useMenuPreloadStore.getState();
  useMenuPreloadStore.getState().setServiceType(serviceType);
  useCartStore.getState().resetForServiceType(serviceType, tableIds[serviceType]);
}

/** Prefetch every menu product image indexed in the preload store. */
export function prefetchMenuProductImages(): void {
  const {ready, productImageUriById} = useMenuPreloadStore.getState();
  if (!ready) {
    return;
  }
  warmRemoteImageCache(Object.values(productImageUriById));
  if (__DEV__) {
    console.log(
      `[MenuPreload] prefetchMenuProductImages count=${Object.keys(productImageUriById).length}`,
    );
  }
}

/**
 * Full menu warm at login / restore: catalog indexes + image prefetch.
 * Boot overlay clears once images are warmed.
 */
export async function warmMenuExperience(
  catalog: CatalogBootstrap,
  wireRow: Record<string, unknown> | null,
): Promise<void> {
  indexMenuFromCatalog(catalog, wireRow);
  await catalogRepository.warmMenuImages(catalog, wireRow);
  prefetchMenuProductImages();
  useMenuPreloadStore.getState().markPrerenderComplete();
  if (__DEV__) {
    console.log('[MenuPreload] warmMenuExperience complete');
  }
}
