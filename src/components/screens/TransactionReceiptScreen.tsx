/**
 * After payment: full thank-you screen matching the reference.
 *
 * Cordova `kiosk_order_finished` (`www/index.html` + `main.css`):
 * - top: DFC / brand = `kiosk_image3` (`kioskLogoImageUri`); bottom: `garsonista-kiosk-logo.png` (powered by Garsonista)
 * - receipt art `www/img/Group 2087326741.png` → `kiosk-order-receipt-bg.png` (order number only on screen)
 * - cash: receipt prints on payment screen; card: prints here after submit
 *
 * Flow: submit order, print slip; global idle returns to `PlaceOrder` after 10s.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {enqueueOfflineCart, submitCartOnline} from '@services/orderService';
import {printFinalReceipt} from '@services/printing/printerService';
import {useAuthStore, useCartStore, useCatalogStore} from '@store';
import {useNetworkStatus} from '@hooks/useNetworkStatus';
import {buildWireContext} from '@utils/orderContext';
import {resolveFiscalisationDataFromInvoiceUrl} from '@utils/fiscalisationFromInvoice';
import {nextTicketNumber} from '@services/ticketCounter';
import {theme} from '@theme/kiosk';
import {KioskTopBrandLogo} from '../KioskTopBrandLogo';
import {buildVivaPaymentUri} from '@services/payment/vivaDeepLink';
import {captureFailedCardAttempt} from '@services/payment/cardPaymentRecovery';
import {navigateToCardFailed} from '@services/payment/vivaFlow';
import {Linking} from 'react-native';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {translate} from '../../stores/Localization/LocalizationStore';
import {
  buildReceiptPrintContext,
  ensureReceiptCatalogPremises,
} from '@utils/receiptCompanyContext';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.TransactionReceipt>;

const receiptBg = require('../../assets/images/kiosk-order-receipt-bg.png');
const garsonistaPoweredByLogo = require('../../assets/images/garsonista-kiosk-logo.png');

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
  const submitStartedRef = useRef(false);
  const paymentMethod = route.params?.paymentMethod ?? 'cash';
  const receiptPrinted = route.params?.receiptPrinted === true;
  const attemptId = route.params?.attemptId ?? 0;

  useEffect(() => {
    submitStartedRef.current = false;
  }, [attemptId]);

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
      const ticket = route.params?.orderNumber ?? nextTicketNumber();
      if (!cancelled) {
        setOrderNumber(ticket);
      }
      if (paymentMethod === 'card') {
        captureFailedCardAttempt(cart, ticket);
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
        if (paymentMethod === 'card') {
          if (!fiscalisationData && !aadePayload) {
            if (__DEV__) {
              console.log(
                '[VivaFlow] TransactionReceipt card path: missing fiscalisationData -> CardFailed',
              );
            }
            if (!cancelled) {
              setSubmitting(false);
              navigateToCardFailed(navigation, undefined, {cart, orderNumber: ticket});
            }
            return;
          }
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
            const canOpen = await Linking.canOpenURL(vivaUri);
            if (!canOpen) {
              if (!cancelled) {
                setSubmitting(false);
                navigateToCardFailed(navigation, undefined, {cart, orderNumber: ticket});
              }
              return;
            }
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
            if (!cancelled) {
              setSubmitting(false);
              navigateToCardFailed(navigation, undefined, {cart, orderNumber: ticket});
            }
            return;
          }
        }

        if (!receiptPrinted) {
          try {
            const catalog = await ensureReceiptCatalogPremises(
              useCatalogStore.getState().data,
            );
            if (catalog && catalog.storePremises.length > 0) {
              useCatalogStore.getState().setBootstrap(catalog);
            }
            const printPromise = printFinalReceipt(
              session,
              cart,
              buildReceiptPrintContext(wireRow, cart, {
                orderNumber: ticket,
                createdAt: new Date(),
                paymentMethod: 'card',
                tableLabel: tableLabelFor(cart.type, cart.tableId),
                serviceLabel:
                  cart.type === 'dine-in' ? 'Κατανάλωση στο χώρο' : 'Takeaway',
              }, catalog),
            );
            const timeoutPromise = new Promise<null>(resolve =>
              setTimeout(() => resolve(null), PRINT_TIMEOUT_MS),
            );
            const printed = await Promise.race([printPromise, timeoutPromise]);
            if (!cancelled && !printed && __DEV__) {
              console.log('[VivaFlow] TransactionReceipt print timeout (non-blocking)');
            }
          } catch {
            /* optional */
          }
        }
        if (paymentMethod !== 'card') {
          clearCart();
        }
      } catch {
        enqueueOfflineCart(cart, ctx);
        if (cancelled) {
          return;
        }
        if (paymentMethod === 'card') {
          if (!cancelled) {
            setSubmitting(false);
            navigateToCardFailed(navigation, undefined, {cart, orderNumber: ticket});
          }
          return;
        }
        clearCart();
      } finally {
        if (!cancelled) {
          setSubmitting(false);
        }
      }
    };

    const interaction = InteractionManager.runAfterInteractions(() => {
      void run();
    });
    return () => {
      cancelled = true;
      interaction.cancel();
    };
  }, [
    session,
    wireRow,
    cart,
    online,
    clearCart,
    paymentMethod,
    receiptPrinted,
    route.params?.orderNumber,
    route.params?.attemptId,
    navigation,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.topLogoSection}>
          <KioskTopBrandLogo source={topBrandLogoSource} />
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
        </View>

        <View style={styles.footer}>
          <Image
            source={garsonistaPoweredByLogo}
            style={styles.footerGarsonistaLogo}
            resizeMode="contain"
            accessibilityLabel={translate('kiosk.receipt.garsonistaA11y')}
          />
        </View>
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
    paddingBottom: 12,
    paddingHorizontal: 8,
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
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  footerGarsonistaLogo: {
    width: 650,
    height: 550,
    maxWidth: '100%',
  },
});
