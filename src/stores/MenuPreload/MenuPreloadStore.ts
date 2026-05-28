import {create} from 'zustand';
import type {Product} from '@models';
import type {CatalogBootstrap} from '@services/catalogService';
import {
  priceProductsForTable,
  resolveDefaultTableId,
} from '@services/catalogService';
import {
  imagesBaseUrlFromWireRow,
  productImageSource,
} from '@utils/productImage';

type ServiceType = 'dine-in' | 'takeaway';

type ProductsByCategory = Record<number, Product[]>;

type MenuPreloadState = {
  ready: boolean;
  /** True while menu images are warming before the UI is shown. */
  menuBootstrapPending: boolean;
  prerenderComplete: boolean;
  allCategoryIds: number[];
  tableIds: Record<ServiceType, number>;
  productImageUriById: Record<number, string>;
  productsByTableId: Record<number, ProductsByCategory>;
  stagedCategoryIds: number[];
  serviceType: ServiceType | null;
  activeCategoryId: number | null;
  markFromCatalog: (
    catalog: CatalogBootstrap,
    wireRow: Record<string, unknown> | null,
  ) => void;
  setServiceType: (serviceType: ServiceType) => void;
  setActiveCategoryId: (categoryId: number | null) => void;
  markPrerenderComplete: () => void;
  reset: () => void;
};

const emptyTableIds: Record<ServiceType, number> = {
  'dine-in': 0,
  takeaway: 0,
};

function indexProductsByCategory(products: Product[]): ProductsByCategory {
  const byCategory: ProductsByCategory = {};
  for (const product of products) {
    const key = product.categoryId ?? 0;
    (byCategory[key] ??= []).push(product);
  }
  return byCategory;
}

export const useMenuPreloadStore = create<MenuPreloadState>((set, get) => ({
  ready: false,
  menuBootstrapPending: false,
  prerenderComplete: false,
  allCategoryIds: [],
  tableIds: emptyTableIds,
  productImageUriById: {},
  productsByTableId: {},
  stagedCategoryIds: [],
  serviceType: null,
  activeCategoryId: null,
  markFromCatalog: (catalog, wireRow) => {
    const tables = catalog.storeTables ?? [];
    const topCategories = catalog.categories.filter(c => c.parentId == null);
    const allCategoryIds = topCategories.map(c => c.id);
    const tableIds: Record<ServiceType, number> = {
      'dine-in': resolveDefaultTableId(tables, 'dine-in'),
      takeaway: resolveDefaultTableId(tables, 'takeaway'),
    };

    const imagesBaseUrl = imagesBaseUrlFromWireRow(wireRow);
    const productImageUriById: Record<number, string> = {};
    for (const product of catalog.products) {
      const uri = productImageSource(product.imageUrl, imagesBaseUrl)?.uri;
      if (uri) {
        productImageUriById[product.id] = uri;
      }
    }

    const productsByTableId: Record<number, ProductsByCategory> = {};
    const priceRows = catalog.productPrices ?? [];
    for (const tableId of new Set(Object.values(tableIds))) {
      const priced =
        priceRows.length > 0
          ? priceProductsForTable(catalog.products, priceRows, tableId)
          : catalog.products;
      productsByTableId[tableId] = indexProductsByCategory(priced);
    }

    const hasCategories = allCategoryIds.length > 0;

    set({
      ready: true,
      menuBootstrapPending: hasCategories,
      prerenderComplete: !hasCategories,
      allCategoryIds,
      tableIds,
      productImageUriById,
      productsByTableId,
      stagedCategoryIds: allCategoryIds,
      activeCategoryId: allCategoryIds[0] ?? null,
      serviceType: get().serviceType ?? 'dine-in',
    });

    if (__DEV__) {
      console.log(
        `[MenuPreload] ready categories=${topCategories.length} dineInTable=${tableIds['dine-in']} takeawayTable=${tableIds.takeaway}`,
      );
    }
  },
  setServiceType: serviceType => set({serviceType}),
  setActiveCategoryId: categoryId => set({activeCategoryId: categoryId}),
  markPrerenderComplete: () => {
    if (get().prerenderComplete) {
      return;
    }
    set({prerenderComplete: true, menuBootstrapPending: false});
    if (__DEV__) {
      console.log('[MenuPreload] prerender complete');
    }
  },
  reset: () => {
    set({
      ready: false,
      menuBootstrapPending: false,
      prerenderComplete: false,
      allCategoryIds: [],
      tableIds: {...emptyTableIds},
      productImageUriById: {},
      productsByTableId: {},
      stagedCategoryIds: [],
      serviceType: null,
      activeCategoryId: null,
    });
  },
}));
