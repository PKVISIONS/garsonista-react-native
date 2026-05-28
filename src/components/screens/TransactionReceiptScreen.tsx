/**
 * After payment: full thank-you screen matching the reference.
 *
 * Cordova `kiosk_order_finished` (`www/index.html` + `main.css`):
 * - receipt art `www/img/Group 2087326741.png` → `kiosk-order-receipt-bg.png`
 * - top: DFC / brand = `kiosk_image3` (`kioskLogoImageUri`); bottom: `garsonista-kiosk-logo.png` (powered by Garsonista)
 *
 * Flow: submit order, print slip, then auto-reset to `PlaceOrder` after 7s.
 */
import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {enqueueOfflineCart, submitCartOnline} from '@services/orderService';
import {printFinalReceipt} from '@services/printing/printerService';
import {useAuthStore, useCartStore} from '@store';
import {useNetworkStatus} from '@hooks/useNetworkStatus';
import {buildWireContext} from '@utils/orderContext';
import {resolveFiscalisationDataFromInvoiceUrl} from '@utils/fiscalisationFromInvoice';
import {nextTicketNumber} from '@services/ticketCounter';
import {kioskTopBrandLogo, theme} from '@theme/kiosk';
import {buildVivaPaymentUri} from '@services/payment/vivaDeepLink';
import {Linking} from 'react-native';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.TransactionReceipt>;

const receiptBg = require('../../assets/images/kiosk-order-receipt-bg.png');
const garsonistaPoweredByLogo = require('../../assets/images/garsonista-kiosk-logo.png');

const RESET_AFTER_MS = 7000;
const PRINT_TIMEOUT_MS = 8000;
const tableLabelFor = (type: 'dine-in' | 'takeaway', tableId: number) =>
  type === 'dine-in' ? `Τραπέζι ${tableId}` : 'Takeaway';

export function TransactionReceiptScreen({navigation, route}: Props): React.JSX.Element {
  const session = useAuthStore(s => s.session);
  const wireRow = useAuthStore(s => s.wireRow);
  const cart = useCartStore(s => s.cart);
  const clearCart = useCartStore(s => s.clear);
  const online = useNetworkStatus();

  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const topBrandLogoSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : garsonistaPoweredByLogo;

  const [submitting, setSubmitting] = useState(true);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [printingDebug, setPrintingDebug] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<any>(null);
  const submitStartedRef = useRef(false);
  const paymentMethod = route.params?.paymentMethod ?? 'cash';

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (submitStartedRef.current) {
        return;
      }
      if (!session || !cart) {
        if (!cancelled) {
          setSubmitting(false);
        }
        return;
      }
      submitStartedRef.current = true;
      const ticket = nextTicketNumber();
      if (!cancelled) {
        setOrderNumber(ticket);
      }
      const ctx = buildWireContext(session, wireRow, cart.tableId);
      try {
        let fiscalisationData: string | undefined;
        let aadePayload:
          | {
              id: string;
              digest: string;
              signature: string;
            }
          | undefined;
        if (online) {
          const submitted = await submitCartOnline(cart, ctx, {
            paymentMethod,
            orderNumber: ticket,
            tipAmount: 0,
          });
          const invoiceRaw = submitted.fiscalDoc?.invoiceUrl;
          fiscalisationData = resolveFiscalisationDataFromInvoiceUrl(invoiceRaw);
          if (invoiceRaw && !fiscalisationData) {
            try {
              const parsed = JSON.parse(invoiceRaw) as Record<string, unknown>;
              const digest = String(parsed.digest ?? '').trim();
              const signature = String(parsed.signature ?? '').trim();
              const id = String(parsed.id ?? '').trim();
              const hasError = Boolean(parsed.error);
              if (!hasError && digest && signature && id) {
                aadePayload = {id, digest, signature};
              }
            } catch {
              /* not JSON */
            }
          }
          if (__DEV__) {
            const rawInvoice = submitted.fiscalDoc?.invoiceUrl ?? '';
            console.log(
              `[VivaFlow] TransactionReceipt insert_orders done hasFiscal=${Boolean(
                fiscalisationData?.trim(),
              )} fiscalLen=${fiscalisationData?.length ?? 0} hasAadePayload=${Boolean(
                aadePayload?.digest && aadePayload?.signature && aadePayload?.id,
              )} invoicePreview=${String(rawInvoice).slice(
                0,
                120,
              )}`,
            );
          }
          if (cancelled) {
            return;
          }
        } else {
          enqueueOfflineCart(cart, ctx);
          if (cancelled) {
            return;
          }
        }
        if (paymentMethod === 'card' && (fiscalisationData || aadePayload)) {
          if (__DEV__) {
            console.log(
              `[VivaFlow] TransactionReceipt launching Viva from insert_orders amount=${cart.items
                .reduce((sum, item) => sum + item.lineTotal, 0)
                .toFixed(2)} fiscalLen=${fiscalisationData?.length ?? 0} aadeId=${aadePayload?.id ?? ''}`,
            );
          }
          const vivaUri = buildVivaPaymentUri({
            clientTransactionId: String(orderNumber ?? ticket),
            amountEuros: cart.items.reduce((sum, item) => sum + item.lineTotal, 0),
            fiscalisationData,
            aade: aadePayload
              ? {
                  providerId: aadePayload.id,
                  digest: aadePayload.digest,
                  signature: aadePayload.signature,
                }
              : undefined,
          });
          try {
            await Linking.openURL(vivaUri);
            if (__DEV__) {
              console.log('[VivaFlow] TransactionReceipt Linking.openURL resolved');
            }
          } catch (e) {
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt Linking.openURL failed msg=${(e as Error)?.message ?? String(
                  e,
                )}`,
              );
            }
          }
        } else if (paymentMethod === 'card' && __DEV__) {
          console.log('[VivaFlow] TransactionReceipt card path: missing fiscalisationData after insert_orders');
        }

        try {
          const printPromise = printFinalReceipt(session, cart, {
            orderNumber: ticket,
            createdAt: new Date(),
            companyName: 'Garsonista',
            branchName: wireRow?.store_name ? String(wireRow.store_name) : null,
            tableLabel: tableLabelFor(cart.type, cart.tableId),
            serviceLabel: cart.type === 'dine-in' ? 'Κατανάλωση στο χώρο' : 'Takeaway',
          });
          const timeoutPromise = new Promise<null>(resolve =>
            setTimeout(() => resolve(null), PRINT_TIMEOUT_MS),
          );
          const printed = await Promise.race([printPromise, timeoutPromise]);
          if (!cancelled) {
            if (printed && 'preview' in printed) {
              setReceiptPreview(printed.preview);
            } else if (__DEV__) {
              console.log('[VivaFlow] TransactionReceipt print timeout (non-blocking)');
            }
          }
        } catch {
          /* optional */
        }
        clearCart();
      } catch {
        enqueueOfflineCart(cart, ctx);
        if (cancelled) {
          return;
        }
        clearCart();
      } finally {
        if (!cancelled) {
          setSubmitting(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [session, wireRow, cart, online, clearCart, paymentMethod]);

  useEffect(() => {
    if (submitting) {
      return;
    }
    const timer = setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: ROUTES.PlaceOrder}],
        }),
      );
    }, RESET_AFTER_MS);
    return () => clearTimeout(timer);
  }, [submitting, navigation]);

  const handleDebugPrint = async () => {
    if (!session || !cart) {
      return;
    }
    setPrintingDebug(true);
    try {
      const printed = await printFinalReceipt(session, cart, {
        orderNumber: orderNumber ?? nextTicketNumber(),
        createdAt: new Date(),
        companyName: 'Garsonista',
        branchName: wireRow?.store_name ? String(wireRow.store_name) : null,
        tableLabel: tableLabelFor(cart.type, cart.tableId),
        serviceLabel: cart.type === 'dine-in' ? 'Κατανάλωση στο χώρο' : 'Takeaway',
      });
      setReceiptPreview(printed.preview);
    } catch {
      /* debug-only path */
    } finally {
      setPrintingDebug(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.topLogoSection}>
          <Image
            source={topBrandLogoSource}
            style={styles.topBrandLogo}
            resizeMode="contain"
            accessibilityLabel={translate('kiosk.receipt.brand')}
          />
        </View>

        <View style={styles.center}>
          <Text style={styles.thankTitle}>{translate('kiosk.receipt.thankYou')}</Text>
          <Text style={styles.preparing}>{translate('kiosk.receipt.preparing')}</Text>

          <View style={styles.receiptWrap}>
            <ImageBackground
              source={receiptBg}
              style={styles.receiptBg}
              resizeMode="contain">
              <View style={styles.receiptInner}>
                <Text style={styles.orderLabel}>{translate('kiosk.receipt.orderNumber')}</Text>
                {submitting ? (
                  <ActivityIndicator
                    size="large"
                    color={theme.color.accentPrimary}
                    style={styles.spinner}
                  />
                ) : (
                  <Text style={styles.orderDigit}>
                    {orderNumber != null && orderNumber > 0
                      ? String(orderNumber)
                      : translate('kiosk.receipt.dash')}
                  </Text>
                )}
              </View>
            </ImageBackground>
          </View>

          {receiptPreview ? (
            <View style={styles.previewCard}>
              <ScrollView
                style={styles.previewScroll}
                contentContainerStyle={styles.previewContent}
                showsVerticalScrollIndicator={false}>
                <Text style={styles.previewTitle}>{receiptPreview.title}</Text>
                {receiptPreview.subtitle ? (
                  <Text style={styles.previewSubtitle}>{receiptPreview.subtitle}</Text>
                ) : null}
                <View style={styles.previewRule} />
                {receiptPreview.metadata.map((row: any) => (
                  <View key={`${row.label}-${row.value}`} style={styles.previewMetaRow}>
                    <Text style={styles.previewMetaLabel}>{row.label}</Text>
                    <Text style={styles.previewMetaValue}>{row.value}</Text>
                  </View>
                ))}
                <View style={styles.previewRule} />
                {receiptPreview.items.map((item: any, idx: number) => (
                  <View key={`${item.name}-${idx}`} style={styles.previewItem}>
                    <Text style={styles.previewItemName}>{item.name}</Text>
                    <View style={styles.previewItemRow}>
                      <Text style={styles.previewItemQty}>x{item.quantity}</Text>
                      <Text style={styles.previewItemTotal}>{item.lineTotal}</Text>
                    </View>
                    {item.options.map((opt: string) => (
                      <Text key={opt} style={styles.previewOption}>
                        {opt}
                      </Text>
                    ))}
                  </View>
                ))}
                <View style={styles.previewRule} />
                {receiptPreview.totals.map((row: any) => (
                  <View key={`${row.label}-${row.value}`} style={styles.previewTotalRow}>
                    <Text
                      style={[
                        styles.previewTotalLabel,
                        row.emphasized && styles.previewTotalLabelEmph,
                      ]}>
                      {row.label}
                    </Text>
                    <Text
                      style={[
                        styles.previewTotalValue,
                        row.emphasized && styles.previewTotalValueEmph,
                      ]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Image
            source={garsonistaPoweredByLogo}
            style={styles.footerGarsonistaLogo}
            resizeMode="contain"
            accessibilityLabel={translate('kiosk.receipt.garsonistaA11y')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleDebugPrint}
          style={({pressed}) => [
            styles.debugButton,
            pressed && styles.debugButtonPressed,
            printingDebug && styles.debugButtonBusy,
          ]}>
          <Text style={styles.debugButtonText}>
            {printingDebug ? 'Printing...' : 'Print test'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.color.bgMuted,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topLogoSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  topBrandLogo: {
    ...kioskTopBrandLogo,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thankTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  preparing: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.color.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  receiptWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  receiptBg: {
    width: 180,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptInner: {
    paddingVertical: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  orderLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  orderDigit: {
    fontSize: 44,
    fontWeight: '700',
    color: theme.color.accentPrimary,
    textAlign: 'center',
    lineHeight: 48,
  },
  spinner: {
    marginTop: 4,
  },
  previewCard: {
    marginTop: 18,
    width: '100%',
    maxWidth: 540,
    backgroundColor: theme.color.bgPrimary,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    maxHeight: 320,
  },
  previewScroll: {
    flexGrow: 0,
  },
  previewContent: {
    gap: 8,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: theme.color.textPrimary,
  },
  previewSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    color: theme.color.textSecondary,
  },
  previewRule: {
    height: 1,
    backgroundColor: theme.color.border,
    marginVertical: 4,
  },
  previewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewMetaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.textSecondary,
  },
  previewMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  previewItem: {
    gap: 2,
  },
  previewItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  previewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewItemQty: {
    fontSize: 13,
    color: theme.color.textSecondary,
  },
  previewItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  previewOption: {
    fontSize: 12,
    color: theme.color.textSecondary,
    marginLeft: 10,
  },
  previewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewTotalLabel: {
    fontSize: 14,
    color: theme.color.textPrimary,
  },
  previewTotalValue: {
    fontSize: 14,
    color: theme.color.textPrimary,
  },
  previewTotalLabelEmph: {
    fontWeight: '800',
  },
  previewTotalValueEmph: {
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  footerGarsonistaLogo: {
    width: 650,
    height: 550,
    maxWidth: '100%',
  },
  debugButton: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    minWidth: 124,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 5,
  },
  debugButtonPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
  debugButtonBusy: {
    opacity: 0.75,
  },
  debugButtonText: {
    color: theme.color.onAccent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
