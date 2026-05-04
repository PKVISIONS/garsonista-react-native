import {VIVA_APP_ID} from '@constants/config';

export type VivaSaleParams = {
  clientTransactionId: string;
  amountEuros: number;
  tipEuros?: number;
  showReceipt?: boolean;
  /** When AADE signing is required, pass digest/signature from fiscal step. */
  aade?: {
    providerId: string;
    digest: string;
    signature: string;
  };
};

/**
 * Builds `vivapayclient://pay/v1` URI (legacy `call_viva` parity).
 * ISV fee parameters are omitted — configure in native env if required.
 */
export function buildVivaPaymentUri(params: VivaSaleParams): string {
  const amountCents = Math.round(params.amountEuros * 100);
  const tipCents = Math.round((params.tipEuros ?? 0) * 100);
  const hasAade = Boolean(params.aade?.digest && params.aade?.signature);
  const clientId = hasAade
    ? `AUTX${params.aade?.providerId ?? ''}`
    : params.clientTransactionId;

  let uri =
    'vivapayclient://pay/v1' +
    `?appId=${encodeURIComponent(VIVA_APP_ID)}` +
    '&action=sale' +
    `&clientTransactionId=${encodeURIComponent(clientId)}` +
    `&amount=${amountCents}` +
    `&tipAmount=${tipCents}` +
    `&show_receipt=${hasAade ? 'false' : String(params.showReceipt ?? true)}` +
    `&show_transaction_result=${hasAade ? 'false' : 'true'}` +
    `&show_rating=${hasAade ? 'false' : 'true'}`;

  if (hasAade && params.aade) {
    uri +=
      '&aadeProviderId=112' +
      `&aadeProviderSignatureData=${encodeURIComponent(params.aade.digest)}` +
      `&aadeProviderSignature=${encodeURIComponent(params.aade.signature)}` +
      '&protocol=int_default';
  }

  return uri;
}
