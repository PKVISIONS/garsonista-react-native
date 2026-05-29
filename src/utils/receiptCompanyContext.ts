import type {Cart} from '@models';
import type {StorePremise} from '@models';
import type {CatalogBootstrap} from '@services/catalogService';
import {
  fetchStorePremisesOnly,
  resolveStorePremiseForTable,
} from '@services/catalogService';
import type {ReceiptContext} from '@services/printing/receiptBuilder';
import {legacyStringField} from './legacyRecordFields';

function premiseField(
  premise: StorePremise | null | undefined,
  field: keyof StorePremise,
): string | null {
  if (!premise) {
    return null;
  }
  const v = premise[field];
  if (v == null) {
    return null;
  }
  const s = String(v).trim();
  return s !== '' ? s : null;
}

/** Skip `address1` when it duplicates `poli` + `doy` (kiosk login rows). */
function wireAddress(
  user: Record<string, unknown> | null,
): string | null {
  if (!user) {
    return null;
  }
  const street = legacyStringField(
    user,
    'dieythynsi',
    'dieuthinsi',
    'dieythinsi',
    'address',
    'addr',
  );
  if (street) {
    return street;
  }
  const poli = legacyStringField(user, 'poli', 'polh', 'city');
  const doy = legacyStringField(user, 'doy', 'tax_office', 'taxoffice');
  const addr1 = legacyStringField(user, 'address1');
  if (addr1 && doy && addr1.includes(doy)) {
    return null;
  }
  if (addr1 && poli && addr1.replace(/\s+/g, ' ').trim().startsWith(poli)) {
    return null;
  }
  return addr1;
}

function pickFirst(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v != null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return null;
}

/** Fill gaps from any premise row (e.g. table match missing ΑΦΜ but another branch has it). */
function enrichPremiseFromAll(
  primary: StorePremise | null,
  premises: StorePremise[],
): StorePremise | null {
  if (!premises.length) {
    return primary;
  }
  const pick = (field: keyof StorePremise): string | null => {
    const fromPrimary = premiseField(primary ?? undefined, field);
    if (fromPrimary) {
      return fromPrimary;
    }
    for (const p of premises) {
      const v = premiseField(p, field);
      if (v) {
        return v;
      }
    }
    return null;
  };
  const base = primary ?? premises[0];
  return {
    ...base,
    epwnimia: pick('epwnimia'),
    companyDescr: pick('companyDescr'),
    address: pick('address'),
    city: pick('city'),
    postalCode: pick('postalCode'),
    taxId: pick('taxId'),
    taxOffice: pick('taxOffice'),
  };
}

type TaxFields = {taxId: string | null; taxOffice: string | null};

/** Kiosk rows often store tax office in `poli` + `doy` + `tk` / `address1` instead of `afm`. */
function resolveKioskTaxFields(
  user: Record<string, unknown> | null,
  storePremise: StorePremise | null | undefined,
  merged: ReceiptContext,
): TaxFields {
  let taxId = merged.taxId?.trim() ?? '';
  let taxOffice = merged.taxOffice?.trim() ?? '';

  const poli =
    (user ? legacyStringField(user, 'poli', 'polh', 'city') : null) ??
    premiseField(storePremise, 'city');
  const doy =
    (user ? legacyStringField(user, 'doy', 'tax_office', 'taxoffice', 'dou') : null) ??
    premiseField(storePremise, 'taxOffice');
  const tk =
    (user ? legacyStringField(user, 'tk', 'postal_code', 'postcode') : null) ??
    premiseField(storePremise, 'postalCode');

  if (!taxId && poli) {
    taxId = poli;
  }
  if (!taxOffice && doy) {
    taxOffice = tk ? `${doy} ${tk}` : doy;
  }

  if (!taxId || !taxOffice) {
    const addr1 =
      (user ? legacyStringField(user, 'address1') : null) ??
      premiseField(storePremise, 'address');
    if (addr1) {
      const parts = addr1.replace(/\s+/g, ' ').trim().split(' ');
      if (parts.length >= 2) {
        if (!taxId) {
          taxId = parts[0];
        }
        if (!taxOffice) {
          taxOffice = parts.slice(1).join(' ');
        }
      }
    }
  }

  return {
    taxId: taxId || null,
    taxOffice: taxOffice || null,
  };
}

function isKioskTaxPlaceholderLine(
  line: string | null | undefined,
  tax: TaxFields,
): boolean {
  if (!line?.trim() || !tax.taxId || !tax.taxOffice) {
    return false;
  }
  const norm = line.replace(/\s+/g, ' ').trim();
  const compact = `${tax.taxId} ${tax.taxOffice}`.replace(/\s+/g, ' ').trim();
  return norm === compact || norm.includes(tax.taxOffice);
}

/** Map login `wireRow` + legacy `get_store_premises` row (user first, then premise). */
export function mergeReceiptCompanyContext(
  wireRow: Record<string, unknown> | null | undefined,
  ctx: ReceiptContext,
  storePremise?: StorePremise | null,
): ReceiptContext {
  const user = wireRow ?? null;

  const merged = {
    ...ctx,
    companyName: pickFirst(
      user
        ? legacyStringField(
            user,
            'epwnimia',
            'company_name',
            'eponymia',
            'eponimia',
          )
        : null,
      premiseField(storePremise, 'epwnimia'),
      ctx.companyName,
    ),
    companyDescription: pickFirst(
      user
        ? legacyStringField(
            user,
            'company_descr',
            'company_description',
            'store_descr',
            'store_description',
          )
        : null,
      premiseField(storePremise, 'companyDescr'),
      user ? legacyStringField(user, 'store_name') : null,
      premiseField(storePremise, 'descr'),
      ctx.companyDescription,
      ctx.branchName,
    ),
    branchName: pickFirst(
      user ? legacyStringField(user, 'store_name') : null,
      premiseField(storePremise, 'descr'),
      ctx.branchName,
    ),
    address: pickFirst(
      user ? wireAddress(user) : null,
      premiseField(storePremise, 'address'),
      ctx.address,
    ),
    city: pickFirst(
      user ? legacyStringField(user, 'poli', 'polh', 'city') : null,
      premiseField(storePremise, 'city'),
      ctx.city,
    ),
    postalCode: pickFirst(
      user
        ? legacyStringField(user, 'tk', 'postal_code', 'postcode', 'zip')
        : null,
      premiseField(storePremise, 'postalCode'),
      ctx.postalCode,
    ),
    taxId: pickFirst(
      user
        ? legacyStringField(
            user,
            'afm',
            'vat',
            'vat_number',
            'tax_id',
            'taxid',
            'company_afm',
            'companyafm',
          )
        : null,
      premiseField(storePremise, 'taxId'),
      ctx.taxId,
    ),
    taxOffice: pickFirst(
      user
        ? legacyStringField(user, 'doy', 'tax_office', 'taxoffice', 'dou')
        : null,
      premiseField(storePremise, 'taxOffice'),
      ctx.taxOffice,
    ),
  };

  const tax = resolveKioskTaxFields(user, storePremise, merged);

  return {
    ...merged,
    taxId: tax.taxId ?? merged.taxId,
    taxOffice: tax.taxOffice ?? merged.taxOffice,
    address: isKioskTaxPlaceholderLine(merged.address, tax) ? null : merged.address,
    city: isKioskTaxPlaceholderLine(merged.city, tax) ? null : merged.city,
    postalCode:
      isKioskTaxPlaceholderLine(
        [merged.city, merged.postalCode].filter(Boolean).join(' '),
        tax,
      )
        ? null
        : merged.postalCode,
  };
}

/**
 * Ensures `get_store_premises` is available (catalog bootstrap or on-demand fetch).
 * Call before printing when the session may predate premises in catalog.
 */
export async function ensureReceiptCatalogPremises(
  catalog: CatalogBootstrap | null,
): Promise<CatalogBootstrap | null> {
  if (!catalog) {
    return null;
  }
  if (catalog.storePremises.length > 0) {
    return catalog;
  }
  const premises = await fetchStorePremisesOnly();
  if (!premises.length) {
    return catalog;
  }
  return {...catalog, storePremises: premises};
}

export function buildReceiptPrintContext(
  wireRow: Record<string, unknown> | null | undefined,
  cart: Cart,
  partial: ReceiptContext,
  catalog: CatalogBootstrap | null,
): ReceiptContext {
  const premises = catalog?.storePremises ?? [];
  const matched =
    catalog != null
      ? resolveStorePremiseForTable(premises, cart.tableId, catalog.storeTables)
      : null;
  const premise = enrichPremiseFromAll(matched, premises);

  if (__DEV__) {
    const table = catalog?.storeTables.find(t => t.id === cart.tableId);
    console.log(
      `[ReceiptPrint] company premises=${premises.length} premiseId=${premise?.id ?? '—'} tableId=${cart.tableId} idcategory=${table?.idcategory ?? '—'} afm=${premise?.taxId ?? legacyStringField(wireRow ?? {}, 'afm') ?? '—'} doy=${premise?.taxOffice ?? legacyStringField(wireRow ?? {}, 'doy') ?? '—'} addr=${premise?.address ?? legacyStringField(wireRow ?? {}, 'dieythynsi', 'address1') ?? '—'}`,
    );
  }

  return mergeReceiptCompanyContext(
    wireRow,
    {
      ...partial,
      serviceType: partial.serviceType ?? cart.type,
    },
    premise,
  );
}
