import {CommonActions, useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {KioskTouchableOpacity as TouchableOpacity} from '../KioskTouchableOpacity';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useCartStore} from '@store';
import {theme, titleHero} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderComplete'>;

const ORDER_COMPLETE_TIMEOUT_MS = 5_000;
const ORDER_COMPLETE_SECONDS = 5;

export function OrderCompleteScreen({navigation}: Props): React.JSX.Element {
  const clear = useCartStore(s => s.clear);
  const [remainingSeconds, setRemainingSeconds] = useState(ORDER_COMPLETE_SECONDS);

  const goHome = useCallback(() => {
    clear();
    const resetAction = CommonActions.reset({
      index: 0,
      routes: [{name: ROUTES.PlaceOrder}],
    });
    const parent = navigation.getParent();
    if (parent) {
      parent.dispatch(resetAction);
      return;
    }
    navigation.dispatch(resetAction);
  }, [clear, navigation]);

  useFocusEffect(
    useCallback(() => {
      setRemainingSeconds(ORDER_COMPLETE_SECONDS);

      const countdownId = setInterval(() => {
        setRemainingSeconds(prev => Math.max(prev - 1, 0));
      }, 1000);

      const timeoutId = setTimeout(() => {
        goHome();
      }, ORDER_COMPLETE_TIMEOUT_MS);

      return () => {
        clearInterval(countdownId);
        clearTimeout(timeoutId);
      };
    }, [goHome]),
  );

  return (
    <View style={styles.box}>
      <Text style={[titleHero, styles.title]}>{translate('kiosk.orderComplete.title')}</Text>
      <View style={styles.timerWrap}>
        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>{remainingSeconds}</Text>
        </View>
      </View>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={goHome}>
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
  timerWrap: {
    alignItems: 'center',
    marginBottom: theme.space.xl,
  },
  timerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
  },
  timerText: {
    color: theme.color.textPrimary,
    fontFamily: theme.font.bold,
    fontSize: 24,
    fontWeight: '400',
  },
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
});
