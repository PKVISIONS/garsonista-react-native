import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';
import {usePaymentStore} from '../stores/Payment/PaymentStore';
import {vivaLog, vivaPreview} from './payment/vivaLogger';

function isSuccessfulVivaResponse(response: string | null | undefined): boolean {
  if (!response) {
    return false;
  }
  const text = response.trim();
  if (!text || text === 'no response yet') {
    return false;
  }
  try {
    const parsed = JSON.parse(text) as {fields?: {status?: unknown}; url?: unknown};
    const status = String(parsed.fields?.status ?? '').toLowerCase();
    if (status === 'success' || status === 'ok') {
      return true;
    }
    if (typeof parsed.url === 'string') {
      return isSuccessfulVivaResponse(parsed.url);
    }
  } catch {
    /* Fall through to raw callback parsing. */
  }
  const queryStart = text.indexOf('?');
  const query = queryStart >= 0 ? text.slice(queryStart + 1) : text;
  const status = new URLSearchParams(query).get('status')?.toLowerCase();
  return status === 'success' || status === 'ok';
}

export async function getVivaTransactionStatus(transactionId: string): Promise<string> {
  const form = new FormData();
  form.append('select', 'get_viva_trans_status');
  form.append('transactionId', transactionId);
  return legacyPostText(getRuntimeConfig().catalogUrl, form);
}

export async function sendVivaFinal(payload: {
  vivaTransId: string;
  aadeTransactionId: string;
  cardType?: string;
  accountNumber?: string;
  userId: number;
  userLogin: string;
  password: string;
  notaxdocsToLocalPrinter?: number;
}): Promise<string> {
  const form = new FormData();
  form.append('ajax', 'true');
  form.append('select', 'send_viva_final');
  form.append('app_src', 'kiosk');
  form.append('viva_transID', payload.vivaTransId);
  form.append('aadeTransactionId', payload.aadeTransactionId);
  form.append('vivacardType', payload.cardType ?? '');
  form.append('vivaaccountNumber', payload.accountNumber ?? '');
  form.append(
    'notaxdocs_tolocal_printer',
    String(payload.notaxdocsToLocalPrinter ?? 0),
  );
  form.append('user_id', String(payload.userId));
  form.append('user', payload.userLogin);
  form.append('p', payload.password);
  const requestData = {
    url: getRuntimeConfig().orderUrl,
    ajax: 'true',
    select: 'send_viva_final',
    app_src: 'kiosk',
    viva_transID: payload.vivaTransId,
    aadeTransactionId: payload.aadeTransactionId,
    vivacardType: payload.cardType ?? '',
    vivaaccountNumber: payload.accountNumber ?? '',
    notaxdocs_tolocal_printer: String(payload.notaxdocsToLocalPrinter ?? 0),
    user_id: String(payload.userId),
    user: payload.userLogin,
    passwordLength: payload.password.length,
  };
  vivaLog('send_viva_final request', requestData);
  try {
    const response = await legacyPostText(getRuntimeConfig().orderUrl, form);
    vivaLog('send_viva_final response', {
      length: response.length,
      preview: vivaPreview(response, 1200),
    });
    return response;
  } catch (e) {
    vivaLog('send_viva_final error', {
      message: (e as Error)?.message ?? String(e),
      request: requestData,
    });
    throw e;
  }
}

export async function revertSaleKiosk(
  idtaxdocument: string,
  vivaDetails?: {
    lastVivaRequest?: string | null;
    lastVivaResponse?: string | null;
  },
): Promise<string> {
  const state = usePaymentStore.getState();
  const lastVivaRequest = vivaDetails?.lastVivaRequest ?? state.lastVivaRequest;
  const lastVivaResponse = vivaDetails?.lastVivaResponse ?? state.lastVivaResponse;
  if (isSuccessfulVivaResponse(lastVivaResponse)) {
    vivaLog('revert_sale_kiosk_ajax skipped after successful Viva response', {
      idtaxdocument,
      lastVivaResponse,
    });
    return 'skipped: viva transaction successful';
  }
  const form = new FormData();
  form.append('ajax', 'true');
  form.append('select', 'revert_sale_kiosk_ajax');
  form.append('app_src', 'kiosk');
  form.append('idtaxdocument', '0');
  form.append('lastVivaRequest', lastVivaRequest ?? '');
  form.append('lastVivaResponse', lastVivaResponse ?? '');
  const url = 'https://mobileapp.garsonista.gr/main/tax_documents_final_v20/';
  const requestData = {
    url,
    ajax: 'true',
    select: 'revert_sale_kiosk_ajax',
    app_src: 'kiosk',
    idtaxdocument: '0',
    originalIdtaxdocument: idtaxdocument,
    lastVivaRequest: lastVivaRequest ?? '',
    lastVivaResponse: lastVivaResponse ?? '',
  };
  vivaLog('revert_sale_kiosk_ajax request', requestData);
  try {
    const response = await legacyPostText(url, form);
    vivaLog('revert_sale_kiosk_ajax response', {
      idtaxdocument,
      length: response.length,
      preview: vivaPreview(response, 1200),
    });
    return response;
  } catch (e) {
    vivaLog('revert_sale_kiosk_ajax error', {
      message: (e as Error)?.message ?? String(e),
      request: requestData,
    });
    throw e;
  }
}
