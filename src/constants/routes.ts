export const ROUTES = {
  /** Full-screen splash before login */
  Start: 'Start',
  Login: 'Login',
  /** After login — place-order CTA before dine-in / takeaway */
  PlaceOrder: 'PlaceOrder',
  DiningChoice: 'DiningChoice',
  Menu: 'Menu',
  OrderReview: 'OrderReview',
  ProductDetail: 'ProductDetail',
  PaymentMethod: 'PaymentMethod',
  PaymentCard: 'PaymentCard',
  PaymentBank: 'PaymentBank',
  /** Cordova `kiosk_order_finished` — submit cash order + thank-you / receipt */
  TransactionReceipt: 'TransactionReceipt',
  OrderComplete: 'OrderComplete',
  CardFailed: 'CardFailed',
  TaxCustomer: 'TaxCustomer',
  PrinterError: 'PrinterError',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];
