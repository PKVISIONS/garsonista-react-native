import type {Cart} from '@models/cart';
import {
  buildWireOrdersFromCart,
  mapInsertOrdersResponse,
  type BuildWireContext,
} from './adapters/orderAdapter';
import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';
import {mmkv} from '../storage/mmkv';
import {STORAGE_KEYS} from '@constants/config';

export async function submitCartOnline(
  cart: Cart,
  ctx: BuildWireContext,
): Promise<ReturnType<typeof mapInsertOrdersResponse>> {
  const wire = buildWireOrdersFromCart(cart, ctx);
  const form = new FormData();
  form.append('select', 'insert_orders');
  form.append('norders', JSON.stringify(wire));
  form.append('semiL', String(ctx.semiLocal));
  const text = await legacyPostText(getRuntimeConfig().catalogUrl, form);
  return mapInsertOrdersResponse(text, cart);
}

type Queued = {cart: Cart; ctx: BuildWireContext; queuedAt: string};

export function enqueueOfflineCart(cart: Cart, ctx: BuildWireContext): void {
  const key = STORAGE_KEYS.offlineOrderQueue;
  const prev = mmkv.getString(key);
  const list: Queued[] = prev ? (JSON.parse(prev) as Queued[]) : [];
  list.push({cart, ctx, queuedAt: new Date().toISOString()});
  mmkv.set(key, JSON.stringify(list));
}

export function drainOfflineQueue(
  submit: (c: Cart, x: BuildWireContext) => Promise<unknown>,
): Promise<void> {
  const key = STORAGE_KEYS.offlineOrderQueue;
  const raw = mmkv.getString(key);
  if (!raw) {
    return Promise.resolve();
  }
  const list = JSON.parse(raw) as Queued[];
  mmkv.remove(key);
  return (async () => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      try {
        await submit(item.cart, item.ctx);
      } catch {
        for (let j = i; j < list.length; j++) {
          enqueueOfflineCart(list[j].cart, list[j].ctx);
        }
        break;
      }
    }
  })();
}

export function getOfflineQueueLength(): number {
  const raw = mmkv.getString(STORAGE_KEYS.offlineOrderQueue);
  if (!raw) {
    return 0;
  }
  try {
    return (JSON.parse(raw) as unknown[]).length;
  } catch {
    return 0;
  }
}
