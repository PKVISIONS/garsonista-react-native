export interface Category {
  id: number;
  name: string;
  nameEn?: string | null;
  parentId: number | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface Product {
  id: number;
  name: string;
  nameEn?: string | null;
  categoryId: number;
  imageUrl: string | null;
  /** API fields `ldescr` / `ldescr_en` — long description under title in product modal basket */
  longDescription: string | null;
  longDescriptionEn?: string | null;
  basePrice: number;
  taxRate: number;
  taxIncluded: boolean;
  available: boolean;
}

export interface OptionGroup {
  id: number;
  productId: number;
  name: string;
  nameEn?: string | null;
  required: boolean;
  multiSelect: boolean;
  values: OptionValue[];
}

export interface OptionValue {
  id: number;
  groupId: number;
  name: string;
  nameEn?: string | null;
  priceDelta: number;
  imageUrl?: string | null;
  /** `activate_idproduct_option` — show this option group only when this value is selected. */
  activatesGroupId?: number | null;
  groupName?: string | null;
  forGrouping?: number | string | null;
  flatPrice?: number | string | null;
  /** `option_values[].multiqty` — allows selecting more than one quantity of this modifier. */
  multiQty?: boolean;
}
