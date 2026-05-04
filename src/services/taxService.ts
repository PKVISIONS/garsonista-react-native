import {mapSeekAfmResponse, mapTaxCustomer} from './adapters/taxAdapter';
import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';
import {translate} from '../stores/Localization/LocalizationStore';

/** `main_plugins/`, fields `select=seek_afm`, `vat=<ΑΦΜ>`, `ajax`+credentials. */
export async function lookupAfm(afm: string): Promise<ReturnType<typeof mapTaxCustomer>> {
  const form = new FormData();
  form.append('select', 'seek_afm');
  form.append('vat', afm);
  const text = await legacyPostText(getRuntimeConfig().pluginsUrl, form);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(translate('kiosk.errors.invalidServerJson'));
  }
  return mapSeekAfmResponse(parsed, afm);
}

export async function searchTaxCustomers(
  query: string,
): Promise<ReturnType<typeof mapTaxCustomer>[]> {
  const form = new FormData();
  form.append('select', 'show_tax_customers');
  form.append('q', query);
  const text = await legacyPostText(getRuntimeConfig().catalogUrl, form);
  const arr = JSON.parse(text) as unknown[];
  return arr.map(row => mapTaxCustomer(row));
}
