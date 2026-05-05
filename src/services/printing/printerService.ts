import {Linking, NativeModules, Platform} from 'react-native';
import {buildSimpleOrderReceiptEscPos} from './receiptBuilder';

export type PrinterKind = 'thermal-bluetooth' | 'thermal-usb' | 'tcp' | 'pdf';
type ThermalPrintingModule = {
  printTextToThermal: (text: string) => Promise<void>;
};

const thermalPrinting = NativeModules.ThermalPrinting as
  | ThermalPrintingModule
  | undefined;

/**
 * Phase 6: bridge to native thermal module (legacy plugin port).
 * Until then, `printOrderSlip` logs ESC/POS length and can open PDF flow.
 */
export async function printOrderSlip(lines: string[]): Promise<void> {
  const text = lines.join('\n');
  void buildSimpleOrderReceiptEscPos(lines);

  if (Platform.OS === 'android' && thermalPrinting?.printTextToThermal) {
    console.log('[ThermalPrinting] Calling native printTextToThermal');
    await thermalPrinting.printTextToThermal(text);
    console.log('[ThermalPrinting] Native printTextToThermal resolved');
    return;
  }

  console.warn('[ThermalPrinting] Native module unavailable on this platform');
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
