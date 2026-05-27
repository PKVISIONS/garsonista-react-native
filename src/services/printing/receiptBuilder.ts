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

type ReceiptContext = {
  orderNumber?: number | null;
  createdAt?: Date;
  companyName?: string | null;
  branchName?: string | null;
  tableLabel?: string | null;
  serviceLabel?: string | null;
};

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

function padBoth(text: string, width: number): string {
  if (text.length >= width) return text;
  const total = width - text.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
}

function wrapText(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function renderSelectedOptions(options: SelectedOption[]): string[] {
  return options.map(opt => `${opt.label}${opt.priceDelta ? ` (+${formatMoney(opt.priceDelta)})` : ''}`);
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
  if (session?.email) meta.push({label: 'Χρήστης', value: session.email});

  const items = cart.items.map((item: CartItem) => ({
    name: item.productName,
    quantity: item.quantity,
    lineTotal: formatMoney(item.lineTotal),
    options: renderSelectedOptions(item.selectedOptions),
  }));

  const subtotal = cart.items.reduce((s, i) => s + i.lineTotal, 0);
  const discount = 0;
  const total = subtotal - discount;

  return {
    title: ctx.companyName ?? 'Garsonista',
    subtitle: null,
    metadata: meta,
    items,
    totals: [
      {label: 'Σύνολο', value: formatMoney(total), emphasized: true},
    ],
    footer: ['ΣΑΣ ΕΥΧΑΡΙΣΤΟΥΜΕ!'],
  };
}

function pushLine(lines: string[], value: string) {
  lines.push(value);
}

function buildPlainText(preview: ReceiptPreview): string {
  const lines: string[] = [];
  const header = preview.title || 'Garsonista';
  const companyLine = padBoth(header, 32);
  pushLine(lines, companyLine);
  const branch = preview.metadata.find(m => m.label === 'Κατάστημα')?.value ?? '';
  if (branch) pushLine(lines, padBoth(branch, 32));
  const table = preview.metadata.find(m => m.label === 'Τύπος')?.value ?? '';
  if (table) pushLine(lines, padBoth(table.toUpperCase(), 32));
  pushLine(lines, padBoth('ΠΑΡΑΚΑΛΩ ΠΛΗΡΩΣΤΕ ΣΤΟ ΤΑΜΕΙΟ', 32));
  pushLine(lines, padBoth('ΠΑΡΑΓΓΕΛΙΑ', 32));
  pushLine(lines, '--------------------------------');
  const orderNumber = preview.metadata.find(m => m.label === 'Παραγγελία')?.value ?? '';
  if (orderNumber) {
    pushLine(lines, padBoth(orderNumber, 32));
    pushLine(lines, '--------------------------------');
  }
  const date = preview.metadata.find(m => m.label === 'Ημερομηνία')?.value ?? '';
  if (date) pushLine(lines, padBoth(date, 32));
  pushLine(lines, '');
  for (const item of preview.items) {
    const name = `${item.quantity} x ${item.name}`;
    pushLine(lines, name.length > 32 ? name.slice(0, 32) : name);
    pushLine(lines, padBoth(item.lineTotal, 32));
    for (const opt of item.options) {
      pushLine(lines, `  ${opt}`);
    }
    pushLine(lines, '');
  }
  for (const total of preview.totals) {
    pushLine(lines, padBoth(`${total.label}: ${total.value}`, 32));
  }
  pushLine(lines, '--------------------------------');
  for (const footerLine of preview.footer) {
    pushLine(lines, padBoth(footerLine, 32));
  }
  pushLine(lines, '');
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
  addText(preview.title);
  add(boldOff);
  addText('');
  const branch = preview.metadata.find(m => m.label === 'Κατάστημα')?.value ?? '';
  if (branch) addText(branch);
  const tableType = preview.metadata.find(m => m.label === 'Τύπος')?.value ?? '';
  if (tableType) {
    add(boldOn);
    addText(tableType.toUpperCase());
    add(boldOff);
  }
  addText('ΠΑΡΑΚΑΛΩ ΠΛΗΡΩΣΤΕ ΣΤΟ ΤΑΜΕΙΟ');
  add(boldOn);
  addText('ΠΑΡΑΓΓΕΛΙΑ');
  add(boldOff);
  addText('--------------------------------');
  const orderNumber = preview.metadata.find(m => m.label === 'Παραγγελία')?.value ?? '';
  if (orderNumber) {
    add(boldOn);
    addText(orderNumber);
    add(boldOff);
  }
  addText('--------------------------------');
  const date = preview.metadata.find(m => m.label === 'Ημερομηνία')?.value ?? '';
  if (date) addText(date);
  add(left);
  addText('--------------------------------');
  for (const item of preview.items) {
    addText(`${item.quantity} x ${item.name}`);
    addText(item.lineTotal);
    for (const opt of item.options) {
      addText(`  ${opt}`);
    }
    addText('');
  }
  for (const total of preview.totals) {
    if (total.emphasized) add(boldOn);
    addText(`${total.label}: ${total.value}`);
    if (total.emphasized) add(boldOff);
  }
  addText('--------------------------------');
  add(center);
  for (const footerLine of preview.footer) {
    addText(footerLine);
  }
  addText('');
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
  const plainText = buildPlainText(preview);
  const escpos = buildEscPos(preview, plainText);
  return {preview, plainText, escpos};
}
