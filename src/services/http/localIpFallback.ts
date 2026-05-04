import type {AxiosInstance, InternalAxiosRequestConfig} from 'axios';

/**
 * Retry failed cloud requests against alternate host (legacy root fallback).
 */
export function attachLocalIpFallback(client: AxiosInstance): void {
  client.interceptors.response.use(
    res => res,
    async error => {
      const status = error?.response?.status;
      const config = error?.config as
        | (InternalAxiosRequestConfig & {__altRetry?: boolean})
        | undefined;
      if (!config || config.__altRetry) {
        return Promise.reject(error);
      }
      const url = String(config.url ?? '');
      if (
        (status !== undefined && (status >= 500 || status === 0)) &&
        url.includes('garsonista4.datapp.gr')
      ) {
        config.__altRetry = true;
        config.url = url.replace('garsonista4.datapp.gr', 'garsonista.datapp.gr');
        return client.request(config);
      }
      return Promise.reject(error);
    },
  );
}
