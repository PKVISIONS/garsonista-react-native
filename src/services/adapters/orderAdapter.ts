import type {Cart, CartItem} from '@models/cart';
import type {Order, OrderLine} from '@models/order';
import type {PaymentSummary} from '@models/payment';
import {parseJsonArray} from './jsonParse';

export type WireOrderRow = Record<string, unknown>;

export type BuildWireContext = {
  userId: number;
  userToken: string;
  slogtok: string;
  tableId: number;
  semiLocal: number;
  localIp: string;
};

export function buildWireOrdersFromCart(
  cart: Cart,
  ctx: BuildWireContext,
): WireOrderRow[] {
  let idx = 0;
  return cart.items.map(item => {
    idx += 1;
    const ISODate = new Date().toISOString();
    const clientUNID = `${ISODate}-${idx}-${ctx.slogtok}-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    return {
      headid: 0,
      itemid: 0,
      tableid: ctx.tableId,
      productid: item.productId,
      product_descr: item.productName,
      descr: item.productName,
      aqty: item.quantity,
      val: item.lineTotal,
      aval: item.unitPrice,
      mods: item.selectedOptions.map(o => ({
        groupId: o.groupId,
        valueId: o.valueId,
        label: o.label,
      })),
      ISODate,
      aver: 1,
      isupd: 0,
      ispaid: 0,
      isgift: 0,
      iscancelled: 0,
      iscompleted: 0,
      clientUNID,
      loginid: ctx.userId,
      user_login_descr: ctx.userToken,
      disc_val: 0,
      cash_val: 0,
      card_val: 0,
      bank_val: 0,
      precash_val: 0,
      precard_val: 0,
      prebank_val: 0,
      isprepaid: 0,
      isiris: 0,
      iscredit: 0,
      carthead_comments: cart.comment,
      islocal: ctx.localIp !== '' ? 1 : 0,
    };
  });
}

function emptyPayment(): PaymentSummary {
  return {
    method: 'cash',
    cashAmount: 0,
    cardAmount: 0,
    bankAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    isPrepaid: false,
  };
}

function mapLine(item: CartItem): OrderLine {
  return {
    lineId: item.lineId,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}

export function mapInsertOrdersResponse(raw: unknown, cart: Cart): Order {
  const arr = parseJsonArray(raw);
  const first = (arr[0] ?? {}) as Record<string, unknown>;
  const headid = Number(first.headid ?? 0);
  return {
    id: headid,
    clientId: cart.id,
    tableId: cart.tableId,
    type: cart.type,
    status: 'sent',
    items: cart.items.map(mapLine),
    payment: emptyPayment(),
    customer: cart.customer,
    fiscalDoc: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
