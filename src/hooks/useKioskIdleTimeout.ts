import {CommonActions} from '@react-navigation/native';
import type {NavigationContainerRefWithCurrent} from '@react-navigation/native';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {ViewProps} from 'react-native';
import {KIOSK_IDLE_TIMEOUT_MS} from '@constants/kioskFlow';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {revertPendingCardSaleIfNeeded} from '@services/payment/cardPaymentRecovery';
import {useCartStore} from '@store';
import {useFailedCardPaymentStore} from '../stores/Payment/FailedCardPaymentStore';
import {usePaymentStore} from '../stores/Payment/PaymentStore';
import {useIdleTimer} from './useIdleTimer';

/** No idle countdown on entry / auth screens — only after leaving these. */
const HOME_ROUTES = new Set<string>([
  ROUTES.PlaceOrder,
  ROUTES.Login,
  ROUTES.Start,
]);

type RootTouchProps = Pick<ViewProps, 'onTouchStart'>;

export function useKioskIdleTimeout(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  enabled: boolean,
  navigationReady: boolean,
): {
  resetIdle: () => void;
  remainingMs: number;
  rootTouchProps: RootTouchProps;
  panHandlers: ReturnType<typeof useIdleTimer>['panHandlers'];
  /** True when the 20s countdown is running (not on home / first screen). */
  timerActive: boolean;
} {
  const clearCart = useCartStore(s => s.clear);
  const activeRouteRef = useRef<string | undefined>(undefined);
  const [activeRoute, setActiveRoute] = useState<string | undefined>();

  const syncActiveRoute = useCallback(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    const name = navigationRef.getCurrentRoute()?.name;
    activeRouteRef.current = name;
    setActiveRoute(name);
  }, [navigationRef]);

  const timerActive =
    enabled &&
    navigationReady &&
    activeRoute != null &&
    !HOME_ROUTES.has(activeRoute);

  const onIdle = useCallback(() => {
    if (!timerActive || !navigationRef.isReady()) {
      return;
    }
    syncActiveRoute();
    const route = activeRouteRef.current;
    if (!route || HOME_ROUTES.has(route)) {
      return;
    }
    if (__DEV__) {
      console.log(`[IdleTimeout] ${KIOSK_IDLE_TIMEOUT_MS}ms idle on ${route} -> PlaceOrder`);
    }
    void revertPendingCardSaleIfNeeded();
    clearCart();
    useFailedCardPaymentStore.getState().clear();
    usePaymentStore.getState().reset();
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: ROUTES.PlaceOrder}],
      }),
    );
  }, [clearCart, navigationRef, syncActiveRoute, timerActive]);

  const {panHandlers, rootTouchProps, resetIdle, remainingMs} = useIdleTimer(
    KIOSK_IDLE_TIMEOUT_MS,
    onIdle,
    timerActive,
  );

  const resetIdleRef = useRef(resetIdle);
  resetIdleRef.current = resetIdle;

  useEffect(() => {
    if (!enabled || !navigationReady || !navigationRef.isReady()) {
      return;
    }
    syncActiveRoute();
    return navigationRef.addListener('state', () => {
      const prev = activeRouteRef.current;
      syncActiveRoute();
      const next = activeRouteRef.current;
      if (next && !HOME_ROUTES.has(next) && (!prev || HOME_ROUTES.has(prev))) {
        resetIdleRef.current();
      }
    });
  }, [enabled, navigationReady, navigationRef, syncActiveRoute]);

  return {
    resetIdle,
    panHandlers,
    rootTouchProps,
    remainingMs,
    timerActive,
  };
}
