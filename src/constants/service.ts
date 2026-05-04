/**
 * Legacy API expects a `tableid` on orders. Physical table selection was
 * removed from the kiosk — all orders use this id (same as the old takeaway path).
 */
export const KIOSK_ORDER_TABLE_ID = 0;
