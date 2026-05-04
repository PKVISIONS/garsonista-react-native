import type {TaxCustomer} from '@models/customer';
import {parseJsonObject} from './jsonParse';
import {translate} from '../../stores/Localization/LocalizationStore';

/**
 * ΑΑΔΕ `seek_afm` via `main_plugins/` — nested SOAP-style JSON (`customer-vat-manager.js`).
 */
export function mapSeekAfmResponse(raw: unknown, afmInput: string): TaxCustomer {
  const o = raw as Record<string, unknown>;
  const errRec = o.pErrorRec_out as {errorDescr?: string | null} | undefined;
  if (errRec?.errorDescr) {
    throw new Error(String(errRec.errorDescr));
  }
  const basic = o.RgWsPublicBasicRt_out as Record<string, unknown> | undefined;
  if (!basic) {
    throw new Error(translate('kiosk.errors.afmInvalidResponse'));
  }
  const firmBlock = o.arrayOfRgWsPublicFirmActRt_out as
    | {RgWsPublicFirmActRtUser?: Array<{firmActDescr?: string}>}
    | undefined;
  const firm0 = firmBlock?.RgWsPublicFirmActRtUser?.[0];
  const addr = String(basic.postalAddress ?? '');
  const no = String(basic.postalAddressNo ?? '');
  return {
    id: 0,
    taxType: '',
    vatId: afmInput,
    taxOffice: String(basic.doyDescr ?? ''),
    businessName: String(basic.onomasia ?? ''),
    businessType: String(firm0?.firmActDescr ?? ''),
    address: [addr, no].filter(Boolean).join(' ').trim(),
    city: String(basic.postalAreaDescription ?? ''),
    postalCode: String(basic.postalZipCode ?? ''),
    countryCode: 'GR',
    email: '',
    vatExemptCode: null,
  };
}

export function mapTaxCustomer(raw: unknown): TaxCustomer {
  const o = parseJsonObject(raw);
  return {
    id: Number(o.id) || 0,
    taxType: String(o.taxtype ?? o.tax_type ?? ''),
    vatId: String(o.afm ?? o.vat ?? ''),
    taxOffice: String(o.doy ?? ''),
    businessName: String(o.epwnimia ?? o.name ?? ''),
    businessType: String(o.business_type ?? ''),
    address: String(o.dieythynsi ?? o.address ?? ''),
    city: String(o.poli ?? o.city ?? ''),
    postalCode: String(o.tk ?? o.postal ?? ''),
    countryCode: String(o.country ?? 'GR'),
    email: String(o.email ?? ''),
    vatExemptCode: o.vat_exempt != null ? String(o.vat_exempt) : null,
  };
}
