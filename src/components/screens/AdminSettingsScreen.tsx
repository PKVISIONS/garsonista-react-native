import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  type ImageSourcePropType,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {APP_VERSION} from '@constants/config';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {
  useAuthStore,
  useCartStore,
  useFailedCardPaymentStore,
  useMenuPreloadStore,
  usePaymentStore,
} from '@store';
import {theme} from '@theme/kiosk';
import {KioskPressable as Pressable} from '../KioskPressable';
import {translate} from '../../stores/Localization/LocalizationStore';
import {
  getPreferredPrinterKind,
  printFinalReceipt,
  setPreferredPrinterKind,
  type PreferredPrinterKind,
} from '@services/printing/printerService';
import type {Cart} from '@models/cart';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.AdminSettings>;

type PrinterStatus = {
  sunmi: string;
  thermal: string;
};

type AdminActionVariant = 'secondary' | 'warning' | 'danger';
type AdminLogFilter = 'all' | 'print' | 'viva';

const cashIcon = require('../../assets/images/kiosk-payment-coins.png');
const cardIcon = require('../../assets/images/kiosk-payment-card.png');
const cartIcon = require('../../assets/images/cart-icon.png');
const MAX_PRINT_LOGS = 80;
const printerOptions: PreferredPrinterKind[] = ['sunmi', 'dantsu'];
const logFilters: Array<{key: AdminLogFilter; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'print', label: 'Print Logs'},
  {key: 'viva', label: 'Viva Logs'},
];

function truncateMiddle(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }
  const edge = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, edge)}...${value.slice(value.length - edge)}`;
}

function redactVivaDeepLink(value: string | null): string {
  if (!value) {
    return '';
  }
  return truncateMiddle(
    value
      .replace(/(ISV_clientSecret=)[^&]+/g, '$1***')
      .replace(/(aadeProviderSignature=)[^&]+/g, '$1***')
      .replace(/(aadeProviderSignatureData=)[^&]+/g, '$1***'),
  );
}

function cartTotal(cartValue: Cart | null): string {
  if (!cartValue) {
    return '';
  }
  return cartValue.items
    .reduce((sum, item) => sum + item.lineTotal, 0)
    .toFixed(2);
}

function displayValue(value: unknown): string {
  if (value == null || value === '') {
    return translate('kiosk.admin.dash');
  }
  return String(value);
}

function yesNo(value: boolean): string {
  return translate(value ? 'kiosk.admin.yes' : 'kiosk.admin.no');
}

export function AdminSettingsScreen({navigation}: Props): React.JSX.Element {
  const session = useAuthStore(s => s.session);
  const credentials = useAuthStore(s => s.credentials);
  const wireRow = useAuthStore(s => s.wireRow);
  const refreshLogin = useAuthStore(s => s.login);
  const logout = useAuthStore(s => s.logout);
  const cart = useCartStore(s => s.cart);
  const clearCart = useCartStore(s => s.clear);
  const vivaPhase = usePaymentStore(s => s.phase);
  const vivaLastError = usePaymentStore(s => s.lastError);
  const vivaLastDeepLink = usePaymentStore(s => s.lastDeepLink);
  const lastVivaRequest = usePaymentStore(s => s.lastVivaRequest);
  const lastVivaResponse = usePaymentStore(s => s.lastVivaResponse);
  const vivaPendingOrderNumber = usePaymentStore(s => s.pendingOrderNumber);
  const vivaPendingReceiptOrderNumber = usePaymentStore(s => s.pendingReceiptOrderNumber);
  const failedCardCart = useFailedCardPaymentStore(s => s.cartSnapshot);
  const failedCardOrderNumber = useFailedCardPaymentStore(s => s.orderNumber);
  const failedCardIdtaxdocument = useFailedCardPaymentStore(s => s.idtaxdocument);
  const menuReady = useMenuPreloadStore(s => s.ready);
  const tableIds = useMenuPreloadStore(s => s.tableIds);
  const activeCategoryId = useMenuPreloadStore(s => s.activeCategoryId);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    sunmi: translate('kiosk.admin.printerStatus.checking'),
    thermal: translate('kiosk.admin.printerStatus.checking'),
  });
  const [printingTest, setPrintingTest] = useState<'cash' | 'card' | null>(null);
  const [refreshingLogin, setRefreshingLogin] = useState(false);
  const [printLogs, setPrintLogs] = useState<string[]>([]);
  const [activeLogFilter, setActiveLogFilter] = useState<AdminLogFilter>('all');
  const [preferredPrinter, setPreferredPrinterState] = useState<PreferredPrinterKind>(() => getPreferredPrinterKind());
  const [printerDropdownOpen, setPrinterDropdownOpen] = useState(false);
  const appVersion = APP_VERSION;
  const vivaTransactionLogs = useMemo(() => {
    const accountType = Number(wireRow?.paroxos_customers_id ?? 0) === 50
      ? 'demo'
      : 'production';
    const hasTidNsp = String(wireRow?.tid_nsp ?? '').trim() !== '';
    const failedCartItems = failedCardCart?.items.length ?? 0;
    const failedCartType = failedCardCart?.type ?? '';
    const failedCartTable = failedCardCart?.tableId ?? '';
    const failedCartTotal = cartTotal(failedCardCart);
    return [
      `phase=${vivaPhase}`,
      `lastError=${displayValue(vivaLastError)}`,
      `pendingOrder=${displayValue(vivaPendingOrderNumber)}`,
      `pendingReceiptOrder=${displayValue(vivaPendingReceiptOrderNumber)}`,
      `failedOrder=${displayValue(failedCardOrderNumber)}`,
      `idtaxdocument=${displayValue(failedCardIdtaxdocument)}`,
      `failedCart type=${displayValue(failedCartType)} table=${displayValue(
        failedCartTable,
      )} items=${failedCartItems} total=${displayValue(failedCartTotal)}`,
      `account=${accountType} tid_nsp=${yesNo(hasTidNsp)} idstore_pos=${displayValue(
        wireRow?.idstore_pos,
      )} aade_branchcode=${displayValue(wireRow?.aade_branchcode)}`,
      `flags ismellon=${displayValue(wireRow?.ismellon)} isvivacloud=${displayValue(
        wireRow?.isvivacloud,
      )} novus_user=${displayValue(wireRow?.novus_user)} auto_receipt=${displayValue(
        wireRow?.auto_receipt,
      )}`,
      `lastDeepLink=${displayValue(redactVivaDeepLink(vivaLastDeepLink))}`,
      `lastVivaRequest=${displayValue(redactVivaDeepLink(lastVivaRequest))}`,
      `lastVivaResponse=${displayValue(redactVivaDeepLink(lastVivaResponse))}`,
    ];
  }, [
    failedCardCart,
    failedCardIdtaxdocument,
    failedCardOrderNumber,
    lastVivaRequest,
    lastVivaResponse,
    vivaLastDeepLink,
    vivaLastError,
    vivaPendingOrderNumber,
    vivaPendingReceiptOrderNumber,
    vivaPhase,
    wireRow,
  ]);
  const visibleLogs = useMemo(() => {
    const vivaLines = vivaTransactionLogs.map(line => `[Viva] ${line}`);
    const printLines = printLogs.map(line => `[Print] ${line}`);
    if (activeLogFilter === 'viva') {
      return vivaLines;
    }
    if (activeLogFilter === 'print') {
      return printLines;
    }
    return [...vivaLines, ...printLines];
  }, [activeLogFilter, printLogs, vivaTransactionLogs]);

  const appendPrintLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    setPrintLogs(prev => [
      `[${timestamp}] ${message}`,
      ...prev,
    ].slice(0, MAX_PRINT_LOGS));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPrinterStatus() {
      appendPrintLog('Printer status: checking native bridges');
      const sunmi = NativeModules.SunmiPrinter;
      const thermal = NativeModules.ThermalPrinter;
      const next: PrinterStatus = {
        sunmi: translate('kiosk.admin.printerStatus.notAvailable'),
        thermal: translate('kiosk.admin.printerStatus.notAvailable'),
      };
      try {
        if (Platform.OS === 'android' && sunmi?.isReady) {
          appendPrintLog('Sunmi status: calling isReady');
          next.sunmi = (await Promise.resolve(sunmi.isReady()))
            ? translate('kiosk.admin.printerStatus.ready')
            : translate('kiosk.admin.printerStatus.notReady');
          appendPrintLog(`Sunmi status: ${next.sunmi}`);
        } else {
          appendPrintLog('Sunmi status: bridge or isReady unavailable');
        }
      } catch (error) {
        next.sunmi = translate('kiosk.admin.printerStatus.error');
        appendPrintLog(`Sunmi status: error ${error instanceof Error ? error.message : String(error)}`);
      }
      try {
        if (Platform.OS === 'android' && thermal?.listPrinters) {
          appendPrintLog('DantSu USB status: calling listPrinters');
          const printers = await Promise.resolve(thermal.listPrinters());
          next.thermal = Array.isArray(printers)
            ? translate('kiosk.admin.printerStatus.usbDevices').replace(
                '{{count}}',
                String(printers.length),
              )
            : translate('kiosk.admin.printerStatus.available');
          appendPrintLog(`DantSu USB status: ${next.thermal}`);
        } else if (Platform.OS === 'android' && thermal?.isReady) {
          appendPrintLog('DantSu USB status: calling isReady');
          next.thermal = (await Promise.resolve(thermal.isReady()))
            ? translate('kiosk.admin.printerStatus.ready')
            : translate('kiosk.admin.printerStatus.notReady');
          appendPrintLog(`DantSu USB status: ${next.thermal}`);
        } else {
          appendPrintLog('DantSu USB status: bridge unavailable');
        }
      } catch (error) {
        next.thermal = translate('kiosk.admin.printerStatus.error');
        appendPrintLog(`DantSu USB status: error ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!cancelled) {
        setPrinterStatus(next);
      }
    }
    void loadPrinterStatus();
    return () => {
      cancelled = true;
    };
  }, [appendPrintLog]);

  const printerLabel = useCallback((kind: PreferredPrinterKind) => (
    kind === 'sunmi'
      ? translate('kiosk.admin.printerSunmi')
      : translate('kiosk.admin.printerDantsu')
  ), []);

  const updatePreferredPrinter = useCallback((kind: PreferredPrinterKind) => {
    setPreferredPrinterKind(kind);
    setPreferredPrinterState(kind);
    setPrinterDropdownOpen(false);
    appendPrintLog(`Printer preference: ${printerLabel(kind)}`);
  }, [appendPrintLog, printerLabel]);

  const onLogout = () => {
    logout();
  };

  const onRefreshLoginData = async () => {
    if (!credentials?.user || !credentials.password) {
      Alert.alert(
        translate('kiosk.admin.refreshLoginFailedTitle'),
        translate('kiosk.admin.refreshLoginMissingCredentials'),
      );
      return;
    }

    setRefreshingLogin(true);
    try {
      await refreshLogin(credentials.user, credentials.password);
      Alert.alert(
        translate('kiosk.admin.refreshLoginDoneTitle'),
        translate('kiosk.admin.refreshLoginDoneMessage'),
      );
    } catch (error) {
      Alert.alert(
        translate('kiosk.admin.refreshLoginFailedTitle'),
        error instanceof Error ? error.message : translate('kiosk.admin.refreshLoginFailedMessage'),
      );
    } finally {
      setRefreshingLogin(false);
    }
  };

  const buildTestCart = (paymentMethod: 'cash' | 'card'): Cart => ({
    id: `admin-test-${paymentMethod}`,
    tableId: cart?.tableId ?? (tableIds.takeaway || tableIds['dine-in'] || 0),
    type: cart?.type ?? 'takeaway',
    comment: '',
    customer: null,
    items: [
      {
        lineId: 'admin-test-line-1',
        productId: 0,
        productName: translate('kiosk.admin.testReceiptProduct'),
        unitPrice: 5,
        quantity: 2,
        selectedOptions: [
          {
            groupId: 0,
            valueId: 0,
            label: translate('kiosk.admin.testReceiptModifier'),
            quantity: 2,
            unitPriceDelta: 0.5,
            priceDelta: 1,
          },
        ],
        lineTotal: 10,
      },
    ],
  });

  const printTestReceipt = async (paymentMethod: 'cash' | 'card') => {
    appendPrintLog(`Test ${paymentMethod} receipt: started`);
    setPrintingTest(paymentMethod);
    const mockQrUrl = 'https://garsonista.datapp.gr/mock/admin-card-receipt?order=TEST-CARD';
    try {
      await printFinalReceipt(session, buildTestCart(paymentMethod), {
        paymentMethod,
        serviceType: cart?.type ?? 'takeaway',
        serviceLabel: cart?.type === 'dine-in'
          ? translate('kiosk.dining.dineIn')
          : translate('kiosk.dining.takeaway'),
        orderNumber: paymentMethod === 'cash' ? 'TEST-CASH' : 'TEST-CARD',
        createdAt: new Date(),
        companyName: String(wireRow?.company_name ?? wireRow?.store_descr ?? 'Garsonista'),
        companyDescription: String(wireRow?.company_descr ?? wireRow?.store_descr ?? ''),
        taxId: wireRow?.afm != null ? String(wireRow.afm) : null,
        taxOffice: wireRow?.doy != null ? String(wireRow.doy) : null,
        vivaReceiptDetails: paymentMethod === 'card'
          ? {
              qrCodeUrl: mockQrUrl,
              vivaQr: mockQrUrl,
              transactionId: 'TEST-TRANSACTION',
              cardType: 'TEST CARD',
              accountNumber: '****1234',
            }
          : undefined,
        onPrintLog: appendPrintLog,
      });
      appendPrintLog(`Test ${paymentMethod} receipt: completed successfully`);
      Alert.alert(
        translate('kiosk.admin.testReceiptDoneTitle'),
        translate('kiosk.admin.testReceiptDoneMessage'),
      );
    } catch (error) {
      appendPrintLog(
        `Test ${paymentMethod} receipt: failed ${error instanceof Error ? error.message : String(error)}`,
      );
      Alert.alert(
        translate('kiosk.admin.testReceiptFailedTitle'),
        error instanceof Error ? error.message : translate('kiosk.admin.testReceiptFailedMessage'),
      );
    } finally {
      setPrintingTest(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollIndicatorInsets={styles.scrollIndicatorInsets}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ADMIN</Text>
            <Text style={styles.title}>{translate('kiosk.admin.settings')}</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>{translate('kiosk.admin.close')}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <SettingRow label="Version" value={appVersion} />
          <Text style={styles.sectionTitle}>{translate('kiosk.admin.account')}</Text>
          <SettingRow label={translate('kiosk.admin.user')} value={credentials?.user ?? session?.email} />
          <SettingRow label={translate('kiosk.admin.loginId')} value={wireRow?.loginid ?? wireRow?.iduser ?? session?.userId} />
          <SettingRow label={translate('kiosk.admin.demoAccount')} value={yesNo(Number(wireRow?.paroxos_customers_id ?? 0) === 50)} />
          <SettingRow label={translate('kiosk.admin.providerCustomer')} value={wireRow?.paroxos_customers_id} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{translate('kiosk.admin.kiosk')}</Text>
          <SettingRow label={translate('kiosk.admin.menuReady')} value={yesNo(menuReady)} />
          <SettingRow label={translate('kiosk.admin.dineInTable')} value={tableIds['dine-in']} />
          <SettingRow label={translate('kiosk.admin.takeawayTable')} value={tableIds.takeaway} />
          <SettingRow label={translate('kiosk.admin.currentCartTable')} value={cart?.tableId} />
          <SettingRow label={translate('kiosk.admin.cartItems')} value={cart?.items.length ?? 0} />
          <SettingRow label={translate('kiosk.admin.activeCategory')} value={activeCategoryId} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{translate('kiosk.admin.printers')}</Text>
          <SettingRow label={translate('kiosk.admin.sunmiBridge')} value={printerStatus.sunmi} />
          <SettingRow label={translate('kiosk.admin.dantsuUsb')} value={printerStatus.thermal} />
          <View style={styles.dropdownWrap}>
            <Text style={styles.dropdownLabel}>{translate('kiosk.admin.preferredPrinter')}</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => setPrinterDropdownOpen(open => !open)}>
              <Text style={styles.dropdownButtonText}>{printerLabel(preferredPrinter)}</Text>
              <Text style={styles.dropdownChevron}>{printerDropdownOpen ? '^' : 'v'}</Text>
            </Pressable>
            {printerDropdownOpen ? (
              <View style={styles.dropdownMenu}>
                {printerOptions.map(option => (
                  <Pressable
                    key={option}
                    style={[
                      styles.dropdownOption,
                      option === preferredPrinter && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => updatePreferredPrinter(option)}>
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        option === preferredPrinter && styles.dropdownOptionTextSelected,
                      ]}>
                      {printerLabel(option)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Logs</Text>
            <Pressable style={styles.clearLogsButton} onPress={() => setPrintLogs([])}>
              <Text style={styles.clearLogsText}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.logFilterRow}>
            {logFilters.map(filter => (
              <Pressable
                key={filter.key}
                style={[
                  styles.logFilterButton,
                  activeLogFilter === filter.key && styles.logFilterButtonActive,
                ]}
                onPress={() => setActiveLogFilter(filter.key)}>
                <Text
                  style={[
                    styles.logFilterText,
                    activeLogFilter === filter.key && styles.logFilterTextActive,
                  ]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.logPanel}>
            {visibleLogs.length === 0 ? (
              <Text style={styles.logEmpty}>No print logs yet.</Text>
            ) : (
              <ScrollView
                style={styles.logScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator>
                {visibleLogs.map((line, index) => (
                  <Text key={`${index}-${line}`} style={styles.logLine}>
                    {line}
                  </Text>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <View style={styles.testActionsRow}>
          <AdminActionButton
            label={translate('kiosk.admin.testCashReceipt')}
            iconSource={cashIcon}
            variant="warning"
            disabled={printingTest !== null}
            onPress={() => {
              void printTestReceipt('cash');
            }}
          />
          <AdminActionButton
            label={translate('kiosk.admin.testCardReceipt')}
            iconSource={cardIcon}
            variant="warning"
            disabled={printingTest !== null}
            onPress={() => {
              void printTestReceipt('card');
            }}
          />
        </View>
        <AdminActionButton
          label={translate('kiosk.admin.refreshLoginData')}
          iconText="REF"
          variant="secondary"
          disabled={refreshingLogin || printingTest !== null}
          onPress={() => {
            void onRefreshLoginData();
          }}
        />
        <AdminActionButton
          label={translate('kiosk.admin.clearCart')}
          iconSource={cartIcon}
          variant="secondary"
          disabled={refreshingLogin}
          onPress={clearCart}
        />
        <AdminActionButton
          label={translate('kiosk.admin.logoutKiosk')}
          iconText="OUT"
          variant="danger"
          disabled={refreshingLogin}
          onPress={onLogout}
        />
      </View>
    </SafeAreaView>
  );
}

function AdminActionButton({
  label,
  iconSource,
  iconText,
  variant,
  disabled,
  onPress,
}: {
  label: string;
  iconSource?: ImageSourcePropType;
  iconText?: string;
  variant: AdminActionVariant;
  disabled?: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const actionStyle =
    variant === 'danger'
      ? styles.dangerAction
      : variant === 'warning'
        ? styles.warningAction
        : styles.secondaryAction;
  const textStyle =
    variant === 'danger'
      ? styles.dangerActionText
      : variant === 'warning'
        ? styles.warningActionText
        : styles.secondaryActionText;
  return (
    <Pressable
      disabled={disabled}
      style={[styles.actionButton, actionStyle, disabled && styles.actionDisabled]}
      onPress={onPress}>
      <View style={[
        styles.actionIconWrap,
        variant === 'danger' ? styles.actionIconWrapDanger : styles.actionIconWrapLight,
      ]}>
        {iconSource ? (
          <Image source={iconSource} style={styles.actionIconImage} resizeMode="contain" />
        ) : (
          <Text style={[
            styles.actionIconText,
            variant === 'danger' && styles.actionIconTextDanger,
          ]}>{iconText}</Text>
        )}
      </View>
      <Text style={textStyle} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function SettingRow({label, value}: {label: string; value: unknown}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{displayValue(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.color.bgMuted,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 330,
  },
  scrollIndicatorInsets: {
    bottom: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.color.accentPrimary,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: theme.color.textPrimary,
  },
  closeButton: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  section: {
    marginTop: 14,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.color.textPrimary,
    marginBottom: 8,
  },
  row: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  rowLabel: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textSecondary,
  },
  rowValue: {
    flex: 1,
    fontSize: 13,
    color: theme.color.textPrimary,
    textAlign: 'right',
  },
  dropdownWrap: {
    marginTop: 14,
    gap: 8,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.color.textSecondary,
  },
  dropdownButton: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: theme.color.textPrimary,
  },
  dropdownChevron: {
    width: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    color: theme.color.accentPrimary,
  },
  dropdownMenu: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dropdownOption: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(255,122,24,0.12)',
  },
  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  dropdownOptionTextSelected: {
    color: theme.color.accentPrimary,
  },
  logHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  clearLogsButton: {
    minWidth: 72,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  clearLogsText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.color.textPrimary,
  },
  logFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  logFilterButton: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  logFilterButtonActive: {
    backgroundColor: theme.color.accentPrimary,
    borderColor: theme.color.accentPrimary,
  },
  logFilterText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.color.textSecondary,
  },
  logFilterTextActive: {
    color: theme.color.onAccent,
  },
  logPanel: {
    minHeight: 160,
    maxHeight: 260,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  logScroll: {
    flex: 1,
  },
  logEmpty: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9ca3af',
  },
  logLine: {
    fontSize: 11,
    lineHeight: 16,
    color: '#e5e7eb',
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 12,
    backgroundColor: theme.color.bgMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  testActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    minHeight: 50,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionIconWrapLight: {
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  actionIconWrapDanger: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  actionIconImage: {
    width: 20,
    height: 20,
  },
  actionIconText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.color.textPrimary,
  },
  actionIconTextDanger: {
    color: theme.color.onAccent,
  },
  secondaryAction: {
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.color.textPrimary,
    textAlign: 'center',
  },
  warningAction: {
    flex: 1,
    backgroundColor: theme.color.accentPrimary,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
  },
  warningActionText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: theme.color.onAccent,
    textAlign: 'center',
  },
  dangerAction: {
    backgroundColor: theme.color.danger,
  },
  dangerActionText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: theme.color.onAccent,
    textAlign: 'center',
  },
});
