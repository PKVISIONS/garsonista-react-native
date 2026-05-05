import {Linking, NativeModules, PermissionsAndroid, Platform} from 'react-native';
import {buildSimpleOrderReceiptEscPos} from './receiptBuilder';

export type PrinterKind = 'thermal-bluetooth' | 'thermal-usb' | 'tcp' | 'pdf';
type ThermalPrintingModule = {
  printTextToThermal: (text: string) => Promise<void>;
};

const thermalPrinting = NativeModules.ThermalPrinting as
  | ThermalPrintingModule
  | undefined;

async function ensureAndroidBluetoothPermissions(): Promise<void> {
  // BLUETOOTH_* permissions are runtime permissions from Android 12 (API 31+).
  if (Platform.OS !== 'android' || Platform.Version < 31) {
    return;
  }

  const requiredPermissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  ];
  const missingPermissions: string[] = [];

  for (const permission of requiredPermissions) {
    const hasPermission = await PermissionsAndroid.check(permission);
    if (!hasPermission) {
      missingPermissions.push(permission);
    }
  }

  if (missingPermissions.length === 0) {
    return;
  }

  const result = await PermissionsAndroid.requestMultiple(missingPermissions);
  const denied = Object.entries(result).filter(
    ([, value]) => value !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied.length > 0) {
    throw new Error(
      'Bluetooth permissions are required to print. Please allow Nearby devices permissions.',
    );
  }
}

/**
 * Phase 6: bridge to native thermal module (legacy plugin port).
 * Until then, `printOrderSlip` logs ESC/POS length and can open PDF flow.
 */
export async function printOrderSlip(lines: string[]): Promise<void> {
  const text = lines.join('\n');
  void buildSimpleOrderReceiptEscPos(lines);

  if (Platform.OS !== 'android') {
    return;
  }

  if (thermalPrinting?.printTextToThermal) {
    await ensureAndroidBluetoothPermissions();
    console.log('[ThermalPrinting] Calling native printTextToThermal');
    await thermalPrinting.printTextToThermal(text);
    console.log('[ThermalPrinting] Native printTextToThermal resolved');
    return;
  }

  console.warn(
    '[ThermalPrinting] Android native module not found. Rebuild the Android app so ThermalPrintingPackage is bundled.',
  );
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
