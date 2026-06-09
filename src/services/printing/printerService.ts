import {Linking, NativeModules, Platform} from 'react-native';
import type {Cart} from '@models';
import type {AuthSession} from '@models/auth';
import {STORAGE_KEYS} from '@constants/config';
import {buildFinalReceipt, type ReceiptContext} from './receiptBuilder';
import {resolveBestVivaQrCodeUrl} from '@utils/fiscalisationFromInvoice';
import {mmkv} from '../../storage/mmkv';

export type PrinterKind = 'sunmi' | 'thermal-bluetooth' | 'thermal-usb' | 'tcp' | 'pdf';
export type PreferredPrinterKind = 'sunmi' | 'dantsu';

export type {ReceiptContext};

const LOG_TAG = '[ReceiptPrint]';
const DEFAULT_PREFERRED_PRINTER: PreferredPrinterKind = 'dantsu';

export function getPreferredPrinterKind(): PreferredPrinterKind {
  const value = mmkv.getString(STORAGE_KEYS.preferredPrinter);
  return value === 'sunmi' || value === 'dantsu'
    ? value
    : DEFAULT_PREFERRED_PRINTER;
}

export function setPreferredPrinterKind(kind: PreferredPrinterKind): void {
  mmkv.set(STORAGE_KEYS.preferredPrinter, kind);
}

function formatPrintError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function emitPrintLog(ctx: ReceiptContext | undefined, message: string): void {
  console.log(`${LOG_TAG} ${message}`);
  ctx?.onPrintLog?.(message);
}

/** Strip Sunmi line protocol (`C..n`, `L.Bx`, etc.) for readable logs. */
function decodeReceiptLineForLog(line: string): string {
  if (line.length >= 4) {
    const align = line[0];
    const bold = line[1];
    const size = line[2];
    if (
      (align === 'C' || align === 'L') &&
      (bold === 'B' || bold === '.') &&
      (size === 'n' || size === 'l' || size === 'x')
    ) {
      return line.slice(3).replace('\t', '  →  ');
    }
  }
  return line;
}

function logReceiptPayload(
  ctx: ReceiptContext,
  plainText: string,
  preview: ReturnType<typeof buildFinalReceipt>['preview'],
): void {
  const decoded = plainText
    .split('\n')
    .map(decodeReceiptLineForLog)
    .join('\n');
  console.log(`${LOG_TAG} ========== RECEIPT ==========`);
  console.log(
    `${LOG_TAG} order=${ctx.orderNumber ?? '—'} payment=${ctx.paymentMethod ?? '—'} service=${ctx.serviceType ?? ctx.serviceLabel ?? '—'} items=${preview.items.length}`,
  );
  console.log(
    `${LOG_TAG} company display=${ctx.companyDescription ?? '—'} legal=${ctx.companyName ?? '—'} afm=${ctx.taxId ?? '—'} doy=${ctx.taxOffice ?? '—'}`,
  );
  console.log(`${LOG_TAG} --- receipt body ---\n${decoded}`);
  console.log(`${LOG_TAG} --- raw payload (${plainText.length} chars) ---\n${plainText}`);
  console.log(`${LOG_TAG} =============================`);
}

function getSunmiPrinter(): {
  printRaw?: (bytes: number[]) => Promise<void> | void;
  printText?: (text: string) => Promise<void> | void;
  printBitmapText?: (text: string) => Promise<void> | void;
  printQRCode?: (data: string, moduleSize: number, errorLevel: number) => Promise<void> | void;
  setAlignment?: (alignment: number) => Promise<void> | void;
  lineWrap?: (count: number) => Promise<void> | void;
  cutPaper?: () => Promise<void> | void;
} | null {
  const mod = NativeModules.SunmiPrinter ?? null;
  return mod ?? null;
}

function getDantsuThermalPrinter(): {
  listPrinters?: () => Promise<Array<{deviceId?: number; productName?: string; manufacturerName?: string; vendorId?: number; productId?: number}>> | Array<{deviceId?: number; productName?: string; manufacturerName?: string; vendorId?: number; productId?: number}>;
  printRaw?: (bytes: number[]) => Promise<void> | void;
  printRawToDevice?: (bytes: number[], deviceId: number) => Promise<void> | void;
  isReady?: () => Promise<boolean> | boolean;
  requestUsbPermission?: (deviceId: number) => Promise<boolean> | boolean;
} | null {
  const mod = NativeModules.ThermalPrinter ?? null;
  return mod ?? null;
}

async function printWithDantsuThermal(
  thermal: NonNullable<ReturnType<typeof getDantsuThermalPrinter>>,
  bytes: number[],
  ctx: ReceiptContext,
): Promise<boolean> {
  if (typeof thermal.printRaw !== 'function') {
    emitPrintLog(ctx, 'DantSu USB: printRaw is not available');
    return false;
  }

  emitPrintLog(ctx, 'DantSu USB: listing printers');
  const printers =
    typeof thermal.listPrinters === 'function'
      ? await Promise.resolve(thermal.listPrinters())
      : [];
  emitPrintLog(ctx, `DantSu USB: found ${printers.length} USB device(s)`);

  const firstPrinter = printers.find(printer => typeof printer.deviceId === 'number');
  if (firstPrinter?.deviceId != null) {
    if (typeof thermal.requestUsbPermission === 'function') {
      emitPrintLog(ctx, `DantSu USB: requesting permission for deviceId=${firstPrinter.deviceId}`);
      const granted = await Promise.resolve(thermal.requestUsbPermission(firstPrinter.deviceId));
      emitPrintLog(ctx, `DantSu USB: permission deviceId=${firstPrinter.deviceId} granted=${String(granted)}`);
      if (!granted) {
        throw new Error(`USB printer permission denied for deviceId=${firstPrinter.deviceId}`);
      }
    }

    if (typeof thermal.printRawToDevice === 'function') {
      emitPrintLog(ctx, `DantSu USB: sending ${bytes.length} raw byte(s) to deviceId=${firstPrinter.deviceId}`);
      await Promise.resolve(thermal.printRawToDevice(bytes, firstPrinter.deviceId));
      emitPrintLog(ctx, 'DantSu USB: printRawToDevice completed');
      return true;
    }
    emitPrintLog(ctx, 'DantSu USB: printRawToDevice is not available, trying default printRaw');
  }

  emitPrintLog(ctx, 'DantSu USB: checking default printer readiness');
  const ready =
    typeof thermal.isReady === 'function'
      ? await Promise.resolve(thermal.isReady())
      : true;
  emitPrintLog(ctx, `DantSu USB: ready=${String(ready)}`);
  if (!ready) {
    return false;
  }

  emitPrintLog(ctx, `DantSu USB: sending ${bytes.length} raw byte(s) with printRaw`);
  await Promise.resolve(thermal.printRaw(bytes));
  emitPrintLog(ctx, 'DantSu USB: printRaw completed');
  return true;
}

async function printWithSunmi(
  sunmi: NonNullable<ReturnType<typeof getSunmiPrinter>>,
  receipt: ReturnType<typeof buildFinalReceipt>,
  ctx: ReceiptContext,
): Promise<boolean> {
  const receiptBodyText = receipt.plainText;
  const receiptPostQrText = receipt.postQrText ?? '';
  let printedSomething = false;

  emitPrintLog(ctx, 'Sunmi: bridge found');
  if (typeof sunmi.printBitmapText === 'function') {
    emitPrintLog(ctx, `Sunmi: printing bitmap text chars=${receiptBodyText.length}`);
    await Promise.resolve(sunmi.printBitmapText(receiptBodyText));
    emitPrintLog(ctx, 'Sunmi: bitmap text completed');
    printedSomething = true;
  } else if (typeof sunmi.printText === 'function') {
    emitPrintLog(ctx, `Sunmi: printing text chars=${receiptBodyText.length}`);
    await Promise.resolve(sunmi.printText(receiptBodyText));
    emitPrintLog(ctx, 'Sunmi: text completed');
    printedSomething = true;
  } else if (typeof sunmi.printRaw === 'function') {
    const bytes = Array.from(receipt.escpos);
    emitPrintLog(ctx, `Sunmi: printing raw bytes=${bytes.length}`);
    await Promise.resolve(sunmi.printRaw(bytes));
    emitPrintLog(ctx, 'Sunmi: raw print completed');
    printedSomething = true;
  } else {
    emitPrintLog(ctx, 'Sunmi: no supported body print method found');
  }

  const qrUrl = resolveBestVivaQrCodeUrl(ctx.vivaReceiptDetails);
  if (qrUrl && typeof sunmi.printQRCode === 'function') {
    emitPrintLog(ctx, `Sunmi: QR detected len=${qrUrl.length}`);
    if (typeof sunmi.setAlignment === 'function') {
      try {
        emitPrintLog(ctx, 'Sunmi: setAlignment center for QR');
        await Promise.resolve(sunmi.setAlignment(1));
        emitPrintLog(ctx, 'Sunmi: setAlignment center completed');
      } catch (error) {
        emitPrintLog(ctx, `Sunmi: setAlignment center failed: ${formatPrintError(error)}`);
      }
    }
    emitPrintLog(ctx, 'Sunmi: printing QR');
    await Promise.resolve(sunmi.printQRCode(qrUrl, 4, 3));
    emitPrintLog(ctx, 'Sunmi: QR print completed');
    printedSomething = true;
    if (typeof sunmi.lineWrap === 'function') {
      try {
        emitPrintLog(ctx, 'Sunmi: lineWrap after QR');
        await Promise.resolve(sunmi.lineWrap(1));
        emitPrintLog(ctx, 'Sunmi: lineWrap after QR completed');
      } catch (error) {
        emitPrintLog(ctx, `Sunmi: lineWrap after QR failed: ${formatPrintError(error)}`);
      }
    }
    if (typeof sunmi.setAlignment === 'function') {
      try {
        emitPrintLog(ctx, 'Sunmi: reset alignment left');
        await Promise.resolve(sunmi.setAlignment(0));
        emitPrintLog(ctx, 'Sunmi: reset alignment completed');
      } catch (error) {
        emitPrintLog(ctx, `Sunmi: reset alignment failed: ${formatPrintError(error)}`);
      }
    }
  } else if (qrUrl) {
    emitPrintLog(ctx, 'Sunmi: QR detected but printQRCode is not available');
  } else {
    emitPrintLog(ctx, 'Sunmi: no QR for this receipt');
  }
  if (receiptPostQrText.trim()) {
    if (typeof sunmi.printBitmapText === 'function') {
      emitPrintLog(ctx, `Sunmi: printing post-QR bitmap text chars=${receiptPostQrText.length}`);
      await Promise.resolve(sunmi.printBitmapText(receiptPostQrText));
      emitPrintLog(ctx, 'Sunmi: post-QR bitmap text completed');
      printedSomething = true;
    } else if (typeof sunmi.printText === 'function') {
      emitPrintLog(ctx, `Sunmi: printing post-QR text chars=${receiptPostQrText.length}`);
      await Promise.resolve(sunmi.printText(receiptPostQrText));
      emitPrintLog(ctx, 'Sunmi: post-QR text completed');
      printedSomething = true;
    } else if (typeof sunmi.printRaw === 'function') {
      const bytes = Array.from(new TextEncoder().encode(receiptPostQrText));
      emitPrintLog(ctx, `Sunmi: printing post-QR raw bytes=${bytes.length}`);
      await Promise.resolve(sunmi.printRaw(bytes));
      emitPrintLog(ctx, 'Sunmi: post-QR raw print completed');
      printedSomething = true;
    } else {
      emitPrintLog(ctx, 'Sunmi: post-QR text exists but no supported print method found');
    }
  } else {
    emitPrintLog(ctx, 'Sunmi: no post-QR text');
  }
  if (typeof sunmi.cutPaper === 'function') {
    try {
      emitPrintLog(ctx, 'Sunmi: cutting paper');
      await Promise.resolve(sunmi.cutPaper());
      emitPrintLog(ctx, 'Sunmi: cutPaper completed');
    } catch (error) {
      emitPrintLog(ctx, `Sunmi: cutPaper failed: ${formatPrintError(error)}`);
    }
  } else {
    emitPrintLog(ctx, 'Sunmi: cutPaper is not available');
  }
  if (printedSomething) {
    emitPrintLog(ctx, 'Sunmi: print flow completed successfully');
  }
  return printedSomething;
}

async function tryDantsuReceipt(
  thermal: ReturnType<typeof getDantsuThermalPrinter>,
  receipt: ReturnType<typeof buildFinalReceipt>,
  ctx: ReceiptContext,
): Promise<boolean> {
  if (Platform.OS !== 'android' || !thermal || typeof thermal.printRaw !== 'function') {
    emitPrintLog(ctx, 'Printer route: DantSu USB bridge not available');
    return false;
  }
  try {
    const bytes = Array.from(receipt.escpos);
    emitPrintLog(ctx, 'Printer route: trying DantSu USB');
    if (await printWithDantsuThermal(thermal, bytes, ctx)) {
      emitPrintLog(ctx, 'Printer route: DantSu USB printed successfully');
      return true;
    }
    emitPrintLog(ctx, 'Printer route: DantSu USB did not print');
  } catch (error) {
    emitPrintLog(ctx, `Printer route: DantSu USB failed: ${formatPrintError(error)}`);
  }
  return false;
}

async function trySunmiReceipt(
  sunmi: ReturnType<typeof getSunmiPrinter>,
  receipt: ReturnType<typeof buildFinalReceipt>,
  ctx: ReceiptContext,
): Promise<boolean> {
  if (Platform.OS !== 'android' || !sunmi) {
    emitPrintLog(ctx, 'Printer route: Sunmi bridge not available');
    return false;
  }
  try {
    emitPrintLog(ctx, 'Printer route: trying Sunmi');
    if (await printWithSunmi(sunmi, receipt, ctx)) {
      emitPrintLog(ctx, 'Printer route: Sunmi printed successfully');
      return true;
    }
    emitPrintLog(ctx, 'Printer route: Sunmi did not print');
  } catch (error) {
    emitPrintLog(ctx, `Printer route: Sunmi failed: ${formatPrintError(error)}`);
  }
  return false;
}

export async function printFinalReceipt(
  session: AuthSession | null,
  cart: Cart,
  ctx: ReceiptContext = {},
): Promise<{preview: ReturnType<typeof buildFinalReceipt>['preview']}> {
  const receipt = buildFinalReceipt(session, cart, ctx);
  emitPrintLog(ctx, `Receipt: built payload chars=${receipt.plainText.length} escposBytes=${receipt.escpos.length}`);
  logReceiptPayload(ctx, receipt.plainText, receipt.preview);
  const thermal = getDantsuThermalPrinter();
  const sunmi = getSunmiPrinter();
  const preferredPrinter = getPreferredPrinterKind();
  emitPrintLog(ctx, `Printer route: preferred=${preferredPrinter}`);

  const firstPrinted = preferredPrinter === 'sunmi'
    ? await trySunmiReceipt(sunmi, receipt, ctx)
    : await tryDantsuReceipt(thermal, receipt, ctx);
  if (firstPrinted) {
    return {preview: receipt.preview};
  }

  const fallbackName = preferredPrinter === 'sunmi' ? 'DantSu USB' : 'Sunmi';
  emitPrintLog(ctx, `Printer route: falling back to ${fallbackName}`);
  const fallbackPrinted = preferredPrinter === 'sunmi'
    ? await tryDantsuReceipt(thermal, receipt, ctx)
    : await trySunmiReceipt(sunmi, receipt, ctx);
  if (fallbackPrinted) {
    return {preview: receipt.preview};
  }

  // Fallback for devices without the native bridge.
  // Keep the payload ready for Sunmi, and expose the preview for the UI.
  emitPrintLog(ctx, 'Printer route: no native printer bridge printed the receipt');
  void `${receipt.plainText}${receipt.postQrText ?? ''}`;
  return {preview: receipt.preview};
}

/**
 * Legacy helper kept for compatibility, but now produces the richer final receipt payload.
 */
export async function printOrderSlip(lines: string[]): Promise<void> {
  void lines;
}

export async function openPdfUrl(url: string): Promise<void> {
  const vivaUri =
    `garsonistaprinter://https://garsonista.datapp.gr/?ver=5&aprinter=1&isPDF=1&url=${encodeURIComponent(url)}`;
  const can = await Linking.canOpenURL(vivaUri);
  if (can) {
    await Linking.openURL(vivaUri);
    return;
  }
  await Linking.openURL(url);
}
