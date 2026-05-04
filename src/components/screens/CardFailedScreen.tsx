import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {theme, titleSection} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'CardFailed'>;

export function CardFailedScreen({navigation}: Props): React.JSX.Element {
  return (
    <View style={styles.box}>
      <Text style={[titleSection, styles.title]}>{translate('kiosk.cardFailed.title')}</Text>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={() => navigation.navigate(ROUTES.PlaceOrder)}>
        <Text style={styles.btnText}>{translate('kiosk.cardFailed.back')}</Text>
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
  title: {marginBottom: theme.space.lg, textAlign: 'center'},
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
});
