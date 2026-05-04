import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {theme, titleSection} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentBank'>;

export function PaymentBankScreen({navigation}: Props): React.JSX.Element {
  return (
    <View style={styles.box}>
      <Text style={[titleSection, styles.title]}>{translate('kiosk.paymentBank.title')}</Text>
      <Text style={styles.sub}>{translate('kiosk.paymentBank.sub')}</Text>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={() => navigation.navigate(ROUTES.OrderComplete)}>
        <Text style={styles.btnText}>{translate('kiosk.paymentBank.complete')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {flex: 1, padding: theme.space.lg, backgroundColor: theme.color.bgPrimary},
  title: {marginBottom: theme.space.sm},
  sub: {color: theme.color.textSecondary, marginBottom: theme.space.md, fontSize: 14, lineHeight: 20},
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.space.sm,
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
});
