import type {Cart} from '@models/cart';
import {
  buildWireOrdersFromCart,
  mapInsertOrdersResponse,
  type BuildWireContext,
} from './adapters/orderAdapter';
import {legacyPostText} from './http';
import {getRuntimeConfig} from '@constants/runtimeConfig';
import {mmkv} from '../storage/mmkv';
import {DEBUG_LOGS_ENABLED, STORAGE_KEYS} from '@constants/config';
import {vivaLog, vivaPreview} from './payment/vivaLogger';

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
  const hasTidNsp = String((ctx as Record<string, unknown>).tid_nsp ?? '').trim() !== '';
  const cardSignatureMode = paymentMethod === 'card' && totalAmount > 0 && hasTidNsp;
  const isCredit = paymentMethod === 'card' && !cardSignatureMode ? 1 : 0;
  const action = cardSignatureMode ? 'signature' : 'receipt';
  const novusUser = 1;
  const alwaysReceiptFinal = 1;
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
  form.append('notaxdocs_tolocal_printer', String(Number(ctx.notaxdocs_tolocal_printer ?? 0)));
  form.append('idstore_pos', String(Number((ctx as Record<string, unknown>).idstore_pos ?? 0)));
  form.append('aade_branchcode', String(Number((ctx as Record<string, unknown>).aade_branchcode ?? 0)));
  form.append('tableid', String(ctx.tableId));
  form.append('ismellon', String(Number((ctx as Record<string, unknown>).ismellon ?? 0)));
  form.append('isvivacloud', String(Number((ctx as Record<string, unknown>).isvivacloud ?? 0)));
  form.append('tid_nsp', String((ctx as Record<string, unknown>).tid_nsp ?? ''));
  form.append('always_receipt_final', String(alwaysReceiptFinal));
  form.append('auto_receipt_switch', '1');
  form.append('tipAmount', String(options?.tipAmount ?? 0));
  form.append('user', String(ctx.userLogin));
  form.append('p', String(ctx.password));
  if (DEBUG_LOGS_ENABLED) {
    const first = wire[0] as Record<string, unknown> | undefined;
    console.log(
      `[VivaFlow] insert_orders req paymentMethod=${paymentMethod} action=${action} tableid=${ctx.tableId} prebank_val=${prebankVal.toFixed(
        2,
      )} iscredit=${isCredit} isiris=${isIris} hasTidNsp=${hasTidNsp} novus_user=${novusUser} auto_receipt=${ctx.auto_receipt} ctx.novus_user=${ctx.novus_user} semiL=${ctx.semiLocal} notaxdocs=${ctx.notaxdocs_tolocal_printer} idstore_pos=${ctx.idstore_pos} aade_branchcode=${ctx.aade_branchcode} always_receipt_final=${alwaysReceiptFinal} ctx.always_receipt_final=${ctx.always_receipt_final} ismellon=${ctx.ismellon} isvivacloud=${ctx.isvivacloud}`,
    );
    if (first) {
      console.log(
        `[VivaFlow] insert_orders first norder tableid=${String(
          first.tableid ?? '',
        )} productid=${String(first.productid ?? '')} iscredit=${String(
          first.iscredit ?? '',
        )} isprepaid=${String(first.isprepaid ?? '')} precard_val_tot=${String(
          first.precard_val_tot ?? '',
        )} precash_val=${String(first.precash_val ?? '')} precard_val=${String(
          first.precard_val ?? '',
        )} prebank_val=${String(first.prebank_val ?? '')} precash_val_tot=${String(
          first.precash_val_tot ?? '',
        )} prebank_val_tot=${String(first.prebank_val_tot ?? '')} auto_receipt_switch=${String(
          first.auto_receipt_switch ?? '',
        )} print_receipt=${String(
          first.print_receipt ?? '',
        )} islocal=${String(first.islocal ?? '')} novus_user=${String(
          first.novus_user ?? '',
        )} posClient=${String(first.POSclientUNID ?? '')}`,
      );
    }
  }
  const baseUrl =
    ctx.localIp !== '' && ctx.semiLocal === 0
      ? ctx.localIp
      : getRuntimeConfig().orderUrl;
  if (paymentMethod === 'card') {
    vivaLog('insert_orders request', {
      url: baseUrl,
      ajax: 'true',
      select: 'insert_orders',
      action,
      app_src: 'kiosk',
      norders: JSON.stringify(wire),
      prebank_val: String(prebankVal),
      isiris: String(isIris),
      iscredit: String(isCredit),
      semiL: String(ctx.semiLocal),
      user_id: String(ctx.userId),
      novus_user: String(novusUser),
      notaxdocs_tolocal_printer: String(Number(ctx.notaxdocs_tolocal_printer ?? 0)),
      idstore_pos: String(Number((ctx as Record<string, unknown>).idstore_pos ?? 0)),
      aade_branchcode: String(Number((ctx as Record<string, unknown>).aade_branchcode ?? 0)),
      tableid: String(ctx.tableId),
      ismellon: String(Number((ctx as Record<string, unknown>).ismellon ?? 0)),
      isvivacloud: String(Number((ctx as Record<string, unknown>).isvivacloud ?? 0)),
      tid_nsp: String((ctx as Record<string, unknown>).tid_nsp ?? ''),
      always_receipt_final: String(alwaysReceiptFinal),
      auto_receipt_switch: '1',
      tipAmount: String(options?.tipAmount ?? 0),
      user: String(ctx.userLogin),
      passwordLength: String(ctx.password).length,
    });
  }
  try {
    const text = await legacyPostText(baseUrl, form);
    if (paymentMethod === 'card') {
      vivaLog('insert_orders response', {
        length: text.length,
        preview: vivaPreview(text, 1200),
      });
    }
    return mapInsertOrdersResponse(text, cart);
  } catch (e) {
    if (paymentMethod === 'card') {
      vivaLog('insert_orders error', {
        message: (e as Error)?.message ?? String(e),
        url: baseUrl,
        action,
        tableid: String(ctx.tableId),
      });
    }
    throw e;
  }
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
