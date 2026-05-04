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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {enqueueOfflineCart, submitCartOnline} from '@services/orderService';
import {printOrderSlip} from '@services/printing/printerService';
import {useAuthStore} from '@store/authStore';
import {useCartStore} from '@store/cartStore';
import {useNetworkStatus} from '@hooks/useNetworkStatus';
import {buildWireContext} from '@utils/orderContext';
import {nextTicketNumber} from '@services/ticketCounter';
import {kioskTopBrandLogo, theme} from '@theme/kiosk';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.TransactionReceipt>;

const receiptBg = require('../../assets/images/kiosk-order-receipt-bg.png');
const garsonistaPoweredByLogo = require('../../assets/images/garsonista-kiosk-logo.png');

const RESET_AFTER_MS = 7000;

export function TransactionReceiptScreen({navigation}: Props): React.JSX.Element {
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
        if (online) {
          await submitCartOnline(cart, ctx);
          if (cancelled) {
            return;
          }
        } else {
          enqueueOfflineCart(cart, ctx);
          if (cancelled) {
            return;
          }
        }
        try {
          await printOrderSlip([
            translate('kiosk.receipt.printKioskName'),
            translate('kiosk.receipt.printOrder'),
            ...cart.items.map(i =>
              translate('kiosk.receipt.printLine')
                .replace('{{name}}', i.productName)
                .replace('{{qty}}', String(i.quantity))
                .replace('{{total}}', i.lineTotal.toFixed(2)),
            ),
          ]);
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
  }, [session, wireRow, cart, online, clearCart]);

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
