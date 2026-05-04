import {parseJsonArray} from './adapters/jsonParse';
import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';

export type SubscriptionInfo = {
  expdays: number;
};

export async function fetchSubscription(): Promise<SubscriptionInfo | null> {
  const form = new FormData();
  form.append('select', 'get_subscription');
  const text = await legacyPostText(getRuntimeConfig().catalogUrl, form);
  if (!text || text === 'null') {
    return null;
  }
  try {
    const arr = parseJsonArray(text);
    const row = arr[0] as {expdays?: number};
    if (row && typeof row.expdays === 'number' && !Number.isNaN(row.expdays)) {
      return {expdays: row.expdays};
    }
  } catch {
    /* ignore */
  }
  return null;
}
