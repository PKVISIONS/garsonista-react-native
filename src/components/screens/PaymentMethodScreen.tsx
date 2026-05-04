/**
 * Post–order completion: where to pay (kiosk layout).
 *
 * Icons from Cordova `garsonista-kiosk/www/img/coins-solid_2_1.png`,
 * `credit-card-solid (5) 2.png` → `kiosk-payment-coins.png`, `kiosk-payment-card.png`.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useAuthStore, useCartStore} from '@store';
import {kioskTopBrandLogo, shadowChoiceCard, theme} from '@theme/kiosk';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentMethod'>;

const payCoinsImg = require('../../assets/images/kiosk-payment-coins.png');
const payCardImg = require('../../assets/images/kiosk-payment-card.png');
/** `kiosk_image3` (Cordova) — same as `MenuScreen` / `DiningChoiceScreen` */
const kioskBrandLogoFallback = require('../../assets/images/garsonista-kiosk-logo.png');

function KioskPaymentIcon({variant}: {variant: 'cash' | 'card'}): React.JSX.Element {
  return (
    <View style={styles.iconWrap}>
      <Image
        source={variant === 'cash' ? payCoinsImg : payCardImg}
        style={styles.payIcon}
        resizeMode="contain"
      />
    </View>
  );
}

export function PaymentMethodScreen({navigation}: Props): React.JSX.Element {
  const wireRow = useAuthStore(s => s.wireRow);
  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const topBrandSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : kioskBrandLogoFallback;
  const cart = useCartStore(s => s.cart);
  const {width} = useWindowDimensions();
  const cardGap = 14;
  const horizontalPad = Math.max(24, Math.round(width * 0.08));

  const goMenu = () => {
    if (cart) {
      navigation.navigate(ROUTES.Menu, {serviceType: cart.type});
    } else {
      navigation.navigate(ROUTES.Menu, {serviceType: 'dine-in'});
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBrand}>
        <Image
          source={topBrandSource}
          style={styles.topBrandLogo}
          resizeMode="contain"
          fadeDuration={Platform.OS === 'android' ? 0 : undefined}
          accessibilityLabel={translate('kiosk.receipt.brand')}
        />
      </View>
      <View style={[styles.body, {paddingHorizontal: horizontalPad}]}>
        <View style={styles.vertSpacer} />
        <View style={styles.centerBlock}>
          <Text style={styles.prompt}>{translate('kiosk.pay.prompt')}</Text>

          <View style={[styles.choiceRow, {gap: cardGap}]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('kiosk.pay.a11yCash')}
              style={({pressed}) => [
                styles.choiceCard,
                pressed && styles.choicePressed,
              ]}
              android_ripple={{color: 'rgba(0,0,0,0.06)'}}
              onPress={() => navigation.navigate(ROUTES.TransactionReceipt)}>
              <KioskPaymentIcon variant="cash" />
              <Text style={styles.choiceText}>{translate('kiosk.pay.cash')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('kiosk.pay.a11yCard')}
              style={({pressed}) => [
                styles.choiceCard,
                pressed && styles.choicePressed,
              ]}
              android_ripple={{color: 'rgba(0,0,0,0.06)'}}
              onPress={() => navigation.navigate(ROUTES.TransactionReceipt)}>
              <KioskPaymentIcon variant="card" />
              <Text style={styles.choiceText}>{translate('kiosk.pay.card')}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.vertSpacer} />

        <View style={styles.footerRow}>
          <Pressable
            style={({pressed}) => [
              styles.backOutlineBtn,
              pressed && styles.backOutlinePressed,
            ]}
            onPress={goMenu}>
            <Text style={styles.backOutlineText}>{translate('kiosk.pay.backMenu')}</Text>
          </Pressable>
          <Pressable
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
            hitSlop={12}>
            <Text style={styles.cancelText}>{translate('kiosk.pay.cancel')}</Text>
          </Pressable>
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
  topBrand: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: theme.color.bgMuted,
  },
  topBrandLogo: {
    ...kioskTopBrandLogo,
  },
  body: {
    flex: 1,
  },
  vertSpacer: {
    flex: 1,
    minHeight: 0,
  },
  centerBlock: {
    width: '100%',
    alignItems: 'center',
  },
  prompt: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '500',
    color: theme.color.textPrimary,
    marginBottom: 28,
    paddingHorizontal: 8,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  iconWrap: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payIcon: {
    width: 56,
    height: 56,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 720,
  },
  /** Reference: two white rounded tiles; square proportion on wide kiosks */
  choiceCard: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.card,
    ...shadowChoiceCard,
  },
  choicePressed: {
    opacity: 0.92,
  },
  choiceText: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: theme.color.textPrimary,
    lineHeight: 30,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 12,
    paddingTop: 8,
    flexWrap: 'wrap',
  },
  backOutlineBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: theme.radius.button,
    borderWidth: 2,
    borderColor: theme.color.accentPrimary,
    backgroundColor: theme.color.bgPrimary,
  },
  backOutlinePressed: {
    opacity: 0.88,
  },
  backOutlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.textPrimary,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.color.textSecondary,
  },
});
