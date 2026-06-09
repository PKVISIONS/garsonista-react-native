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
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ROUTES} from '@constants/routes';
import {useAdminAccessStore, useAuthStore, useMenuPreloadStore, usePaymentStore} from '@store';
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
import {AdminSettingsScreen} from '@screens/AdminSettingsScreen';
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
      if (__DEV__) {
        console.log(`[VivaFlow] Raw Viva callback url len=${url.length}`);
        console.log(`[VivaFlow] Raw Viva callback url preview=${url.slice(0, 240)}`);
      }
      const fields = parseVivaCallbackUrl(url);
      if (__DEV__) {
        console.log(
          `[VivaFlow] Callback parsed status=${fields.status ?? 'null'} action=${fields.action ?? 'null'} txId=${fields.transactionId ?? 'null'} clientTxId=${fields.clientTransactionId ?? 'null'} eventId=${fields.transactionEventId ?? 'null'} amount=${fields.amount ?? 'null'} aadeTxId=${fields.aadeTransactionId ?? 'null'} fiscalLen=${fields.fiscalisationSigningDetails?.length ?? 0} message=${fields.message ?? 'null'}`,
        );
        if (fields.fiscalisationSigningDetails) {
          console.log(
            `[VivaFlow] Callback fiscalisationSigningDetails=${fields.fiscalisationSigningDetails.slice(0, 120)}`,
          );
        }
      }
      if (isVivaCallbackSuccess(fields)) {
        if (__DEV__) {
          console.log(
            '[VivaFlow] Callback decision: success -> navigate TransactionReceipt(card)',
          );
        }
        setPhase('success');
        useFailedCardPaymentStore.getState().clear();
        const parsedOrderNumber = Number(fields.clientTransactionId ?? '');
        navigation.navigate(ROUTES.TransactionReceipt, {
          paymentMethod: 'card',
          orderNumber: Number.isFinite(parsedOrderNumber) ? parsedOrderNumber : undefined,
          transactionId: fields.transactionId ?? undefined,
          clientTransactionId: fields.clientTransactionId ?? undefined,
          aadeTransactionId: fields.aadeTransactionId ?? undefined,
          cardType: fields.cardType ?? undefined,
          accountNumber: fields.accountNumber ?? undefined,
          fiscalisationSigningDetails: fields.fiscalisationSigningDetails ?? undefined,
          attemptId: Date.now(),
          skipCardLaunch: true,
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
  const adminUnlockVisible = useAdminAccessStore(s => s.unlockVisible);
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
  const idleEnabled = Boolean(session) && !showBootOverlay && !adminUnlockVisible;
  const {
    resetIdle,
    panHandlers: idlePanHandlers,
    rootTouchProps: idleTouchProps,
    timerActive: idleTimerActive,
    remainingMs: idleRemainingMs,
  } = useKioskIdleTimeout(navigationRef, idleEnabled, navigationReady);

  const idleWarningVisible = idleTimerActive && idleRemainingMs <= 5_000;
  const idleWarningRemainingMs = Math.min(idleRemainingMs, 5_000);
  const idleWarningSeconds = Math.ceil(idleWarningRemainingMs / 1000);
  const idleWarningProgress = Math.max(idleWarningRemainingMs / 5_000, 0);
  const timerSize = 72;
  const idleTimerTickCount = 28;
  const activeIdleTimerTicks = Math.max(
    0,
    Math.round(idleWarningProgress * idleTimerTickCount),
  );
  const timerFontSize = 18;

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
            <Stack.Screen
              name={ROUTES.AdminSettings}
              component={AdminSettingsScreen}
              options={{headerShown: false, gestureEnabled: false}}
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
      <Modal
        visible={idleWarningVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={resetIdle}>
        <Pressable
          style={styles.idleWarningModal}
          onPress={resetIdle}
          accessibilityRole="button"
          accessibilityLabel="Αναμονή αδράνειας">
          <View style={[styles.idleWarningCard]}>
            <View style={styles.idleWarningTimerWrap} pointerEvents="none">
              <View
                style={[
                  styles.idleTimerRing,
                  {
                    width: timerSize,
                    height: timerSize,
                    borderRadius: timerSize / 2,
                  },
                ]}>
                <View style={styles.idleTimerTickContainer}>
                  {Array.from({length: idleTimerTickCount}).map((_, index) => {
                    const angle =
                      (index / idleTimerTickCount) * (Math.PI * 2) - Math.PI / 2;
                    const markerRadius = timerSize / 2 - 5;
                    const x = timerSize / 2 + markerRadius * Math.cos(angle);
                    const y = timerSize / 2 + markerRadius * Math.sin(angle);
                    const isActive = index < activeIdleTimerTicks;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.idleTimerTick,
                          isActive
                            ? styles.idleTimerTickActive
                            : styles.idleTimerTickInactive,
                          {
                            left: x - 1.5,
                            top: y - 4,
                            transform: [{rotate: `${((angle * 180) / Math.PI) + 90}deg`}],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                <View style={styles.idleTimerFace}>
                  <Text style={[styles.idleTimerText, {fontSize: timerFontSize}]}>
                    {idleWarningSeconds}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.idleWarningText}>
              Πατήστε οπουδήποτε στην οθόνη για να μην χάσετε την πρόοδο της
              παραγγελίας σας
            </Text>
          </View>
        </Pressable>
      </Modal>
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
  idleTimerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  idleTimerTickContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  idleTimerTick: {
    position: 'absolute',
    width: 3,
    height: 8,
    borderRadius: 4,
  },
  idleTimerTickActive: {
    backgroundColor: theme.color.accentPrimary,
  },
  idleTimerTickInactive: {
    backgroundColor: 'rgba(255, 129, 39, 0.22)',
  },
  idleTimerFace: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.color.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleTimerText: {
    fontFamily: theme.font.bold,
    color: theme.color.textPrimary,
    fontWeight: '400',
  },
  idleWarningModal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: 24,
  },
  idleWarningCard: {
    backgroundColor: theme.color.bgPrimary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
  },
  idleWarningTimerWrap: {
    marginBottom: 14,
  },
  idleWarningText: {
    fontFamily: theme.font.regular,
    fontSize: 18,
    lineHeight: 26,
    color: theme.color.textPrimary,
    textAlign: 'center',
  },
  bootOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
  },
});
