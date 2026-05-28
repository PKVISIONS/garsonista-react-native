import {STORAGE_KEYS, VIVA_APP_ID} from '@constants/config';
import {mmkv} from '../../storage/mmkv';

export type VivaSaleParams = {
  clientTransactionId: string;
  amountEuros: number;
  tipEuros?: number;
  showReceipt?: boolean;
  fiscalisationData?: string;
  /** When AADE signing is required, pass digest/signature from fiscal step. */
  aade?: {
    providerId: string;
    digest: string;
    signature: string;
  };
};

function shouldIncludeIsvParams(): boolean {
  const raw = mmkv.getString(STORAGE_KEYS.vivaIncludeIsv);
  if (raw == null) {
    return false;
  }
  const v = raw.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off' || v === 'no');
}

/**
 * Builds `vivapayclient://pay/v1` URI (legacy `call_viva` parity).
 * ISV fee parameters are omitted — configure in native env if required.
 */
export function buildVivaPaymentUri(params: VivaSaleParams): string {
  const amountCents = Math.round(params.amountEuros * 100);
  const tipCents = Math.round((params.tipEuros ?? 0) * 100);
  const hasAade = Boolean(params.aade?.digest && params.aade?.signature);
  const hasFiscalisationData = Boolean(params.fiscalisationData?.trim());
  const baseClientId = params.clientTransactionId.trim();
  const aadeClientId = baseClientId.startsWith('AUTX')
    ? baseClientId
    : `AUTX${baseClientId.replace(/^AUTB/i, '')}`;
  const clientId = hasAade
    ? `AUTX${params.aade?.providerId ?? ''}`
    : hasFiscalisationData
      ? aadeClientId
      : baseClientId;
  const showReceipt = params.showReceipt ?? true;
  const hideInteractiveUi = hasAade || hasFiscalisationData;

  let uri =
    'vivapayclient://pay/v1' +
    `?appId=${encodeURIComponent(VIVA_APP_ID)}` +
    '&action=sale' +
    `&clientTransactionId=${encodeURIComponent(clientId)}` +
    `&amount=${amountCents}` +
    `&tipAmount=${tipCents}` +
    `&show_receipt=${hideInteractiveUi ? 'false' : showReceipt ? 'true' : 'false'}` +
    `&show_transaction_result=${hideInteractiveUi ? 'false' : showReceipt ? 'true' : 'false'}` +
    `&show_rating=${hideInteractiveUi ? 'false' : 'true'}`;

  uri +=
    '&callback=' +
    encodeURIComponent('garsonista_offline://viva-return');

  const includeIsv = shouldIncludeIsvParams();
  if (includeIsv) {
    uri +=
      `&ISV_amount=${Math.round(params.amountEuros * 0.001 * 100)}` +
      '&ISV_clientId=78mmql4v0qfcdgep1l7mhjxfkzn8msi8zuzwa8q0b61t1.apps.vivapayments.com' +
      '&ISV_clientSecret=X7JpNWY190cH649R3n2koFHh0x5THP' +
      '&ISV_sourceCode=1350';
  }

  if (params.fiscalisationData) {
    uri += `&fiscalisationData=${encodeURIComponent(params.fiscalisationData)}`;
  }

  if (hasAade && params.aade) {
    uri +=
      '&aadeProviderId=112' +
      `&aadeProviderSignatureData=${encodeURIComponent(params.aade.digest)}` +
      `&aadeProviderSignature=${encodeURIComponent(params.aade.signature)}` +
      '&protocol=int_default';
  }

  if (__DEV__) {
    console.log(
      `[VivaFlow] buildVivaPaymentUri hasAade=${hasAade} hasFiscal=${hasFiscalisationData} clientId=${clientId} amountCents=${amountCents} tipCents=${tipCents}`,
    );
    console.log(`[VivaFlow] buildVivaPaymentUri includeIsv=${String(includeIsv)}`);
  }

  return uri;
}
