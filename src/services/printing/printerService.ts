import {Linking, NativeModules, Platform} from 'react-native';
import type {Cart} from '@models';
import type {AuthSession} from '@models/auth';
import {buildFinalReceipt, type ReceiptContext} from './receiptBuilder';
import {resolveBestVivaQrCodeUrl} from '@utils/fiscalisationFromInvoice';

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
): Promise<boolean> {
  if (typeof thermal.printRaw !== 'function') {
    return false;
  }

  const printers =
    typeof thermal.listPrinters === 'function'
      ? await Promise.resolve(thermal.listPrinters())
      : [];
  if (__DEV__) {
    console.log(`${LOG_TAG} DantSu USB printers`, printers);
  }

  const firstPrinter = printers.find(printer => typeof printer.deviceId === 'number');
  if (firstPrinter?.deviceId != null) {
    if (typeof thermal.requestUsbPermission === 'function') {
      const granted = await Promise.resolve(thermal.requestUsbPermission(firstPrinter.deviceId));
      if (__DEV__) {
        console.log(`${LOG_TAG} DantSu USB permission deviceId=${firstPrinter.deviceId} granted=${granted}`);
      }
      if (!granted) {
        throw new Error(`USB printer permission denied for deviceId=${firstPrinter.deviceId}`);
      }
    }

    if (typeof thermal.printRawToDevice === 'function') {
      await Promise.resolve(thermal.printRawToDevice(bytes, firstPrinter.deviceId));
      return true;
    }
  }

  const ready =
    typeof thermal.isReady === 'function'
      ? await Promise.resolve(thermal.isReady())
      : true;
  if (__DEV__) {
    console.log(`${LOG_TAG} DantSu USB ready=${ready}`);
  }
  if (!ready) {
    return false;
  }

  await Promise.resolve(thermal.printRaw(bytes));
  return true;
}

export async function printFinalReceipt(
  session: AuthSession | null,
  cart: Cart,
  ctx: ReceiptContext = {},
): Promise<{preview: ReturnType<typeof buildFinalReceipt>['preview']}> {
  const receipt = buildFinalReceipt(session, cart, ctx);
  logReceiptPayload(ctx, receipt.plainText, receipt.preview);
  const thermal = getDantsuThermalPrinter();
  const sunmi = getSunmiPrinter();
  const receiptBodyText = receipt.plainText;
  const receiptPostQrText = receipt.postQrText ?? '';

  if (Platform.OS === 'android' && thermal && typeof thermal.printRaw === 'function') {
    try {
      const bytes = Array.from(receipt.escpos);
      if (await printWithDantsuThermal(thermal, bytes)) {
        return {preview: receipt.preview};
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`${LOG_TAG} DantSu thermal print failed, falling back`, error);
      }
    }
  }

  if (Platform.OS === 'android' && sunmi) {
    if (__DEV__) {
      console.log(`${LOG_TAG} DantSu USB not available; trying Sunmi fallback`);
    }
    if (typeof sunmi.printBitmapText === 'function') {
      await Promise.resolve(sunmi.printBitmapText(receiptBodyText));
    } else if (typeof sunmi.printText === 'function') {
      await Promise.resolve(sunmi.printText(receiptBodyText));
    } else if (typeof sunmi.printRaw === 'function') {
      const bytes = Array.from(receipt.escpos);
      await Promise.resolve(sunmi.printRaw(bytes));
    }

    const qrUrl = resolveBestVivaQrCodeUrl(ctx.vivaReceiptDetails);
    if (qrUrl && typeof sunmi.printQRCode === 'function') {
      if (typeof sunmi.setAlignment === 'function') {
        try {
          await Promise.resolve(sunmi.setAlignment(1));
        } catch {
          /* continue */
        }
      }
      await Promise.resolve(sunmi.printQRCode(qrUrl, 4, 3));
      if (typeof sunmi.lineWrap === 'function') {
        try {
          await Promise.resolve(sunmi.lineWrap(1));
        } catch {
          /* continue */
        }
      }
      if (typeof sunmi.setAlignment === 'function') {
        try {
          await Promise.resolve(sunmi.setAlignment(0));
        } catch {
          /* continue */
        }
      }
    }
    if (receiptPostQrText.trim()) {
      if (typeof sunmi.printBitmapText === 'function') {
        await Promise.resolve(sunmi.printBitmapText(receiptPostQrText));
      } else if (typeof sunmi.printText === 'function') {
        await Promise.resolve(sunmi.printText(receiptPostQrText));
      } else if (typeof sunmi.printRaw === 'function') {
        const bytes = Array.from(new TextEncoder().encode(receiptPostQrText));
        await Promise.resolve(sunmi.printRaw(bytes));
      }
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
  if (__DEV__) {
    console.warn(`${LOG_TAG} no native printer bridge printed the receipt`);
  }
  void `${receiptBodyText}${receiptPostQrText}`;
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
