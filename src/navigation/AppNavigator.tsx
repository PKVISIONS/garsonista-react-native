import {
  NavigationContainer,
  useNavigation,
  type Theme,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {observer} from 'mobx-react-lite';
import React, {useEffect} from 'react';
import {ActivityIndicator, Linking, StyleSheet, View} from 'react-native';
import {ROUTES} from '@constants/routes';
import {useAuthStore} from '@store/authStore';
import {usePaymentStore} from '@store/paymentStore';
import {localizationStore, translate} from '../stores/Localization/LocalizationStore';
import {parseVivaCallbackUrl} from '@services/payment/vivaCallbackParser';
import {useSubscriptionQuery} from '@hooks/useSubscriptionQuery';
import {useOfflineDrain} from '@hooks/useOfflineDrain';
import {LoginScreen} from '@screens/LoginScreen';
import {StartScreen} from '@screens/StartScreen';
import {PlaceOrderScreen} from '@screens/PlaceOrderScreen';
import {DiningChoiceScreen} from '@screens/DiningChoiceScreen';
import {MenuScreen} from '@screens/MenuScreen';
import {OrderReviewScreen} from '@screens/OrderReviewScreen';
import {ProductDetailScreen} from '@screens/ProductDetailScreen';
import {PaymentMethodScreen} from '@screens/PaymentMethodScreen';
import {PaymentCardScreen} from '@screens/PaymentCardScreen';
import {PaymentBankScreen} from '@screens/PaymentBankScreen';
import {TransactionReceiptScreen} from '@screens/TransactionReceiptScreen';
import {OrderCompleteScreen} from '@screens/OrderCompleteScreen';
import {CardFailedScreen} from '@screens/CardFailedScreen';
import {TaxCustomerScreen} from '@screens/TaxCustomerScreen';
import {PrinterErrorScreen} from '@screens/PrinterErrorScreen';
import {navigationTheme, theme} from '@theme/kiosk';
import {linking} from './linking';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function DeepLinkBridge(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setPhase = usePaymentStore(s => s.setPhase);
  const setDeepLink = usePaymentStore(s => s.setDeepLink);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({url}) => {
      setDeepLink(url);
      const fields = parseVivaCallbackUrl(url);
      if (fields.status === 'success') {
        setPhase('success');
        navigation.navigate(ROUTES.OrderComplete);
      } else if (fields.status === 'failed') {
        setPhase('failed');
        navigation.navigate(ROUTES.CardFailed);
      } else if (fields.status) {
        setPhase('processing');
      }
    });
    return () => sub.remove();
  }, [navigation, setDeepLink, setPhase]);

  return <></>;
}

export const AppNavigator = observer(function AppNavigator(): React.JSX.Element {
  const booting = useAuthStore(s => s.booting);
  const session = useAuthStore(s => s.session);
  const restore = useAuthStore(s => s.restore);
  const language = localizationStore.currentLanguageCode;

  useEffect(() => {
    void restore();
  }, [restore]);

  useSubscriptionQuery(Boolean(session));
  useOfflineDrain(Boolean(session));

  if (booting) {
    return (
      <View style={styles.bootLoader}>
        <ActivityIndicator size="large" color={theme.color.accentPrimary} />
      </View>
    );
  }

  const stackTheme: Theme = navigationTheme;

  return (
    <NavigationContainer linking={linking} theme={stackTheme}>
      <Stack.Navigator
        key={`${session ? 'app' : 'auth'}-${language}`}
        initialRouteName={
          session ? ROUTES.PlaceOrder : ROUTES.Login
        }
        screenOptions={{
          headerShown: true,
          headerBackVisible: false,
          headerStyle: {backgroundColor: stackTheme.colors.card},
          headerTintColor: stackTheme.colors.text,
          headerTitleStyle: {fontWeight: '600', fontSize: 17},
          headerShadowVisible: false,
          contentStyle: {backgroundColor: stackTheme.colors.background},
        }}>
        {session ? (
          <>
            <Stack.Screen
              name={ROUTES.PlaceOrder}
              component={PlaceOrderScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name={ROUTES.DiningChoice}
              component={DiningChoiceScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name={ROUTES.Menu}
              component={MenuScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name={ROUTES.ProductDetail}
              component={ProductDetailScreen}
              options={{
                headerShown: false,
                contentStyle: {
                  flex: 1,
                  backgroundColor: theme.color.productDetailPageBg,
                },
              }}
            />
            <Stack.Screen
              name={ROUTES.OrderReview}
              component={OrderReviewScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name={ROUTES.PaymentMethod}
              component={PaymentMethodScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name={ROUTES.PaymentCard}
              component={PaymentCardScreen}
              options={{title: translate('kiosk.nav.card')}}
            />
            <Stack.Screen
              name={ROUTES.TransactionReceipt}
              component={TransactionReceiptScreen}
              options={{headerShown: false, gestureEnabled: false}}
            />
            <Stack.Screen
              name={ROUTES.PaymentBank}
              component={PaymentBankScreen}
              options={{title: translate('kiosk.nav.bank')}}
            />
            <Stack.Screen
              name={ROUTES.OrderComplete}
              component={OrderCompleteScreen}
              options={{title: translate('kiosk.nav.complete')}}
            />
            <Stack.Screen
              name={ROUTES.CardFailed}
              component={CardFailedScreen}
              options={{title: translate('kiosk.nav.cardFailed')}}
            />
            <Stack.Screen
              name={ROUTES.TaxCustomer}
              component={TaxCustomerScreen}
              options={{title: translate('kiosk.nav.tax')}}
            />
            <Stack.Screen
              name={ROUTES.PrinterError}
              component={PrinterErrorScreen}
              options={{title: translate('kiosk.nav.printer')}}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name={ROUTES.Login}
              component={LoginScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name={ROUTES.Start}
              component={StartScreen}
              options={{headerShown: false}}
            />
          </>
        )}
      </Stack.Navigator>
      {session ? <DeepLinkBridge /> : null}
    </NavigationContainer>
  );
});

const styles = StyleSheet.create({
  bootLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
  },
});
