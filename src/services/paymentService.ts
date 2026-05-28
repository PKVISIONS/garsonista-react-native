import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';
import {API_BASE_URL} from '@constants/config';

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

export async function revertSaleKiosk(idtaxdocument: string): Promise<string> {
  const form = new FormData();
  form.append('ajax', 'true');
  form.append('select', 'revert_sale_kiosk_ajax');
  form.append('app_src', 'kiosk');
  form.append('idtaxdocument', idtaxdocument);
  const root = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  return legacyPostText(`${root}main/tax_documents_final_v20/`, form);
}
