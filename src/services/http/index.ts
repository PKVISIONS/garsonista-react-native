import {attachLocalIpFallback} from './localIpFallback';
import {httpClient} from './client';
import {installHttpStatsGlobal} from './requestMetrics';

attachLocalIpFallback(httpClient);
installHttpStatsGlobal();

export {httpClient, createHttpClient, setApiCredentials, getApiCredentials} from './client';
export {legacyPostText} from './legacyRequest';
export {attachLocalIpFallback} from './localIpFallback';
