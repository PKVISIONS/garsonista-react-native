import type {Cart, CartItem, SelectedOption} from '@models';
import type {AuthSession} from '@models/auth';
import {resolveBestVivaQrCodeUrl} from '@utils/fiscalisationFromInvoice';

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
  postQrText: string;
  useRawPrinter: boolean;
};

export type ReceiptContext = {
  onPrintLog?: (message: string) => void;
  orderNumber?: number | string | null;
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
  vivaReceiptDetails?: {
    invoiceUid?: string | null;
    invoiceMark?: string | null;
    authenticationCode?: string | null;
    fiskaltrustQr?: string | null;
    qrCodeUrl?: string | null;
    vivaQr?: string | null;
    transactionId?: string | null;
    cardType?: string | null;
    accountNumber?: string | null;
    fiscalisationSigningDetails?: string | null;
  };
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

function escPosQrCommand(data: string): Uint8Array {
  const payload = encodeUtf8(data);
  const size = payload.length + 3;
  const pL = size & 0xff;
  const pH = (size >> 8) & 0xff;
  const bytes: number[] = [];
  bytes.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
  bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
  bytes.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
  bytes.push(...payload);
  bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  return new Uint8Array(bytes);
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
    .map(opt => {
      const label = opt.label.trim();
      const quantity = Math.max(1, opt.quantity ?? 1);
      if (quantity <= 1 || new RegExp(`^${quantity}\\s*x\\s+`, 'i').test(label)) {
        return label;
      }
      return `${quantity} X ${label}`;
    })
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

  lines.push(
    encodeLine(
      'C',
      false,
      'n',
      ctx.paymentMethod === 'cash'
        ? 'Απόδειξη μετρητών (πελάτης)'
        : 'Απόδειξη πληρωμής (πελάτη)',
    ),
  );
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

  if (ctx.vivaReceiptDetails) {
    const viva = ctx.vivaReceiptDetails;
    const qrCode = resolveBestVivaQrCodeUrl(viva);
    const transactionId = viva.transactionId?.trim() ?? '';
    const cardType = viva.cardType?.trim() ?? '';
    const accountNumber = viva.accountNumber?.trim() ?? '';
    const hasFiscalBlock = Boolean(
      qrCode ||
        viva.invoiceUid ||
        viva.invoiceMark ||
        viva.authenticationCode,
    );
    if (hasFiscalBlock) {
      lines.push('');
    }
    if (viva.invoiceUid) {
      lines.push(encodeLine('L', false, 'n', `UID: ${viva.invoiceUid}`));
    }
    if (viva.invoiceMark) {
      lines.push(encodeLine('L', false, 'n', `ΜΑΡΚ: ${viva.invoiceMark}`));
    }
    if (viva.authenticationCode) {
      lines.push(encodeLine('L', false, 'n', `AUTH: ${viva.authenticationCode}`));
    }
    if (viva.qrCodeUrl && viva.qrCodeUrl !== qrCode) {
      lines.push(encodeLine('L', false, 'n', `QR URL: ${viva.qrCodeUrl}`));
    }
    if (viva.vivaQr && viva.vivaQr !== qrCode) {
      lines.push(encodeLine('L', false, 'n', `VIVA QR: ${viva.vivaQr}`));
    }
    if (transactionId || cardType || accountNumber) {
      lines.push(encodeLine('C', false, 'n', ruleLine()));
      lines.push(encodeLine('L', false, 'n', 'ΣΥΝΑΛΛΑΓΗ POS'));
      lines.push(encodeLine('L', false, 'n', 'ΜΕΣΩ ΠΛΗΡΩΜΩΝ: VIVA'));
      if (transactionId) {
        lines.push(encodeLine('L', false, 'n', `ΚΩΔ.ΣΥΝΑΛΛΑΓΗΣ: ${transactionId}`));
      }
      if (accountNumber) {
        lines.push(encodeLine('L', false, 'n', `ΑΡΙΘΜΟΣ ΚΑΡΤΑΣ: ${accountNumber}`));
      }
      if (cardType) {
        lines.push(encodeLine('L', false, 'n', `ΕΚΔΟΤΗΣ: ${cardType}`));
      }
    }
  }

  if (ctx.paymentMethod === 'cash') {
    lines.push('');
    lines.push(encodeLine('C', true, 'x', 'ΠΛΗΡΩΣΤΕ ΣΤΟ ΤΑΜΕΙΟ'));
    lines.push(encodeLine('C', true, 'x', 'ΜΕ ΜΕΤΡΗΤΑ'));
    lines.push('');
    lines.push('');
  }
  return lines.join('\n');
}

function buildCardPostQrText(): string {
  const lines: string[] = [];
  lines.push(encodeLine('C', true, 'x', 'ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ: ΚΑΡΤΑ'));
  lines.push(encodeLine('C', true, 'x', 'ΣΑΣ ΕΥΧΑΡΙΣΤΟΥΜΕ!'));
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

const WINDOWS_1253_BYTES: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  '‰': 0x89,
  '‹': 0x8b,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '™': 0x99,
  '›': 0x9b,
  ' ': 0xa0,
  '£': 0xa3,
  '§': 0xa7,
  '¨': 0xa8,
  '©': 0xa9,
  '«': 0xab,
  '¬': 0xac,
  '­': 0xad,
  '®': 0xae,
  '―': 0xaf,
  '°': 0xb0,
  '±': 0xb1,
  '²': 0xb2,
  '³': 0xb3,
  '΄': 0xb4,
  '΅': 0xb5,
  'Ά': 0xb6,
  '·': 0xb7,
  'Έ': 0xb8,
  'Ή': 0xb9,
  'Ί': 0xba,
  '»': 0xbb,
  'Ό': 0xbc,
  '½': 0xbd,
  'Ύ': 0xbe,
  'Ώ': 0xbf,
  'ΐ': 0xc0,
  'Α': 0xc1,
  'Β': 0xc2,
  'Γ': 0xc3,
  'Δ': 0xc4,
  'Ε': 0xc5,
  'Ζ': 0xc6,
  'Η': 0xc7,
  'Θ': 0xc8,
  'Ι': 0xc9,
  'Κ': 0xca,
  'Λ': 0xcb,
  'Μ': 0xcc,
  'Ν': 0xcd,
  'Ξ': 0xce,
  'Ο': 0xcf,
  'Π': 0xd0,
  'Ρ': 0xd1,
  'Σ': 0xd3,
  'Τ': 0xd4,
  'Υ': 0xd5,
  'Φ': 0xd6,
  'Χ': 0xd7,
  'Ψ': 0xd8,
  'Ω': 0xd9,
  'Ϊ': 0xda,
  'Ϋ': 0xdb,
  'ά': 0xdc,
  'έ': 0xdd,
  'ή': 0xde,
  'ί': 0xdf,
  'ΰ': 0xe0,
  'α': 0xe1,
  'β': 0xe2,
  'γ': 0xe3,
  'δ': 0xe4,
  'ε': 0xe5,
  'ζ': 0xe6,
  'η': 0xe7,
  'θ': 0xe8,
  'ι': 0xe9,
  'κ': 0xea,
  'λ': 0xeb,
  'μ': 0xec,
  'ν': 0xed,
  'ξ': 0xee,
  'ο': 0xef,
  'π': 0xf0,
  'ρ': 0xf1,
  'ς': 0xf2,
  'σ': 0xf3,
  'τ': 0xf4,
  'υ': 0xf5,
  'φ': 0xf6,
  'χ': 0xf7,
  'ψ': 0xf8,
  'ω': 0xf9,
  'ϊ': 0xfa,
  'ϋ': 0xfb,
  'ό': 0xfc,
  'ύ': 0xfd,
  'ώ': 0xfe,
};

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function encodeWindows1253(text: string): Uint8Array {
  const bytes = Array.from(text, char => {
    const code = char.charCodeAt(0);
    if (code <= 0x7f) return code;
    return WINDOWS_1253_BYTES[char] ?? '?'.charCodeAt(0);
  });
  return new Uint8Array(bytes);
}

function buildEscPos(
  preview: ReceiptPreview,
  plainText: string,
  ctx: ReceiptContext,
): Uint8Array {
  const escInit = new Uint8Array([0x1b, 0x40]);
  const greekCodePage = new Uint8Array([0x1b, 0x74, 47]);
  const center = new Uint8Array([0x1b, 0x61, 0x01]);
  const left = new Uint8Array([0x1b, 0x61, 0x00]);
  const boldOn = new Uint8Array([0x1b, 0x45, 0x01]);
  const boldOff = new Uint8Array([0x1b, 0x45, 0x00]);
  const cut = new Uint8Array([0x1d, 0x56, 0x00]);

  const body: number[] = [];
  const add = (bytes: Uint8Array) => body.push(...bytes);
  const addText = (value: string) => add(encodeWindows1253(`${value}\n`));

  add(escInit);
  add(greekCodePage);
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

  if (ctx.vivaReceiptDetails) {
    const viva = ctx.vivaReceiptDetails;
    const qrCode = resolveBestVivaQrCodeUrl(viva);
    if (qrCode) {
      add(center);
      add(escPosQrCommand(qrCode));
      add(left);
      addText('');
    }
    if (viva.qrCodeUrl && viva.qrCodeUrl !== qrCode) {
      add(center);
      add(escPosQrCommand(viva.qrCodeUrl));
      add(left);
      addText('');
    }
    if (viva.vivaQr && viva.vivaQr !== qrCode) {
      add(center);
      add(escPosQrCommand(viva.vivaQr));
      add(left);
      addText('');
    }
  }

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
  const plainText = buildCashPlainText(preview, ctx);
  const postQrText = ctx.paymentMethod === 'card' ? buildCardPostQrText() : '';
  const escpos = buildEscPos(preview, plainText, ctx);
  return {preview, plainText, postQrText, escpos, useRawPrinter: false};
}
