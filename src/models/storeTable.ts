export interface StoreTable {
  id: number;
  descr: string;
  horos: string;
  isdelivery: number;
  always_receipt?: number;
  always_receipt_final?: number;
  /** Links table → `store_premises.id` (legacy `idcategory`). */
  idcategory?: number;
}
