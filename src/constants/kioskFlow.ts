/**
 * Inactivity / auto-return timeout (Cordova `idleTimeoutDuration` target: 10s on kiosk flows).
 * Used for global idle reset and thank-you / card-failed auto-return.
 */
export const KIOSK_AUTO_RESET_MS = 10_000;

export const KIOSK_IDLE_TIMEOUT_MS = KIOSK_AUTO_RESET_MS;
