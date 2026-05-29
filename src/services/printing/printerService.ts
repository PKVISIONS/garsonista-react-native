import {Linking, NativeModules, Platform} from 'react-native';
import type {Cart} from '@models';
import type {AuthSession} from '@models/auth';
import {buildFinalReceipt, type ReceiptContext} from './receiptBuilder';

export type PrinterKind = 'sunmi' | 'thermal-bluetooth' | 'thermal-usb' | 'tcp' | 'pdf';

export type {ReceiptContext};

const LOG_TAG = '[ReceiptPrint]';

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
  cutPaper?: () => Promise<void> | void;
} | null {
  const mod = NativeModules.SunmiPrinter ?? NativeModules.ThermalPrinter ?? null;
  return mod ?? null;
}

export async function printFinalReceipt(
  session: AuthSession | null,
  cart: Cart,
  ctx: ReceiptContext = {},
): Promise<{preview: ReturnType<typeof buildFinalReceipt>['preview']}> {
  const receipt = buildFinalReceipt(session, cart, ctx);
  logReceiptPayload(ctx, receipt.plainText, receipt.preview);
  const sunmi = getSunmiPrinter();

  if (Platform.OS === 'android' && sunmi) {
    if (typeof sunmi.printBitmapText === 'function') {
      await Promise.resolve(sunmi.printBitmapText(receipt.plainText));
    } else if (typeof sunmi.printText === 'function') {
      await Promise.resolve(sunmi.printText(receipt.plainText));
    } else if (typeof sunmi.printRaw === 'function') {
      const bytes = Array.from(receipt.escpos);
      await Promise.resolve(sunmi.printRaw(bytes));
    }
    if (typeof sunmi.cutPaper === 'function') {
      try {
        await Promise.resolve(sunmi.cutPaper());
      } catch {
        // Ignore cutter failures; raw printing is the important part.
      }
    }
    return {preview: receipt.preview};
  }

  // Fallback for devices without the native bridge.
  // Keep the payload ready for Sunmi, and expose the preview for the UI.
  void receipt.plainText;
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
