import type {Category, OptionGroup, OptionValue, Product} from '@models';
import {parseJsonArray} from './jsonParse';

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** First usable image field from legacy row (SQL column names vary). */
function pickImageUrl(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v == null) {
      continue;
    }
    const s = String(v).trim();
    if (s && s !== '0') {
      return s;
    }
  }
  return null;
}

function pickCategoryImageUrl(o: Record<string, unknown>): string | null {
  return pickImageUrl(o, ['image1', 'cimage1', 'aimage', 'image']);
}

function pickProductImageUrl(o: Record<string, unknown>): string | null {
  return pickImageUrl(o, [
    'image1',
    'image2',
    'image3',
    'image4',
    'value_image',
    'imageurl',
    'image_url',
    'imageuri',
    'image_uri',
    'value_imageurl',
    'image',
    'photo',
    'photo1',
    'photo2',
    'picture',
    'img',
    'img_url',
    'imgurl',
    'imagepath',
    'image_path',
    'imagefile',
    'image_file',
    'imagename',
    'photo_url',
    'icon',
    'icon_url',
    'iconurl',
    'thumbnail',
    'thumbnail_url',
    'thumb',
    'thumb_url',
    'kiosk_image1',
    'kiosk_image2',
    'kiosk_image3',
    'logo_new_image',
  ]);
}

/** Backend placeholder row — hide from UI. */
function isPlaceholderCategoryName(name: string): boolean {
  return name.trim().toLowerCase() === 'χωρίς κύρια κατηγορία';
}

function applyCategoryImageFallback(
  categories: Category[],
  products: Product[],
): Category[] {
  const byCategory = new Map<number, string>();
  for (const product of products) {
    if (byCategory.has(product.categoryId)) {
      continue;
    }
    if (product.imageUrl) {
      byCategory.set(product.categoryId, product.imageUrl);
    }
  }

  return categories.map(category => {
    if (category.imageUrl) {
      return category;
    }
    const imageUrl = byCategory.get(category.id);
    return imageUrl ? {...category, imageUrl} : category;
  });
}

export function mapMainAndSubCategories(
  mainRaw: unknown,
  subRaw: unknown,
  products?: Product[],
): Category[] {
  const main = parseJsonArray(mainRaw).map((c: unknown) => {
    const o = c as Record<string, unknown>;
    return {
      id: num(o.id),
      name: String(o.descr ?? ''),
      nameEn:
        typeof o.descr_en === 'string' && o.descr_en.trim()
          ? o.descr_en.trim()
          : null,
      parentId: null as number | null,
      imageUrl: pickCategoryImageUrl(o),
      sortOrder: num(o.aorder, 0),
    };
  });
  const sub = parseJsonArray(subRaw).map((c: unknown) => {
    const o = c as Record<string, unknown>;
    return {
      id: num(o.id),
      name: String(o.descr ?? ''),
      nameEn:
        typeof o.descr_en === 'string' && o.descr_en.trim()
          ? o.descr_en.trim()
          : null,
      parentId: num(o.idproduct_main_category) || null,
      imageUrl: pickCategoryImageUrl(o),
      sortOrder: num(o.aorder, 0),
    };
  });
  const categories = [...main, ...sub].filter(c => !isPlaceholderCategoryName(c.name));
  return products ? applyCategoryImageFallback(categories, products) : categories;
}

/**
 * Legacy list price: `bidval` (offer) else `aval` (unit) else `val`.
 * `get_store_products` often has `val` = 0; real unit price is in `aval`.
 */
export function mapProducts(raw: unknown): Product[] {
  const arr = parseJsonArray(raw);
  return arr.map((p: unknown) => {
    const o = p as Record<string, unknown>;
    const bidval = num(o.bidval);
    const aval = num(o.aval);
    const val = num(o.val);
    const basePrice = bidval > 0 ? bidval : aval > 0 ? aval : val;
    const ldescrRaw = o.ldescr ?? o.long_descr ?? '';
    const longDescription =
      typeof ldescrRaw === 'string' && ldescrRaw.trim() ? ldescrRaw.trim() : null;
    const longDescriptionEn =
      typeof o.ldescr_en === 'string' && o.ldescr_en.trim()
        ? o.ldescr_en.trim()
        : null;
    return {
      id: num(o.id),
      name: String(o.descr ?? ''),
      nameEn:
        typeof o.descr_en === 'string' && o.descr_en.trim()
          ? o.descr_en.trim()
          : null,
      categoryId: num(o.idcategory),
      imageUrl: pickProductImageUrl(o),
      longDescription,
      longDescriptionEn,
      basePrice,
      taxRate: num(o.product_fpa_fact, 24),
      taxIncluded: true,
      available: num(o.isinactive, 0) === 0,
    };
  });
}

/** Per-table overrides from `get_product_prices` (matches `product_prices` filter). */
export type ProductPriceRow = {
  tableid: number;
  productid: number;
  aval: number;
  inactive?: number;
};

export function mapProductPrices(raw: unknown): ProductPriceRow[] {
  try {
    const arr = parseJsonArray(raw);
    return arr.map((row: unknown) => {
      const o = row as Record<string, unknown>;
      return {
        tableid: num(o.tableid),
        productid: num(o.productid),
        aval: num(o.aval),
        inactive: o.inactive != null ? num(o.inactive) : undefined,
      };
    });
  } catch {
    return [];
  }
}

export function applyTablePrices(
  products: Product[],
  priceRows: ProductPriceRow[],
  tableId: number,
): Product[] {
  if (!priceRows.length) {
    return products;
  }
  return products.map(p => {
    const match = priceRows.find(
      r => r.tableid === tableId && r.productid === p.id,
    );
    if (match && match.aval > 0) {
      return {...p, basePrice: match.aval};
    }
    return p;
  });
}

/**
 * Extra cost for one option value. Legacy clients use `option_values[].acost`; some APIs use flat
 * `price_delta` / `valdelta` or mirror product fields (`aval`, `val`).
 */
function optionValuePrice(o: Record<string, unknown>): number {
  const bidval = num(o.bidval);
  const acost = num(o.acost);
  const aval = num(o.aval);
  const val = num(o.val);
  const delta = num(o.price_delta ?? o.valdelta);
  if (bidval > 0) {
    return bidval;
  }
  if (acost > 0) {
    return acost;
  }
  if (aval > 0) {
    return aval;
  }
  if (val > 0) {
    return val;
  }
  if (delta > 0) {
    return delta;
  }
  return acost;
}

/**
 * API may return nested groups (`option_values[]` with `acost`, `idoption_value`) or flat rows
 * per value. The catalog UI expects the nested shape in `catalog-navigation.js`.
 */
export function mapOptionGroups(raw: unknown): OptionGroup[] {
  try {
    const arr = parseJsonArray(raw);
    const map = new Map<string, OptionGroup>();
    for (const row of arr) {
      const o = row as Record<string, unknown>;
      const nested = o.option_values;

      if (Array.isArray(nested)) {
        const productId = num(o.idproduct);
        const groupId = num(o.idoption ?? o.idgroup ?? o.idoptiongroup ?? o.id);
        const key = `${productId}-${groupId}`;
        const atype = num(o.atype, 0);
        const g: OptionGroup = {
          id: groupId,
          productId,
          name: String(o.option_descr ?? o.group_descr ?? o.descr ?? 'Option'),
          nameEn:
            typeof (o.option_descr_en ?? o.group_descr_en) === 'string' &&
            String(o.option_descr_en ?? o.group_descr_en).trim()
              ? String(o.option_descr_en ?? o.group_descr_en).trim()
              : null,
          required: num(o.isrequired, 0) === 1,
          multiSelect: atype === 1,
          values: nested.map((v: unknown) => {
            const ov = v as Record<string, unknown>;
            const activates = num(ov.activate_idproduct_option, 0);
            return {
              id: num(ov.idoption_value ?? ov.id),
              groupId,
              name: String(ov.value_descr ?? ov.descr ?? ''),
              nameEn:
                typeof ov.value_descr_en === 'string' && ov.value_descr_en.trim()
                  ? ov.value_descr_en.trim()
                  : null,
              priceDelta: optionValuePrice(ov),
              imageUrl: pickProductImageUrl(ov),
              activatesGroupId: activates > 0 ? activates : null,
            };
          }),
        };
        map.set(key, g);
        continue;
      }

      const productId = num(o.idproduct);
      const groupId = num(
        o.idgroup ?? o.idoptiongroup ?? o.idoption ?? o.id,
      );
      const key = `${productId}-${groupId}`;
      let g = map.get(key);
      if (!g) {
        g = {
          id: groupId,
          productId,
          name: String(o.group_descr ?? o.option_descr ?? o.descr ?? 'Option'),
          nameEn:
            typeof (o.group_descr_en ?? o.option_descr_en) === 'string' &&
            String(o.group_descr_en ?? o.option_descr_en).trim()
              ? String(o.group_descr_en ?? o.option_descr_en).trim()
              : null,
          required: num(o.isrequired, 0) === 1,
          multiSelect: num(o.multiselect, 1) === 1,
          values: [] as OptionValue[],
        };
        map.set(key, g);
      }
      const activates = num(o.activate_idproduct_option, 0);
      const val: OptionValue = {
        id: num(o.idoption_value ?? o.id),
        groupId,
        name: String(o.descr ?? o.value_descr ?? ''),
        nameEn:
          typeof o.value_descr_en === 'string' && o.value_descr_en.trim()
            ? o.value_descr_en.trim()
            : null,
        priceDelta: optionValuePrice(o),
        imageUrl: pickProductImageUrl(o),
        activatesGroupId: activates > 0 ? activates : null,
      };
      g.values.push(val);
    }
    return [...map.values()];
  } catch {
    return [];
  }
}
