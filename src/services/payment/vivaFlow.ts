import type {NavigationProp, ParamListBase} from '@react-navigation/native';
import {ROUTES} from '@constants/routes';
import type {Cart} from '@models/cart';
import type {RootStackParamList} from '@navigation/types';
import {revertSaleKiosk} from '@services/paymentService';
import {
  captureFailedCardAttempt,
  captureFailedCardFromVivaCallback,
  idtaxdocumentFromClientTransactionId,
} from './cardPaymentRecovery';
import {parseVivaCallbackUrl, type VivaCallbackFields} from './vivaCallbackParser';
import {useCartStore} from '../../stores/Cart/CartStore';
import {useFailedCardPaymentStore} from '../../stores/Payment/FailedCardPaymentStore';

/** True when the URL is a return from Viva Pay (not a generic app deep link). */
export function isVivaCallbackUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('viva-return')) {
    return true;
  }
  if (
    !lower.startsWith('garsonista_offline://') &&
    !lower.includes('garsonista.datapp.gr')
  ) {
    return false;
  }
  const fields = parseVivaCallbackUrl(url);
  return Boolean(
    fields.status ||
      fields.clientTransactionId ||
      fields.transactionId ||
      fields.action,
  );
}

export function isVivaCallbackSuccess(fields: VivaCallbackFields): boolean {
  const status = (fields.status ?? '').toLowerCase();
  return status === 'success' || status === 'ok';
}

export function revertVivaSaleIfNeeded(
  clientTransactionId: string | null | undefined,
): void {
  const idtaxdocument = idtaxdocumentFromClientTransactionId(clientTransactionId);
  if (!idtaxdocument) {
    return;
  }
  useFailedCardPaymentStore.getState().setIdtaxdocument(idtaxdocument);
  void revertSaleKiosk(idtaxdocument).catch(() => {
    /* non-blocking */
  });
}

type PaymentNavigation = Pick<
  NavigationProp<ParamListBase>,
  'navigate' | 'dispatch'
>;

export function navigateToCardFailed(
  navigation: PaymentNavigation,
  fields?: VivaCallbackFields,
  options?: {cart?: Cart | null; orderNumber?: number | null},
): void {
  const cart = options?.cart ?? useCartStore.getState().cart;
  const orderNumber =
    options?.orderNumber ?? useFailedCardPaymentStore.getState().orderNumber;
  if (fields) {
    captureFailedCardFromVivaCallback(fields, cart, orderNumber);
    revertVivaSaleIfNeeded(fields.clientTransactionId);
  } else if (cart && orderNumber != null) {
    captureFailedCardAttempt(cart, orderNumber);
  }
  navigation.navigate(ROUTES.CardFailed);
}
