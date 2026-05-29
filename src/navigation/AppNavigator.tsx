import {
  NavigationContainer,
  useNavigation,
  useNavigationContainerRef,
  type Theme,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {observer} from 'mobx-react-lite';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Linking, StyleSheet, View} from 'react-native';
import {ROUTES} from '@constants/routes';
import {useAuthStore, useCartStore, useMenuPreloadStore, usePaymentStore} from '@store';
import {useFailedCardPaymentStore} from '../stores/Payment/FailedCardPaymentStore';
import {localizationStore, translate} from '../stores/Localization/LocalizationStore';
import {parseVivaCallbackUrl} from '@services/payment/vivaCallbackParser';
import {
  isVivaCallbackSuccess,
  isVivaCallbackUrl,
  navigateToCardFailed,
} from '@services/payment/vivaFlow';
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
import {KioskIdleActivityProvider} from '../context/KioskIdleActivityContext';
import {useKioskIdleTimeout} from '@hooks/useKioskIdleTimeout';
import {linking} from './linking';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function DeepLinkBridge(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setPhase = usePaymentStore(s => s.setPhase);
  const setDeepLink = usePaymentStore(s => s.setDeepLink);

  useEffect(() => {
    const handleUrl = (url: string) => {
      if (__DEV__) {
        console.log(`[VivaFlow] Callback URL received: ${url}`);
      }
      if (!isVivaCallbackUrl(url)) {
        if (__DEV__) {
          console.log('[VivaFlow] Ignoring non-Viva deep link');
        }
        return;
      }
      setDeepLink(url);
      const fields = parseVivaCallbackUrl(url);
      if (__DEV__) {
        console.log(
          `[VivaFlow] Callback parsed status=${fields.status ?? 'null'} action=${fields.action ?? 'null'} txId=${fields.transactionId ?? 'null'} clientTxId=${fields.clientTransactionId ?? 'null'} eventId=${fields.transactionEventId ?? 'null'} amount=${fields.amount ?? 'null'} aadeTxId=${fields.aadeTransactionId ?? 'null'} message=${fields.message ?? 'null'}`,
        );
      }
      if (isVivaCallbackSuccess(fields)) {
        if (__DEV__) {
          console.log(
            '[VivaFlow] Callback decision: success -> navigate TransactionReceipt(card)',
          );
        }
        setPhase('success');
        useCartStore.getState().clear();
        useFailedCardPaymentStore.getState().clear();
        navigation.navigate(ROUTES.TransactionReceipt, {
          paymentMethod: 'card',
          attemptId: Date.now(),
        });
        return;
      }
      if (__DEV__) {
        console.log('[VivaFlow] Callback decision: error -> navigate CardFailed');
      }
      setPhase('failed');
      navigateToCardFailed(navigation, fields);
    };

    const sub = Linking.addEventListener('url', ({url}) => {
      if (__DEV__) {
        console.log('[VivaFlow] Linking event url fired');
      }
      handleUrl(url);
    });

    void Linking.getInitialURL().then(url => {
      if (url) {
        if (__DEV__) {
          console.log('[VivaFlow] getInitialURL returned callback URL');
        }
        handleUrl(url);
      } else if (__DEV__) {
        console.log('[VivaFlow] getInitialURL returned empty');
      }
    });

    return () => sub.remove();
  }, [navigation, setDeepLink, setPhase]);

  return <></>;
}

export const AppNavigator = observer(function AppNavigator(): React.JSX.Element {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const booting = useAuthStore(s => s.booting);
  const session = useAuthStore(s => s.session);
  const restore = useAuthStore(s => s.restore);
  const menuReady = useMenuPreloadStore(s => s.ready);
  const menuBootstrapPending = useMenuPreloadStore(s => s.menuBootstrapPending);
  const prerenderComplete = useMenuPreloadStore(s => s.prerenderComplete);
  const language = localizationStore.currentLanguageCode;

  const waitingForMenuPrerender =
    Boolean(session) &&
    menuReady &&
    menuBootstrapPending &&
    !prerenderComplete;
  const showBootOverlay = booting || waitingForMenuPrerender;
  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    if (showBootOverlay) {
      setNavigationReady(false);
    }
  }, [showBootOverlay]);

  useEffect(() => {
    void restore();
  }, [restore]);

  useSubscriptionQuery(Boolean(session));
  useOfflineDrain(Boolean(session));

  const stackTheme: Theme = navigationTheme;
  const idleEnabled = Boolean(session) && !showBootOverlay;
  const {
    resetIdle,
    panHandlers: idlePanHandlers,
    rootTouchProps: idleTouchProps,
    timerActive: idleTimerActive,
  } = useKioskIdleTimeout(navigationRef, idleEnabled, navigationReady);

  return (
    <KioskIdleActivityProvider resetIdle={resetIdle}>
    <View style={styles.appRoot} collapsable={false}>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          theme={stackTheme}
          onReady={() => setNavigationReady(true)}>
      <View
        style={styles.navTouchRoot}
        collapsable={false}
        {...(idleTimerActive ? idleTouchProps : undefined)}
        {...(idleTimerActive ? idlePanHandlers : undefined)}>
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
              options={{headerShown: false, animation: 'none', freezeOnBlur: true}}
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
      </View>
        </NavigationContainer>
      {showBootOverlay ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={theme.color.accentPrimary} />
        </View>
      ) : null}
    </View>
    </KioskIdleActivityProvider>
  );
});

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  navTouchRoot: {
    flex: 1,
  },
  bootOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
  },
});
