import type {Cart, CartItem, SelectedOption} from '@models';
import type {AuthSession} from '@models/auth';

export type ReceiptLine =
  | {kind: 'text'; value: string; align?: 'left' | 'center' | 'right'; bold?: boolean; size?: 'normal' | 'large' | 'xlarge'}
  | {kind: 'rule'}
  | {kind: 'spacer'; count?: number};

export type ReceiptPreview = {
  title: string;
  subtitle?: string | null;
  metadata: Array<{label: string; value: string}>;
  items: Array<{
    name: string;
    quantity: number;
    lineTotal: string;
    options: string[];
  }>;
  totals: Array<{label: string; value: string; emphasized?: boolean}>;
  footer: string[];
};

export type FinalReceiptPayload = {
  preview: ReceiptPreview;
  escpos: Uint8Array;
  plainText: string;
};

export type ReceiptContext = {
  orderNumber?: number | null;
  createdAt?: Date;
  companyName?: string | null;
  branchName?: string | null;
  companyDescription?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  tableLabel?: string | null;
  serviceLabel?: string | null;
  serviceType?: 'dine-in' | 'takeaway';
  paymentMethod?: 'cash' | 'card';
  taxId?: string | null;
  taxOffice?: string | null;
};

const RECEIPT_WIDTH = 32;
const VAT_RATE = 0.13;

/** Bitmap line protocol parsed by `SunmiPrinterModule.renderTextBitmap`. */
type LineAlign = 'L' | 'C';
type LineSize = 'n' | 'l' | 'x';

function encodeLine(
  align: LineAlign,
  bold: boolean,
  size: LineSize,
  text: string,
  right?: string,
): string {
  const prefix = `${align}${bold ? 'B' : '.'}${size}`;
  return right ? `${prefix}${text}\t${right}` : `${prefix}${text}`;
}

function formatMoney(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')}€`;
}

function formatDateTime(date: Date): string {
  return `${date.toLocaleDateString('el-GR')} ${date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
}

/** Mock layout: `29/05/2026 – 14:07` */
function formatReceiptDateTime(date: Date): string {
  const day = date.toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} – ${time}`;
}

function padBoth(text: string, width: number): string {
  if (text.length >= width) return text;
  const total = width - text.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
}

function padLine(left: string, right: string, width: number): string {
  const trimmedRight = right.trim();
  if (left.length + trimmedRight.length + 1 >= width) {
    return left.slice(0, Math.max(0, width - trimmedRight.length - 1)) + ' ' + trimmedRight;
  }
  return left.padEnd(width - trimmedRight.length) + trimmedRight;
}

function ruleLine(): string {
  return '-'.repeat(RECEIPT_WIDTH);
}

function renderSelectedOptions(options: SelectedOption[]): string[] {
  return options
    .map(opt => opt.label.trim())
    .filter(Boolean)
    .map(label => `   ${label}`);
}

function buildPreview(
  session: AuthSession | null,
  cart: Cart,
  ctx: ReceiptContext,
): ReceiptPreview {
  const meta: Array<{label: string; value: string}> = [];
  meta.push({label: 'Ημερομηνία', value: formatDateTime(ctx.createdAt ?? new Date())});
  if (ctx.orderNumber != null) meta.push({label: 'Παραγγελία', value: String(ctx.orderNumber)});
  if (ctx.serviceLabel) meta.push({label: 'Τύπος', value: ctx.serviceLabel});
  if (ctx.tableLabel) meta.push({label: 'Τραπέζι', value: ctx.tableLabel});
  if (ctx.branchName) meta.push({label: 'Κατάστημα', value: ctx.branchName});
  if (ctx.taxId) meta.push({label: 'ΑΦΜ', value: ctx.taxId});
  if (ctx.taxOffice) meta.push({label: 'ΔΟΥ', value: ctx.taxOffice});
  if (session?.email) meta.push({label: 'Χρήστης', value: session.email});

  const items = cart.items.map((item: CartItem) => ({
    name: item.productName,
    quantity: item.quantity,
    lineTotal: formatMoney(item.lineTotal),
    options: renderSelectedOptions(item.selectedOptions),
  }));

  const subtotal = cart.items.reduce((s, i) => s + i.lineTotal, 0);
  const vatAmount = subtotal - subtotal / (1 + VAT_RATE);

  const totals =
    ctx.paymentMethod === 'cash'
      ? [
          {label: 'ΦΠΑ 13%', value: formatMoney(vatAmount)},
          {label: 'Σύνολο', value: formatMoney(subtotal), emphasized: true},
        ]
      : [{label: 'Σύνολο', value: formatMoney(subtotal), emphasized: true}];

  return {
    title: ctx.companyName ?? 'Garsonista',
    subtitle: null,
    metadata: meta,
    items,
    totals,
    footer: ctx.paymentMethod === 'cash' ? [] : ['ΣΑΣ ΕΥΧΑΡΙΣΤΟΥΜΕ!'],
  };
}

function diningReceiptLabel(serviceType: 'dine-in' | 'takeaway'): string {
  return serviceType === 'dine-in' ? 'DINE IN' : 'TAKEAWAY';
}

/** Cash Sunmi slip — matches kiosk mock (header, order #, items, VAT breakdown). */
function buildCashPlainText(preview: ReceiptPreview, ctx: ReceiptContext): string {
  const lines: string[] = [];
  const legalName = ctx.companyName?.trim();
  const tradeName = ctx.companyDescription?.trim();
  const displayName = (
    legalName ??
    tradeName ??
    ctx.branchName ??
    preview.title
  ).toUpperCase();
  const taxId = (
    ctx.taxId ?? preview.metadata.find(m => m.label === 'ΑΦΜ')?.value ?? ''
  ).trim();
  const taxOffice = (
    ctx.taxOffice ?? preview.metadata.find(m => m.label === 'ΔΟΥ')?.value ?? ''
  ).trim();
  const orderNumber = preview.metadata.find(m => m.label === 'Παραγγελία')?.value ?? '';
  const date = formatReceiptDateTime(ctx.createdAt ?? new Date());

  lines.push(encodeLine('C', false, 'n', 'Απόδειξη μετρητών (πελάτης)'));
  lines.push(encodeLine('C', false, 'n', displayName));
  if (
    tradeName &&
    tradeName.toUpperCase() !== displayName &&
    tradeName.toUpperCase() !== (legalName ?? '').toUpperCase()
  ) {
    lines.push(encodeLine('C', false, 'n', tradeName));
  }
  const address = ctx.address?.trim() ?? '';
  const cityLine = [ctx.city?.trim(), ctx.postalCode?.trim()].filter(Boolean).join(' ');
  const taxCompact =
    taxId.length > 0 && taxOffice.length > 0
      ? `${taxId} ${taxOffice}`.replace(/\s+/g, ' ').trim()
      : '';
  const isTaxPlaceholder = (line: string) =>
    taxCompact.length > 0 &&
    (line.replace(/\s+/g, ' ').trim() === taxCompact ||
      (taxOffice.length > 0 && line.includes(taxOffice)));
  const showAddress =
    address.length > 0 && !isTaxPlaceholder(address) && address !== cityLine;
  if (showAddress) {
    lines.push(encodeLine('C', false, 'n', address));
  }
  if (cityLine && cityLine !== address && !isTaxPlaceholder(cityLine)) {
    lines.push(encodeLine('C', false, 'n', cityLine));
  }
  if (taxId.length > 0 || taxOffice.length > 0) {
    const taxLine =
      taxId.length > 0 && taxOffice.length > 0
        ? `ΑΦΜ: ${taxId} -  ΔΟΥ: ${taxOffice}`
        : taxId.length > 0
          ? `ΑΦΜ: ${taxId}`
          : `ΔΟΥ: ${taxOffice}`;
    lines.push(encodeLine('C', false, 'n', taxLine));
  }

  lines.push(encodeLine('C', false, 'n', ruleLine()));

  if (orderNumber) {
    lines.push(encodeLine('C', true, 'x', `ΠΑΡΑΓΓΕΛΙΑ #${orderNumber}`));
  }
  if (ctx.serviceType) {
    lines.push(encodeLine('C', true, 'l', diningReceiptLabel(ctx.serviceType)));
  }
  lines.push(encodeLine('C', false, 'n', date));

  lines.push(encodeLine('C', false, 'n', ruleLine()));

  for (const item of preview.items) {
    const qtyLine = `${item.quantity}x ${item.name}`;
    lines.push(encodeLine('L', false, 'n', qtyLine, item.lineTotal));
    for (const opt of item.options) {
      lines.push(encodeLine('L', false, 'n', opt));
    }
  }

  lines.push(encodeLine('C', false, 'n', ruleLine()));

  for (let i = 0; i < preview.totals.length; i++) {
    const total = preview.totals[i];
    if (total.emphasized === true && i > 0) {
      lines.push('');
    }
    const bold = total.emphasized === true;
    const size: LineSize = bold ? 'x' : 'n';
    lines.push(encodeLine('L', bold, size, total.label, total.value));
  }

  lines.push('');
  lines.push(encodeLine('C', true, 'x', 'ΠΛΗΡΩΣΤΕ ΣΤΟ ΤΑΜΕΙΟ'));
  lines.push(encodeLine('C', true, 'x', 'ΜΕ ΜΕΤΡΗΤΑ'));
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

function pushLine(lines: string[], value: string) {
  lines.push(value);
}

/** Legacy cash order slip (`generateCashOrderSlip` in garsonista-kiosk). */
function buildLegacyPlainText(preview: ReceiptPreview): string {
  const lines: string[] = [];
  const company = preview.title || 'Garsonista';
  pushLine(lines, padBoth(company, RECEIPT_WIDTH));

  const branch = preview.metadata.find(m => m.label === 'Κατάστημα')?.value ?? '';
  if (branch) pushLine(lines, padBoth(branch, RECEIPT_WIDTH));

  pushLine(lines, padBoth('ΠΑΡΑΓΓΕΛΙΑ', RECEIPT_WIDTH));
  pushLine(lines, padBoth('ΠΑΡΑΚΑΛΩ ΠΛΗΡΩΣΤΕ ΣΤΟ ΤΑΜΕΙΟ', RECEIPT_WIDTH));

  const service = preview.metadata.find(m => m.label === 'Τύπος')?.value ?? '';
  if (service) pushLine(lines, padBoth(service.toUpperCase(), RECEIPT_WIDTH));

  pushLine(lines, ruleLine());

  const orderNumber = preview.metadata.find(m => m.label === 'Παραγγελία')?.value ?? '';
  if (orderNumber) {
    pushLine(lines, '');
    pushLine(lines, padBoth(orderNumber, RECEIPT_WIDTH));
    pushLine(lines, '');
  }

  pushLine(lines, ruleLine());

  const date = preview.metadata.find(m => m.label === 'Ημερομηνία')?.value ?? '';
  if (date) pushLine(lines, padBoth(date, RECEIPT_WIDTH));
  pushLine(lines, '');

  for (const item of preview.items) {
    const qtyLine = `${item.quantity} x ${item.name}`;
    const wrapped = qtyLine.length > RECEIPT_WIDTH ? qtyLine.slice(0, RECEIPT_WIDTH) : qtyLine;
    pushLine(lines, padLine(wrapped, item.lineTotal, RECEIPT_WIDTH));
    for (const opt of item.options) {
      pushLine(lines, opt);
    }
    pushLine(lines, '');
  }

  const total = preview.totals[preview.totals.length - 1];
  if (total) {
    pushLine(lines, padBoth(`${total.label}: ${total.value}`, RECEIPT_WIDTH));
  }
  pushLine(lines, '');
  for (const footerLine of preview.footer) {
    pushLine(lines, padBoth(footerLine, RECEIPT_WIDTH));
  }
  pushLine(lines, '');
  pushLine(lines, '');
  return lines.join('\n');
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function buildEscPos(preview: ReceiptPreview, plainText: string): Uint8Array {
  const escInit = new Uint8Array([0x1b, 0x40]);
  const center = new Uint8Array([0x1b, 0x61, 0x01]);
  const left = new Uint8Array([0x1b, 0x61, 0x00]);
  const boldOn = new Uint8Array([0x1b, 0x45, 0x01]);
  const boldOff = new Uint8Array([0x1b, 0x45, 0x00]);
  const cut = new Uint8Array([0x1d, 0x56, 0x00]);

  const body: number[] = [];
  const add = (bytes: Uint8Array) => body.push(...bytes);
  const addText = (value: string) => add(encodeUtf8(`${value}\n`));

  add(escInit);
  add(center);
  add(boldOn);
  addText(preview.title || 'Garsonista');
  add(boldOff);

  const branch = preview.metadata.find(m => m.label === 'Κατάστημα')?.value ?? '';
  if (branch) addText(branch);

  add(boldOn);
  addText('ΠΑΡΑΓΓΕΛΙΑ');
  add(boldOff);
  addText('ΠΑΡΑΚΑΛΩ ΠΛΗΡΩΣΤΕ ΣΤΟ ΤΑΜΕΙΟ');

  const service = preview.metadata.find(m => m.label === 'Τύπος')?.value ?? '';
  if (service) {
    add(boldOn);
    addText(service.toUpperCase());
    add(boldOff);
  }

  addText(ruleLine());
  const orderNumber = preview.metadata.find(m => m.label === 'Παραγγελία')?.value ?? '';
  if (orderNumber) {
    addText('');
    add(boldOn);
    addText(orderNumber);
    add(boldOff);
    addText('');
  }
  addText(ruleLine());

  const date = preview.metadata.find(m => m.label === 'Ημερομηνία')?.value ?? '';
  if (date) addText(date);
  addText('');

  add(left);
  for (const item of preview.items) {
    const qtyLine = `${item.quantity} x ${item.name}`;
    addText(padLine(qtyLine.slice(0, RECEIPT_WIDTH), item.lineTotal, RECEIPT_WIDTH));
    for (const opt of item.options) {
      addText(opt);
    }
    addText('');
  }

  add(center);
  for (const total of preview.totals) {
    if (total.emphasized) add(boldOn);
    addText(`${total.label}: ${total.value}`);
    if (total.emphasized) add(boldOff);
  }
  addText('');
  for (const footerLine of preview.footer) {
    add(boldOn);
    addText(footerLine);
    add(boldOff);
  }
  addText('');
  addText('');
  add(cut);

  const out = new Uint8Array(body.length);
  out.set(body, 0);
  void plainText;
  return out;
}

export function buildFinalReceipt(
  session: AuthSession | null,
  cart: Cart,
  ctx: ReceiptContext = {},
): FinalReceiptPayload {
  const preview = buildPreview(session, cart, ctx);
  const plainText =
    ctx.paymentMethod === 'cash'
      ? buildCashPlainText(preview, ctx)
      : buildLegacyPlainText(preview);
  const escpos = buildEscPos(preview, plainText);
  return {preview, plainText, escpos};
}
