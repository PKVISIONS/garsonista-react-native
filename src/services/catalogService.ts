import {
  applyTablePrices,
  mapMainAndSubCategories,
  mapOptionGroups,
  mapProductPrices,
  mapProducts,
  type ProductPriceRow,
} from './adapters/catalogAdapter';
import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';
import type {Category, OptionGroup, Product, StoreTable} from '@models';

export type CatalogBootstrap = {
  categories: Category[];
  products: Product[];
  /** From `get_product_prices` — merged per legacy `tableid` in UI (`product_prices`). */
  productPrices: ProductPriceRow[];
  optionGroups: OptionGroup[];
  storeTables: StoreTable[];
};

async function postSelect(select: string): Promise<string> {
  const form = new FormData();
  form.append('select', select);
  return legacyPostText(getRuntimeConfig().catalogUrl, form);
}

function mapStoreTables(raw: unknown): StoreTable[] {
  try {
    const arr = JSON.parse(String(raw ?? '[]')) as unknown[];
    return arr.map(row => {
      const o = row as Record<string, unknown>;
      return {
        id: Number(o.id ?? 0),
        descr: String(o.descr ?? ''),
        horos: String(o.horos ?? ''),
        isdelivery: Number(o.isdelivery ?? 0),
        always_receipt: o.always_receipt != null ? Number(o.always_receipt) : undefined,
        always_receipt_final:
          o.always_receipt_final != null ? Number(o.always_receipt_final) : undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchCatalogBootstrap(): Promise<CatalogBootstrap> {
  const [mainCatRaw, subCatRaw, productsRaw, optionsRaw, pricesRaw] =
    await Promise.all([
      postSelect('get_store_product_main_categories'),
      postSelect('get_store_product_categories'),
      postSelect('get_store_products'),
      postSelect('get_product_options').catch(() => '[]'),
      postSelect('get_product_prices').catch(() => '[]'),
    ]);
  const storeTablesRaw = await postSelect('get_store_tables').catch(() => '[]');

  const products = mapProducts(productsRaw);
  const categories = mapMainAndSubCategories(mainCatRaw, subCatRaw, products);
  const productPrices = mapProductPrices(pricesRaw);
  const optionGroups = mapOptionGroups(optionsRaw);
  const storeTables = mapStoreTables(storeTablesRaw);

  return {
    categories,
    products,
    productPrices,
    optionGroups,
    storeTables,
  };
}

/** Apply `product_prices` for the active order context (`tableid` in legacy API). */
export function priceProductsForTable(
  products: Product[],
  priceRows: ProductPriceRow[],
  tableId: number,
): Product[] {
  return applyTablePrices(products, priceRows, tableId);
}

export function resolveDefaultTableId(
  storeTables: StoreTable[],
  serviceType: 'dine-in' | 'takeaway',
): number {
  if (!storeTables.length) {
    return 0;
  }
  if (serviceType === 'takeaway') {
    const delivery = storeTables.find(t => t.isdelivery === 1);
    if (delivery) {
      return delivery.id;
    }
  }
  const dineIn = storeTables.find(t => t.isdelivery !== 1);
  return (dineIn ?? storeTables[0]).id;
}
