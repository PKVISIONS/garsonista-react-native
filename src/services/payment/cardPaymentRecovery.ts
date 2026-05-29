import {CommonActions} from '@react-navigation/native';
import type {NavigationProp, ParamListBase} from '@react-navigation/native';
import {ROUTES} from '@constants/routes';
import type {Cart} from '@models/cart';
import type {RootStackParamList} from '@navigation/types';
import {
  buildReceiptPrintContext,
  ensureReceiptCatalogPremises,
} from '@utils/receiptCompanyContext';
import {printFinalReceipt} from '@services/printing/printerService';
import {revertSaleKiosk} from '@services/paymentService';
import {nextTicketNumber} from '@services/ticketCounter';
import {useAuthStore, useCatalogStore} from '@store';
import {useFailedCardPaymentStore} from '../../stores/Payment/FailedCardPaymentStore';
import {useCartStore} from '../../stores/Cart/CartStore';
import {usePaymentStore} from '../../stores/Payment/PaymentStore';
import type {VivaCallbackFields} from './vivaCallbackParser';

const tableLabelFor = (type: 'dine-in' | 'takeaway', tableId: number) =>
  type === 'dine-in' ? `Τραπέζι ${tableId}` : 'Takeaway';

export function idtaxdocumentFromClientTransactionId(
  clientTransactionId: string | null | undefined,
): string | null {
  const clientTxId = String(clientTransactionId ?? '');
  if (!clientTxId.startsWith('AUTX') || clientTxId.length <= 4) {
    return null;
  }
  return clientTxId.slice(4);
}

export function captureFailedCardAttempt(
  cart: Cart,
  orderNumber: number,
  idtaxdocument?: string | null,
): void {
  useFailedCardPaymentStore.getState().saveAttempt(cart, orderNumber, idtaxdocument);
}

export function captureFailedCardFromVivaCallback(
  fields: VivaCallbackFields,
  cart: Cart | null,
  orderNumber: number | null,
): void {
  const idtax =
    idtaxdocumentFromClientTransactionId(fields.clientTransactionId) ??
    useFailedCardPaymentStore.getState().idtaxdocument;
  const snap = cart ?? useCartStore.getState().cart;
  if (snap) {
    useFailedCardPaymentStore
      .getState()
      .saveAttempt(snap, orderNumber ?? useFailedCardPaymentStore.getState().orderNumber ?? nextTicketNumber(), idtax);
  } else if (idtax) {
    useFailedCardPaymentStore.getState().setIdtaxdocument(idtax);
  }
}

export async function revertPendingCardSaleIfNeeded(): Promise<void> {
  const idtax = useFailedCardPaymentStore.getState().idtaxdocument;
  if (!idtax) {
    return;
  }
  try {
    await revertSaleKiosk(idtax);
  } catch {
    /* non-blocking */
  }
}

type PaymentNavigation = Pick<
  NavigationProp<ParamListBase>,
  'navigate' | 'dispatch'
>;

export function retryCardPayment(navigation: PaymentNavigation): void {
  const cart = useFailedCardPaymentStore.getState().restoreCart();
  if (!cart) {
    navigation.navigate(ROUTES.PaymentMethod);
    return;
  }
  usePaymentStore.getState().reset();
  const ticket = nextTicketNumber();
  navigation.navigate(ROUTES.TransactionReceipt, {
    paymentMethod: 'card',
    orderNumber: ticket,
    attemptId: Date.now(),
  });
}

export async function payWithCashAfterCardFailure(
  navigation: PaymentNavigation,
): Promise<void> {
  const cart = useFailedCardPaymentStore.getState().restoreCart();
  const session = useAuthStore.getState().session;
  const wireRow = useAuthStore.getState().wireRow;
  if (!cart || !session) {
    navigation.navigate(ROUTES.PaymentMethod);
    return;
  }
  await revertPendingCardSaleIfNeeded();
  const ticket = nextTicketNumber();
  try {
    const catalog = await ensureReceiptCatalogPremises(
      useCatalogStore.getState().data,
    );
    if (catalog && catalog.storePremises.length > 0) {
      useCatalogStore.getState().setBootstrap(catalog);
    }
    await printFinalReceipt(
      session,
      cart,
      buildReceiptPrintContext(wireRow, cart, {
        orderNumber: ticket,
        createdAt: new Date(),
        paymentMethod: 'cash',
        tableLabel: tableLabelFor(cart.type, cart.tableId),
        serviceLabel: cart.type === 'dine-in' ? 'Κατανάλωση στο χώρο' : 'Takeaway',
      }, catalog),
    );
  } catch {
    /* continue */
  }
  useFailedCardPaymentStore.getState().clear();
  usePaymentStore.getState().reset();
  navigation.navigate(ROUTES.TransactionReceipt, {
    paymentMethod: 'cash',
    orderNumber: ticket,
    receiptPrinted: true,
    attemptId: Date.now(),
  });
}

export async function cancelFailedCardPayment(
  navigation: PaymentNavigation,
): Promise<void> {
  await revertPendingCardSaleIfNeeded();
  useFailedCardPaymentStore.getState().clear();
  useCartStore.getState().clear();
  usePaymentStore.getState().reset();
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{name: ROUTES.PlaceOrder}],
    }),
  );
}
