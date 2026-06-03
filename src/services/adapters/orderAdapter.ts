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
  const autoReceiptForPayment = paymentMethod === 'card' ? 0 : ctx.auto_receipt;
  const hasTidNsp = String(ctx.tid_nsp ?? '').trim() !== '';
  const cardSignatureMode = paymentMethod === 'card' && hasTidNsp;
  let idx = 0;
  return cart.items.map(item => {
    idx += 1;
    const ISODate = new Date().toISOString();
    const clientUNID = `${ISODate}-${idx}-${ctx.slogtok}-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const mods = item.selectedOptions.map(o => ({
      idoption_value: o.valueId,
      idoption: o.groupId,
      acost: o.priceDelta,
      descr_value: o.label,
      descr_option: o.groupLabel ?? '',
      forgrouping: o.forGrouping ?? '',
      flat_price: o.flatPrice ?? '',
      name: o.label,
      text: o.label,
    }));
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
      // smods duplicates modifier labels as text; keep it disabled unless the backend requires it.
      // smods: item.selectedOptions.map(o => o.label).join(', '),
      // smods_real: item.selectedOptions.map(o => o.label).join(', '),
      // comments duplicates modifier labels as text; keep it disabled unless the backend requires it.
      // comments: item.selectedOptions.map(o => o.label).join(', '),
      mods,
      // modifiers duplicates `mods` as a simplified array; keep it disabled unless the backend requires it.
      // modifiers: mods.map(mod => ({name: mod.name, text: mod.text})),
      ISODate,
      aver: 1,
      isupd: 0,
      isiris: paymentMethod === 'iris' ? 1 : 0,
      iscredit: paymentMethod === 'card' ? 1 : 0,
      isprepaid: cardSignatureMode ? 0 : item.quantity,
      auto_receipt: autoReceiptForPayment,
      ispaid: 0,
      isgift: 0,
      iscancelled: 0,
      iscompleted: 0,
      precash_val: cashAmount > 0 ? Number(((cashAmount / Math.max(totalAmount, 1)) * item.lineTotal).toFixed(2)) : 0,
      precard_val:
        cardSignatureMode
          ? 0
          : cardAmount > 0
            ? Number(((cardAmount / Math.max(totalAmount, 1)) * item.lineTotal).toFixed(2))
            : 0,
      prebank_val: bankAmount > 0 ? Number(((bankAmount / Math.max(totalAmount, 1)) * item.lineTotal).toFixed(2)) : 0,
      precash_val_tot: cashAmount,
      precard_val_tot: cardAmount,
      prebank_val_tot: bankAmount,
      tips: options?.tipAmount ?? 0,
      clientUNID,
      POSclientUNID,
      byME: 1,
      auto_receipt_switch: autoReceiptForPayment,
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

function firstResponseString(
  rows: Record<string, unknown>[],
  read: (row: Record<string, unknown>) => unknown,
): {value: string; rowIndex: number} {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const raw = read(rows[rowIndex]);
    if (raw == null) {
      continue;
    }
    const value = typeof raw === 'string' ? raw : String(raw);
    if (value.trim()) {
      return {value, rowIndex};
    }
  }
  return {value: '', rowIndex: -1};
}

function signatureDataFrom(row: Record<string, unknown>): string {
  if (typeof row.signature_data === 'string') {
    return row.signature_data;
  }
  if (row.signature_data && typeof row.signature_data === 'object') {
    return JSON.stringify(row.signature_data);
  }
  return '';
}

export function mapInsertOrdersResponse(raw: unknown, cart: Cart): Order {
  const arr = parseJsonArray(raw);
  const rows = arr.map(row => (row ?? {}) as Record<string, unknown>);
  const first = rows[0] ?? {};
  const headid = Number(first.headid ?? 0);
  const invoiceUrlResult = firstResponseString(
    rows,
    row => row.invoice_url ?? row.invoiceUrl,
  );
  const escposResult = firstResponseString(rows, row => row.escpos);
  const fiscalDataResult = firstResponseString(
    rows,
    row =>
      row.fiscal_data ??
      row.fiscalData ??
      row.fiscalisationData ??
      row.fiscalisationSigningDetails,
  );
  const signatureDataResult = firstResponseString(rows, signatureDataFrom);
  const receiptNumberResult = firstResponseString(
    rows,
    row => row.orderaa ?? row.ordaa ?? row.headid,
  );
  const aadeTransactionIdResult = firstResponseString(
    rows,
    row => row.aadeTransactionId ?? row.aade_transaction_id,
  );
  const invoiceUrl = invoiceUrlResult.value;
  const escpos = escposResult.value;
  const fiscalData = fiscalDataResult.value;
  const signatureData = signatureDataResult.value;
  const receiptNumber = receiptNumberResult.value || String(headid ?? '');
  const aadeTransactionId = aadeTransactionIdResult.value;
  const hasFiscalDoc = Boolean(
    invoiceUrl.trim() || escpos.trim() || fiscalData.trim() || signatureData.trim(),
  );
  if (__DEV__) {
    const signatureRow =
      signatureDataResult.rowIndex >= 0 ? rows[signatureDataResult.rowIndex] : first;
    const signatureObj =
      signatureRow.signature_data && typeof signatureRow.signature_data === 'object'
        ? (signatureRow.signature_data as Record<string, unknown>)
        : null;
    console.log(
      `[VivaFlow] mapInsertOrdersResponse rows=${rows.length} headid=${headid} invoiceUrlLen=${invoiceUrl.length} invoiceRow=${invoiceUrlResult.rowIndex} escposLen=${escpos.length} escposRow=${escposResult.rowIndex} fiscalDataLen=${fiscalData.length} fiscalRow=${fiscalDataResult.rowIndex} signatureDataLen=${signatureData.length} signatureRow=${signatureDataResult.rowIndex} hasSignatureObj=${String(
        Boolean(signatureObj),
      )}`,
    );
    if (signatureObj) {
      console.log(
        `[VivaFlow] mapInsertOrdersResponse signature keys=${Object.keys(signatureObj).join(',')}`,
      );
      console.log(
        `[VivaFlow] mapInsertOrdersResponse signature preview=${JSON.stringify(signatureObj).slice(
          0,
          500,
        )}`,
      );
    }
  }
  return {
    id: headid,
    orderNumber: receiptNumber || null,
    clientId: cart.id,
    tableId: cart.tableId,
    type: cart.type,
    status: 'sent',
    items: cart.items.map(mapLine),
    payment: emptyPayment(),
    customer: cart.customer,
    fiscalDoc: hasFiscalDoc
      ? {
          id: headid,
          type: 'viva',
          receiptNumber,
          issuedAt: new Date().toISOString(),
          subtotal: cart.items.reduce((sum, item) => sum + item.lineTotal, 0),
          taxAmount: 0,
          total: cart.items.reduce((sum, item) => sum + item.lineTotal, 0),
          aadeTransactionId,
          invoiceUrl,
          escpos: escpos || null,
          fiscalData: fiscalData || null,
          signatureData: signatureData || null,
        }
      : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
