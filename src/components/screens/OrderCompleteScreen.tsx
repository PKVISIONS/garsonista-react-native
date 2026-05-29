import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {KioskTouchableOpacity as TouchableOpacity} from '../KioskTouchableOpacity';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useCartStore} from '@store';
import {theme, titleHero} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderComplete'>;

export function OrderCompleteScreen({navigation}: Props): React.JSX.Element {
  const clear = useCartStore(s => s.clear);
  return (
    <View style={styles.box}>
      <Text style={[titleHero, styles.title]}>{translate('kiosk.orderComplete.title')}</Text>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={() => {
          clear();
          navigation.navigate(ROUTES.PlaceOrder);
        }}>
        <Text style={styles.btnText}>{translate('kiosk.orderComplete.newOrder')}</Text>
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
  title: {marginBottom: theme.space.xl, textAlign: 'center'},
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
});
