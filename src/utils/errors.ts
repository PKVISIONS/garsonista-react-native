import axios from 'axios';
import {translate} from '../stores/Localization/LocalizationStore';

export function formatRequestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string' && data.trim()) {
      return data.trim().slice(0, 400);
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      return translate('kiosk.errors.unauthorized');
    }
    if (error.code === 'ECONNABORTED') {
      return translate('kiosk.errors.timeout');
    }
    if (error.message) {
      return error.message;
    }
  }

  const withStatus = error as Error & {status?: number; responseBody?: string};
  if (typeof withStatus.status === 'number') {
    const body = withStatus.responseBody?.trim() ?? '';
    if (body) {
      try {
        const j = JSON.parse(body) as {message?: string};
        if (typeof j.message === 'string' && j.message.trim()) {
          return j.message.trim().slice(0, 400);
        }
      } catch {
        /* not JSON */
      }
      return body.slice(0, 400);
    }
    if (withStatus.status === 401 || withStatus.status === 403) {
      return translate('kiosk.errors.unauthorized');
    }
    return `HTTP ${withStatus.status}`;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return translate('kiosk.errors.timeout');
    }
    if (error.message === 'Network request failed' || error.message === 'Network Error') {
      return translate('kiosk.errors.network');
    }
    return error.message;
  }
  return translate('kiosk.errors.generic');
}
