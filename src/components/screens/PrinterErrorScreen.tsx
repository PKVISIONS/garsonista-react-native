import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {theme, titleSection} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PrinterError'>;

export function PrinterErrorScreen({navigation, route}: Props): React.JSX.Element {
  const msg = route.params?.message ?? translate('kiosk.printer.defaultError');
  return (
    <View style={styles.box}>
      <Text style={[titleSection, styles.title]}>{msg}</Text>
      <Text style={styles.sub}>{translate('kiosk.printer.hint')}</Text>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={() => navigation.navigate(ROUTES.PlaceOrder)}>
        <Text style={styles.btnText}>{translate('kiosk.printer.ok')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    padding: theme.space.lg,
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
  },
  title: {marginBottom: theme.space.sm, textAlign: 'center'},
  sub: {
    color: theme.color.textSecondary,
    marginBottom: theme.space.lg,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
});
