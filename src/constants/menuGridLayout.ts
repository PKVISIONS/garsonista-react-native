import {MENU_GRID_GAP, PRODUCT_LIST_H_PAD} from '@constants/menuLayout';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Must match `MenuScreen` header block (logo + padding). */
export const MENU_HEADER_HEIGHT = 116;
/** Must match `MenuScreen` footer block (cart row + buttons). */
export const MENU_FOOTER_HEIGHT = 130;

export type MenuGridLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  leftRailWidth: number;
  cardWidth: number;
};

/** Synchronous menu product-column frame — same on boot prerender and when Menu is open. */
export function computeMenuGridLayout(
  screenWidth: number,
  windowHeight: number,
  topInset: number,
  bottomInset: number,
): MenuGridLayout {
  const leftRailWidth = Math.round(clamp(screenWidth * 0.195, 142, 240));
  const gridInner = screenWidth - leftRailWidth - PRODUCT_LIST_H_PAD;
  const cardWidth = Math.max(
    0,
    Math.floor((gridInner - 2 * MENU_GRID_GAP) / 3),
  );

  return {
    x: leftRailWidth,
    y: topInset + MENU_HEADER_HEIGHT,
    width: screenWidth - leftRailWidth,
    height:
      windowHeight -
      topInset -
      bottomInset -
      MENU_HEADER_HEIGHT -
      MENU_FOOTER_HEIGHT,
    leftRailWidth,
    cardWidth,
  };
}
