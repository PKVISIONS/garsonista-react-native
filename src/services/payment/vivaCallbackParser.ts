import {mapVivaTransaction} from '../adapters/paymentAdapter';
import type {VivaTransaction} from '@models/payment';

/** Fields returned on deep link / app callback (see legacy URLHandling.js). */
export type VivaCallbackFields = Record<string, string | null>;

export function parseVivaCallbackUrl(url: string): VivaCallbackFields {
  const normalized = url.startsWith('garsonista_offline://')
    ? url.slice('garsonista_offline://'.length)
    : url;
  const q = normalized.includes('?')
    ? normalized.slice(normalized.indexOf('?'))
    : `?${normalized}`;
  const params = new URLSearchParams(q.startsWith('?') ? q : `?${q}`);
  const get = (k: string) => params.get(k);
  const rawStatus = (get('status') ?? '').toLowerCase();
  const normalizedStatus =
    rawStatus === 'ok' ? 'success' : rawStatus === 'fail' ? 'failed' : rawStatus;

  const fields = {
    status: normalizedStatus || null,
    message: get('message'),
    action: get('action'),
    clientTransactionId: get('clientTransactionId'),
    transactionId: get('transactionId'),
    transactionEventId: get('transactionEventId'),
    amount: get('amount'),
    tipAmount: get('tipAmount'),
    cardType: get('cardType'),
    accountNumber: get('accountNumber'),
    aadeTransactionId: get('aadeTransactionId'),
    paymentMethod: get('paymentMethod'),
  transactionDate: get('transactionDate'),
  fiscalisationSigningDetails: get('fiscalisationSigningDetails'),
  };

  if (__DEV__) {
    console.log(`[VivaFlow] Raw Viva callback url len=${url.length}`);
    console.log(`[VivaFlow] Raw Viva callback url preview=${url.slice(0, 240)}`);
    const summary = Object.entries(fields)
      .map(([key, value]) => `${key}=${value ?? 'null'}`)
      .join(' ');
    console.log(`[VivaFlow] Parsed Viva callback fields ${summary}`);
    if (fields.fiscalisationSigningDetails) {
      console.log(
        `[VivaFlow] Parsed Viva callback fiscalisationSigningDetails=${fields.fiscalisationSigningDetails.slice(0, 200)}`,
      );
    }
  }

  return fields;
}

export function vivaFieldsToTransaction(
  fields: VivaCallbackFields,
): VivaTransaction {
  const amountCents = Number(fields.amount ?? 0);
  const normalized = (fields.status ?? '').toLowerCase();
  const status =
    normalized === 'success' || normalized === 'ok'
      ? 'success'
      : normalized === 'failed' || normalized === 'fail'
        ? 'failed'
        : 'pending';
  return mapVivaTransaction({
    transactionId: fields.transactionId ?? '',
    clientTransactionId: fields.clientTransactionId ?? '',
    status,
    amount: amountCents / 100,
    cardType: fields.cardType ?? '',
    maskedCard: fields.accountNumber ?? '',
    aadeTransactionId: fields.aadeTransactionId ?? '',
    receiptData: null,
  });
}
