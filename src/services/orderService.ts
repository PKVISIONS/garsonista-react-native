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
  options?: {
    paymentMethod?: 'cash' | 'card' | 'bank' | 'iris';
    orderNumber?: number;
    tipAmount?: number;
  },
): Promise<ReturnType<typeof mapInsertOrdersResponse>> {
  const wire = buildWireOrdersFromCart(cart, ctx, options);
  const paymentMethod = options?.paymentMethod ?? 'cash';
  const totalAmount = cart.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const prebankVal = paymentMethod === 'bank' ? totalAmount : 0;
  const isIris = paymentMethod === 'iris' ? 1 : 0;
  const isCredit = paymentMethod === 'card' ? 1 : 0;
  const hasTidNsp = String((ctx as Record<string, unknown>).tid_nsp ?? '').trim() !== '';
  const action =
    isCredit === 1 && totalAmount > 0 && hasTidNsp
      ? 'signature'
      : 'receipt';
  const isCashOnly = paymentMethod === 'cash';
  const novusUser = paymentMethod === 'card'
    ? 1
    : isCashOnly
      ? 0
      : Number(ctx.auto_receipt) === 1 && Number(ctx.novus_user) === 1
        ? 1
        : 0;
  const form = new FormData();
  form.append('ajax', 'true');
  form.append('select', 'insert_orders');
  form.append('action', action);
  form.append('app_src', 'kiosk');
  form.append('norders', JSON.stringify(wire));
  form.append('prebank_val', String(prebankVal));
  form.append('isiris', String(isIris));
  form.append('iscredit', String(isCredit));
  form.append('semiL', String(ctx.semiLocal));
  form.append('user_id', String(ctx.userId));
  form.append('novus_user', String(novusUser));
  form.append('notaxdocs_tolocal_printer', '0');
  form.append('idstore_pos', String(Number((ctx as Record<string, unknown>).idstore_pos ?? 0)));
  form.append('aade_branchcode', String(Number((ctx as Record<string, unknown>).aade_branchcode ?? 0)));
  form.append('tableid', String(ctx.tableId));
  form.append('ismellon', String(Number((ctx as Record<string, unknown>).ismellon ?? 0)));
  form.append('isvivacloud', String(Number((ctx as Record<string, unknown>).isvivacloud ?? 0)));
  form.append('tid_nsp', String((ctx as Record<string, unknown>).tid_nsp ?? ''));
  form.append('always_receipt_final', String(Number((ctx as Record<string, unknown>).always_receipt_final ?? 0)));
  form.append('tipAmount', String(options?.tipAmount ?? 0));
  form.append('user', String(ctx.userLogin));
  form.append('p', String(ctx.password));
  if (__DEV__) {
    const first = wire[0] as Record<string, unknown> | undefined;
    console.log(
      `[VivaFlow] insert_orders req paymentMethod=${paymentMethod} action=${action} tableid=${ctx.tableId} prebank_val=${prebankVal.toFixed(
        2,
      )} iscredit=${isCredit} hasTidNsp=${hasTidNsp} novus_user=${novusUser} auto_receipt=${ctx.auto_receipt} ctx.novus_user=${ctx.novus_user}`,
    );
    if (first) {
      console.log(
        `[VivaFlow] insert_orders first norder tableid=${String(
          first.tableid ?? '',
        )} productid=${String(first.productid ?? '')} iscredit=${String(
          first.iscredit ?? '',
        )} isprepaid=${String(first.isprepaid ?? '')} precard_val_tot=${String(
          first.precard_val_tot ?? '',
        )} posClient=${String(first.POSclientUNID ?? '')}`,
      );
    }
  }
  const baseUrl =
    ctx.localIp !== '' && ctx.semiLocal === 0
      ? ctx.localIp
      : getRuntimeConfig().orderUrl;
  const text = await legacyPostText(baseUrl, form);
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
