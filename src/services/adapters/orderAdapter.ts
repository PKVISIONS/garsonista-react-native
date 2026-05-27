import type {Cart, CartItem} from '@models/cart';
import type {Order, OrderLine} from '@models/order';
import type {PaymentSummary} from '@models/payment';
import {createPosClientUnid} from '@utils/posClientUnid';
import {parseJsonArray} from './jsonParse';

export type WireOrderRow = Record<string, unknown>;

export type BuildWireContext = {
  userId: number;
  userToken: string;
  userLogin: string;
  password: string;
  slogtok: string;
  tableId: number;
  semiLocal: number;
  localIp: string;
  idstore_pos: number;
  aade_branchcode: number;
  ismellon: number;
  isvivacloud: number;
  tid_nsp: string;
  always_receipt_final: number;
  novus_user: number;
  auto_receipt: number;
  headaa: number;
};

export function buildWireOrdersFromCart(
  cart: Cart,
  ctx: BuildWireContext,
  options?: {
    paymentMethod?: 'cash' | 'card' | 'bank' | 'iris';
    tipAmount?: number;
  },
): WireOrderRow[] {
  const paymentMethod = options?.paymentMethod ?? 'cash';
  const totalAmount = cart.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const cashAmount = paymentMethod === 'cash' ? totalAmount : 0;
  const cardAmount = paymentMethod === 'card' || paymentMethod === 'iris' ? totalAmount : 0;
  const bankAmount = paymentMethod === 'bank' ? totalAmount : 0;
  const POSclientUNID = createPosClientUnid();
  let idx = 0;
  return cart.items.map(item => {
    idx += 1;
    const ISODate = new Date().toISOString();
    const clientUNID = `${ISODate}-${idx}-${ctx.slogtok}-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    return {
      headid: 0,
      itemid: 0,
      tableid: ctx.tableId,
      headaa: ctx.headaa,
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
      isiris: paymentMethod === 'iris' ? 1 : 0,
      iscredit: paymentMethod === 'card' ? 1 : 0,
      isprepaid: item.quantity,
      auto_receipt: ctx.auto_receipt,
      ispaid: 0,
      isgift: 0,
      iscancelled: 0,
      iscompleted: 0,
      precash_val: cashAmount > 0 ? Number(((cashAmount / Math.max(totalAmount, 1)) * item.lineTotal).toFixed(2)) : 0,
      precard_val: cardAmount > 0 ? Number(((cardAmount / Math.max(totalAmount, 1)) * item.lineTotal).toFixed(2)) : 0,
      prebank_val: bankAmount > 0 ? Number(((bankAmount / Math.max(totalAmount, 1)) * item.lineTotal).toFixed(2)) : 0,
      precash_val_tot: cashAmount,
      precard_val_tot: cardAmount,
      prebank_val_tot: bankAmount,
      tips: options?.tipAmount ?? 0,
      clientUNID,
      POSclientUNID,
      byME: 1,
      auto_receipt_switch: ctx.auto_receipt,
      loginid: ctx.userId,
      user_login_descr: ctx.userToken,
      user_login: ctx.userLogin,
      p: ctx.password,
      disc_val: 0,
      cash_val: 0,
      card_val: 0,
      bank_val: 0,
      carthead_comments: cart.comment,
      islocal: ctx.localIp !== '' && ctx.semiLocal === 0 ? 1 : 0,
      novus_user: ctx.novus_user,
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
  const invoiceUrl = String(first.invoice_url ?? first.invoiceUrl ?? '');
  return {
    id: headid,
    clientId: cart.id,
    tableId: cart.tableId,
    type: cart.type,
    status: 'sent',
    items: cart.items.map(mapLine),
    payment: emptyPayment(),
    customer: cart.customer,
    fiscalDoc: invoiceUrl
      ? {
          id: headid,
          type: 'viva',
          receiptNumber: String(first.orderaa ?? first.ordaa ?? headid ?? ''),
          issuedAt: new Date().toISOString(),
          subtotal: cart.items.reduce((sum, item) => sum + item.lineTotal, 0),
          taxAmount: 0,
          total: cart.items.reduce((sum, item) => sum + item.lineTotal, 0),
          aadeTransactionId: String(first.aadeTransactionId ?? ''),
          invoiceUrl,
        }
      : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
