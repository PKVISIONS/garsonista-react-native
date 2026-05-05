export type RootStackParamList = {
  Start: undefined;
  Login: undefined;
  PlaceOrder: undefined;
  DiningChoice: undefined;
  Menu: {serviceType?: 'dine-in' | 'takeaway'};
  OrderReview: undefined;
  ProductDetail: {productId: number};
  PaymentMethod: undefined;
  PaymentCard: {amountEuros: number};
  PaymentBank: undefined;
  TransactionReceipt: {paymentMethod: 'cash' | 'card'; orderNumber: number};
  OrderComplete: undefined;
  CardFailed: undefined;
  TaxCustomer: undefined;
  PrinterError: {message?: string};
};
