import {Linking, Platform} from 'react-native';
import {buildSimpleOrderReceiptEscPos} from './receiptBuilder';

export type PrinterKind = 'thermal-bluetooth' | 'thermal-usb' | 'tcp' | 'pdf';

/**
 * Phase 6: bridge to native thermal module (legacy plugin port).
 * Until then, `printOrderSlip` logs ESC/POS length and can open PDF flow.
 */
export async function printOrderSlip(lines: string[]): Promise<void> {
  void buildSimpleOrderReceiptEscPos(lines);
  if (Platform.OS === 'android') {
    // Native module hook: ThermalPrinter.printRaw(bytes)
  }
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
