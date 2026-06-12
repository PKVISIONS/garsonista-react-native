export const APP_VERSION = '0.0.8';
export const DEBUG_LOGS_ENABLED = true;

/** Default API host (legacy web client parity). Override via env or local settings. */
export const API_BASE_URL = 'https://garsonista4.datapp.gr/';

export const API_BASE_URL_ALT = 'https://garsonista.datapp.gr/';

export const STORAGE_KEYS = {
  authPersist: 'garsonista.auth.persist',
  featureFlags: 'garsonista.featureFlags',
  offlineOrderQueue: 'garsonista.orders.offlineQueue',
  vivaIncludeIsv: 'garsonista.viva.includeIsv',
  preferredPrinter: 'garsonista.printing.preferredPrinter',
  lastGoodSplashUri: 'garsonista.splash.lastGoodUri',
  /** Local-only ticket counter shown on the thank-you screen */
  ticketCounter: 'garsonista.tickets.counter',
} as const;

/** Viva Pay Android client — matches legacy `call_viva` (no ISV secrets in repo). */
export const VIVA_APP_ID = 'gr.food4cook.garsonista';
