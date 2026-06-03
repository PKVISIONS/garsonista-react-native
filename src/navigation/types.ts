export type RootStackParamList = {
  Start: undefined;
  Login: undefined;
  PlaceOrder: undefined;
  DiningChoice: undefined;
  Menu: {serviceType?: 'dine-in' | 'takeaway'};
  OrderReview: undefined;
  ProductDetail: {productId: number};
  PaymentMethod: undefined;
  PaymentCard: {
    amountEuros: number;
    clientTransactionId: string;
    fiscalisationData?: string;
    orderNumber?: number;
  };
  PaymentBank: undefined;
  TransactionReceipt:
    | {
        paymentMethod?: 'cash' | 'card';
        /** Set when receipt was already printed (e.g. cash at payment screen). */
        orderNumber?: number;
        receiptPrinted?: boolean;
        /** Prevents the receipt screen from re-opening the Viva intent after callback. */
        skipCardLaunch?: boolean;
        transactionId?: string;
        clientTransactionId?: string;
        aadeTransactionId?: string;
        cardType?: string;
        accountNumber?: string;
        fiscalisationSigningDetails?: string;
        /** Bumps when retrying card/cash after failure so submit runs again. */
        attemptId?: number;
      }
    | undefined;
  OrderComplete: undefined;
  CardFailed: undefined;
  TaxCustomer: undefined;
  PrinterError: {message?: string};
};
