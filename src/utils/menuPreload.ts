import type {CatalogBootstrap} from '@services/catalogService';
import {catalogRepository} from '../repositories/CatalogRepository';
import {useCartStore} from '@store';
import {useMenuPreloadStore} from '@store';
import {warmRemoteImageCache} from './productImage';

type ServiceType = 'dine-in' | 'takeaway';

/** Never block kiosk boot longer than this while prefetching menu images. */
const WARM_MENU_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

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
  try {
    indexMenuFromCatalog(catalog, wireRow);
    await withTimeout(
      catalogRepository.warmMenuImages(catalog, wireRow),
      WARM_MENU_TIMEOUT_MS,
      'warmMenuImages',
    );
    prefetchMenuProductImages();
    if (__DEV__) {
      console.log('[MenuPreload] warmMenuExperience complete');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[MenuPreload] warmMenuExperience failed — continuing without full image cache',
        error,
      );
    }
  } finally {
    // Always clear boot overlay; a failed prefetch must not block the kiosk UI.
    useMenuPreloadStore.getState().markPrerenderComplete();
  }
}
