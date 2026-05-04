import {mapVivaTransaction} from '../adapters/paymentAdapter';
import type {VivaTransaction} from '@models/payment';

/** Fields returned on deep link / app callback (see legacy URLHandling.js). */
export type VivaCallbackFields = Record<string, string | null>;

export function parseVivaCallbackUrl(url: string): VivaCallbackFields {
  const normalized = url.replace(
    'garsonista_offline://https://garsonista.datapp.gr/main/',
    '',
  );
  const q = normalized.includes('?')
    ? normalized.slice(normalized.indexOf('?'))
    : `?${normalized}`;
  const params = new URLSearchParams(q.startsWith('?') ? q : `?${q}`);
  const get = (k: string) => params.get(k);
  return {
    status: get('status'),
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
  };
}

export function vivaFieldsToTransaction(
  fields: VivaCallbackFields,
): VivaTransaction {
  const amountCents = Number(fields.amount ?? 0);
  const status =
    fields.status === 'success'
      ? 'success'
      : fields.status === 'failed'
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
