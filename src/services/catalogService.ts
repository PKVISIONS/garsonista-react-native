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
import type {Category, OptionGroup, Product, StorePremise, StoreTable} from '@models';
import {legacyStringField} from '@utils/legacyRecordFields';

export type CatalogBootstrap = {
  categories: Category[];
  products: Product[];
  /** From `get_product_prices` — merged per legacy `tableid` in UI (`product_prices`). */
  productPrices: ProductPriceRow[];
  optionGroups: OptionGroup[];
  storeTables: StoreTable[];
  /** Legacy `get_store_premises` — ΑΦΜ/ΔΟΥ/address for receipts. */
  storePremises: StorePremise[];
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
        idcategory:
          o.idcategory != null
            ? Number(o.idcategory)
            : o.id_premise != null
              ? Number(o.id_premise)
              : o.premise_id != null
                ? Number(o.premise_id)
                : undefined,
      };
    });
  } catch {
    return [];
  }
}

export function mapStorePremises(raw: unknown): StorePremise[] {
  try {
    const arr = JSON.parse(String(raw ?? '[]')) as unknown[];
    return arr.map(row => {
      const o = row as Record<string, unknown>;
      return {
        id: Number(o.id ?? 0),
        descr: String(o.descr ?? ''),
        epwnimia: legacyStringField(o, 'epwnimia', 'company_name', 'eponymia'),
        companyDescr: legacyStringField(
          o,
          'company_descr',
          'company_description',
          'store_descr',
        ),
        address: legacyStringField(
          o,
          'dieythynsi',
          'dieuthinsi',
          'dieythinsi',
          'address',
          'address1',
        ),
        city: legacyStringField(o, 'poli', 'polh', 'city'),
        postalCode: legacyStringField(o, 'tk', 'postal_code', 'postcode'),
        taxId: legacyStringField(
          o,
          'afm',
          'vat',
          'vat_number',
          'tax_id',
          'taxid',
          'companyafm',
          'company_afm',
          'afm_etairias',
        ),
        taxOffice: legacyStringField(
          o,
          'doy',
          'tax_office',
          'taxoffice',
          'dou',
          'forologiki_enotita',
        ),
      };
    });
  } catch {
    return [];
  }
}

/** On-demand `get_store_premises` when catalog was loaded before premises were added. */
export async function fetchStorePremisesOnly(): Promise<StorePremise[]> {
  try {
    const raw = await postSelect('get_store_premises');
    return mapStorePremises(raw);
  } catch {
    return [];
  }
}

export async function fetchCatalogBootstrap(): Promise<CatalogBootstrap> {
  const [mainCatRaw, subCatRaw, productsRaw, optionsRaw, pricesRaw, storePremisesRaw] =
    await Promise.all([
      postSelect('get_store_product_main_categories'),
      postSelect('get_store_product_categories'),
      postSelect('get_store_products'),
      postSelect('get_product_options').catch(() => '[]'),
      postSelect('get_product_prices').catch(() => '[]'),
      postSelect('get_store_premises').catch(() => '[]'),
    ]);
  const storeTablesRaw = await postSelect('get_store_tables').catch(() => '[]');

  const products = mapProducts(productsRaw);
  const categories = mapMainAndSubCategories(mainCatRaw, subCatRaw, products);
  const productPrices = mapProductPrices(pricesRaw);
  const optionGroups = mapOptionGroups(optionsRaw);
  const storeTables = mapStoreTables(storeTablesRaw);
  const storePremises = mapStorePremises(storePremisesRaw);

  return {
    categories,
    products,
    productPrices,
    optionGroups,
    storeTables,
    storePremises,
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

/** Legacy: `store_premises.filter(p => p.id == table.idcategory)`. */
export function resolveStorePremiseForTable(
  premises: StorePremise[],
  tableId: number,
  storeTables: StoreTable[],
): StorePremise | null {
  if (!premises.length) {
    return null;
  }
  const table = storeTables.find(t => t.id === tableId);
  if (table?.idcategory) {
    const matched = premises.find(p => p.id === table.idcategory);
    if (matched) {
      return matched;
    }
  }
  const withTax = premises.find(p => p.taxId?.trim());
  if (withTax) {
    return withTax;
  }
  return premises[0] ?? null;
}
