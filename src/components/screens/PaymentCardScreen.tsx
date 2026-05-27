import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useRef} from 'react';
import {Linking, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {RootStackParamList} from '@navigation/types';
import {buildVivaPaymentUri} from '@services/payment/vivaDeepLink';
import {usePaymentStore} from '@store';
import {theme, titleSection} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentCard'>;

export function PaymentCardScreen({route}: Props): React.JSX.Element {
  const {amountEuros, fiscalisationData, clientTransactionId} = route.params;
  const setPhase = usePaymentStore(s => s.setPhase);
  const setError = usePaymentStore(s => s.setError);
  const launchedRef = useRef(false);

  const launch = async () => {
    setError(null);
    setPhase('initiating');
    const uri = buildVivaPaymentUri({
      clientTransactionId,
      amountEuros,
    });
    try {
      console.log('[Viva] Launch URI:', uri);
      const can = await Linking.canOpenURL(uri);
      console.log('[Viva] canOpenURL:', can);
      setPhase('awaiting_app');
      await Linking.openURL(uri);
    } catch (e) {
      setPhase('failed');
      setError(String(e));
    }
  };

  useEffect(() => {
    if (launchedRef.current) {
      return;
    }
    launchedRef.current = true;
    void launch();
  }, []);

  return (
    <View style={styles.box}>
      <Text style={[titleSection, styles.title]}>{translate('kiosk.paymentCard.title')}</Text>
      <Text style={styles.sub}>{translate('kiosk.paymentCard.sub')}</Text>
      <Text style={styles.sub}>
        {translate('kiosk.paymentCard.amount').replace('{{amount}}', amountEuros.toFixed(2))}
      </Text>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={() => {
          void launch();
        }}>
        <Text style={styles.btnText}>{translate('kiosk.paymentCard.open')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btnGhost}
        onPress={() => setPhase('cancelled')}>
        <Text style={styles.btnGhostText}>{translate('kiosk.paymentCard.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {flex: 1, padding: theme.space.lg, backgroundColor: theme.color.bgPrimary, gap: theme.space.sm},
  title: {marginBottom: theme.space.xs},
  sub: {color: theme.color.textSecondary, marginBottom: theme.space.sm, fontSize: 14, lineHeight: 20},
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.space.sm,
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
  btnGhost: {
    backgroundColor: theme.color.bgSecondary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
  },
  btnGhostText: {color: theme.color.textPrimary, fontWeight: '600', fontSize: 16},
});
