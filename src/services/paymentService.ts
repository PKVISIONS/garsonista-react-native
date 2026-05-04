import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';

export async function getVivaTransactionStatus(transactionId: string): Promise<string> {
  const form = new FormData();
  form.append('select', 'get_viva_trans_status');
  form.append('transactionId', transactionId);
  return legacyPostText(getRuntimeConfig().catalogUrl, form);
}

export async function sendVivaFinal(payload: Record<string, unknown>): Promise<string> {
  const form = new FormData();
  form.append('select', 'send_viva_final');
  form.append('payload', JSON.stringify(payload));
  return legacyPostText(getRuntimeConfig().catalogUrl, form);
}
