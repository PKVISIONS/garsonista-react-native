/**
 * Local ticket number shown on the receipt thank-you screen.
 * Independent from backend `headid` — starts at 1 per kiosk device and
 * can be reset via `resetTicketCounter`.
 */
import {STORAGE_KEYS} from '@constants/config';
import {mmkv} from '../storage/mmkv';

const KEY = STORAGE_KEYS.ticketCounter;
const RESET_FLAG_KEY = `${STORAGE_KEYS.ticketCounter}.resetVersion`;
const CURRENT_RESET_VERSION = '1';

if (mmkv.getString(RESET_FLAG_KEY) !== CURRENT_RESET_VERSION) {
  mmkv.set(KEY, '0');
  mmkv.set(RESET_FLAG_KEY, CURRENT_RESET_VERSION);
}

export function getTicketCounter(): number {
  const raw = mmkv.getString(KEY);
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Increments the counter and returns the new value (first call → 1). */
export function nextTicketNumber(): number {
  const next = getTicketCounter() + 1;
  mmkv.set(KEY, String(next));
  return next;
}

/** Set counter to 0 so the next ticket is 1. */
export function resetTicketCounter(): void {
  mmkv.set(KEY, '0');
}
