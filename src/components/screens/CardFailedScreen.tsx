import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RootStackParamList} from '@navigation/types';
import {useAuthStore} from '@store';
import {shadowChoiceCard, theme} from '@theme/kiosk';
import {KioskPressable as Pressable} from '../KioskPressable';
import {KioskTopBrandLogo} from '../KioskTopBrandLogo';
import {
  cancelFailedCardPayment,
  payWithCashAfterCardFailure,
  retryCardPayment,
} from '@services/payment/cardPaymentRecovery';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'CardFailed'>;

const payCoinsImg = require('../../assets/images/kiosk-payment-coins.png');
const payCardImg = require('../../assets/images/kiosk-payment-card.png');
const kioskBrandLogoFallback = require('../../assets/images/garsonista-kiosk-logo.png');

function RetryChoiceButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: number;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.choiceCard,
        (pressed || disabled) && styles.choicePressed,
      ]}>
      <Image source={icon} style={styles.payIcon} resizeMode="contain" />
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

export function CardFailedScreen({navigation}: Props): React.JSX.Element {
  const wireRow = useAuthStore(s => s.wireRow);
  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const topBrandSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : kioskBrandLogoFallback;
  const {width} = useWindowDimensions();
  const cardGap = 14;
  const horizontalPad = Math.max(24, Math.round(width * 0.08));
  const [busy, setBusy] = useState<'cash' | 'card' | 'cancel' | null>(null);

  const onPayCash = () => {
    setBusy('cash');
    void payWithCashAfterCardFailure(navigation).finally(() => setBusy(null));
  };

  const onRetryCard = () => {
    setBusy('card');
    retryCardPayment(navigation);
    setBusy(null);
  };

  const onCancel = () => {
    setBusy('cancel');
    void cancelFailedCardPayment(navigation).finally(() => setBusy(null));
  };

  const disabled = busy !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBrand}>
        <KioskTopBrandLogo source={topBrandSource} />
      </View>

      <View style={[styles.body, {paddingHorizontal: horizontalPad}]}>
        <View style={styles.centerBlock}>
          <View style={styles.errorCircle}>
            <Text style={styles.errorMark}>✕</Text>
          </View>
          <Text style={styles.title}>{translate('kiosk.cardFailed.title')}</Text>
          <Text style={styles.subtitle}>{translate('kiosk.cardFailed.subtitle')}</Text>

          <View style={[styles.choiceRow, {gap: cardGap}]}>
            <RetryChoiceButton
              label={translate('kiosk.cardFailed.payCash')}
              icon={payCoinsImg}
              onPress={onPayCash}
              disabled={disabled}
            />
            <RetryChoiceButton
              label={translate('kiosk.cardFailed.retryCard')}
              icon={payCardImg}
              onPress={onRetryCard}
              disabled={disabled}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onCancel}
            hitSlop={12}
            style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{translate('kiosk.cardFailed.cancel')}</Text>
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
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  centerBlock: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 720,
    alignSelf: 'center',
  },
  errorCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 2,
    borderColor: theme.color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...shadowChoiceCard,
  },
  errorMark: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.color.danger,
    lineHeight: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.color.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  choiceCard: {
    flex: 1,
    minHeight: 120,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.card,
    ...shadowChoiceCard,
  },
  choicePressed: {
    opacity: 0.9,
  },
  payIcon: {
    width: 48,
    height: 48,
  },
  choiceText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.textPrimary,
    lineHeight: 24,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.color.textSecondary,
    textDecorationLine: 'underline',
  },
});
