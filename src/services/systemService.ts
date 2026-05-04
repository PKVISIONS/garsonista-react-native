import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';

export async function flushClientLogs(
  entries: Array<{alog: string; afrom: string; adata: string}>,
): Promise<void> {
  if (!entries.length) {
    return;
  }
  const form = new FormData();
  form.append('select', 'service_clients_log');
  form.append('log_ar', JSON.stringify(entries));
  await legacyPostText(getRuntimeConfig().catalogUrl, form);
}
