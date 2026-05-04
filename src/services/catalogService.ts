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
import type {Category, OptionGroup, Product} from '@models';

export type CatalogBootstrap = {
  categories: Category[];
  products: Product[];
  /** From `get_product_prices` — merged per legacy `tableid` in UI (`product_prices`). */
  productPrices: ProductPriceRow[];
  optionGroups: OptionGroup[];
};

async function postSelect(select: string): Promise<string> {
  const form = new FormData();
  form.append('select', select);
  return legacyPostText(getRuntimeConfig().catalogUrl, form);
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

  const categories = mapMainAndSubCategories(mainCatRaw, subCatRaw);
  const products = mapProducts(productsRaw);
  const productPrices = mapProductPrices(pricesRaw);
  const optionGroups = mapOptionGroups(optionsRaw);

  return {
    categories,
    products,
    productPrices,
    optionGroups,
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
