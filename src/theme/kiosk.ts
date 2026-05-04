/**
 * Garsonista kiosk design tokens (aligned with `www/css/main.css`, `head.css`) — colors, spacing, radii, shadows.
 * Use `theme` everywhere; avoid raw hex outside this file.
 */
import type {ImageStyle, TextStyle, ViewStyle} from 'react-native';
import {Platform} from 'react-native';
import type {Theme} from '@react-navigation/native';

/**
 * App UI typeface — same as Cordova `www/css/w3.css` / `www/css/main.css`: `font-family: 'Averta', sans-serif`
 * with `www/css/fonts/Averta-Regular.ttf`, `Averta-Bold.ttf`, `TW-Averta-Semibold.ttf` (from Cordova `www/css` fonts, linked into RN).
 * Use `theme.font` + `defaultProps` in `App.tsx`; for emphatic text prefer `fontFamily: theme.font.bold` with `fontWeight: '400'` on Android.
 */
const fonts = {
  regular: 'Averta-Regular',
  semibold: 'TW-Averta-Semibold',
  bold: 'Averta-Bold',
} as const;

const palette = {
  textPrimary: '#000000',
  textSecondary: '#666666',
  textMuted: '#888888',
  textLabel: '#555555',
  bgPrimary: '#FFFFFF',
  bgSecondary: '#EFEFEF',
  bgMuted: '#EBEBEB',
  bgModal: '#E8E8E8',
  accentPrimary: '#FF8127',
  accentPressed: '#E6731F',
  accentSecondary: '#FF6400',
  danger: '#DC2626',
  border: '#E0E0E0',
  inputBorder: '#E6E6E6',
  pricePillBg: '#F1F5F9',
  pricePillText: '#000000',
  loginButtonBg: '#333333',
  borderSubtle: 'rgba(0, 0, 0, 0.08)',
  onAccent: '#FFFFFF',
  textDisabled: 'rgba(0, 0, 0, 0.38)',
  menuComboPricePillBg: '#F0F2F5',
  /** Product modal content + add-to-cart footer band */
  productDetailPageBg: '#E8E8E8',
  /** Hero placeholder when no product image */
  productHeroOrange: '#FF6600',
  /** Quantity control strip background */
  qtyControlBg: '#EFEFEF',
} as const;

export const spaceScale = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
} as const;

export const theme = {
  color: {
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    textMuted: palette.textMuted,
    textLabel: palette.textLabel,
    bgPrimary: palette.bgPrimary,
    bgSecondary: palette.bgSecondary,
    bgMuted: palette.bgMuted,
    bgModal: palette.bgModal,
    accentPrimary: palette.accentPrimary,
    accentPressed: palette.accentPressed,
    accentSecondary: palette.accentSecondary,
    danger: palette.danger,
    border: palette.border,
    inputBorder: palette.inputBorder,
    pricePillBg: palette.pricePillBg,
    pricePillText: palette.pricePillText,
    loginButtonBg: palette.loginButtonBg,
    borderSubtle: palette.borderSubtle,
    onAccent: palette.onAccent,
    textDisabled: palette.textDisabled,
    menuComboPricePillBg: palette.menuComboPricePillBg,
    productDetailPageBg: palette.productDetailPageBg,
    productHeroOrange: palette.productHeroOrange,
    qtyControlBg: palette.qtyControlBg,
  },
  space: {
    ...spaceScale,
    xs: spaceScale[1],
    sm: spaceScale[2],
    md: spaceScale[3],
    lg: spaceScale[4],
    xl: spaceScale[6],
    xxl: spaceScale[8],
  },
  radius: {
    sm: 6,
    button: 15,
    input: 2,
    card: 16,
    large: 15,
    badge: 14,
    pill: 999,
    loginCta: 27,
  },
  motion: {
    durationFast: 120,
    durationBase: 200,
  },
  /**
   * Cordova: `Averta` (web); RN uses per-file `fontFamily` (same TTFs as `www/css/fonts` + `w3.css` @font-face).
   * @see `App.tsx` `Text` / `TextInput` `defaultProps` for base body.
   */
  font: fonts,
} as const;

export const shadowBurgerCard: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  android: {elevation: 2},
  default: {},
});

export const shadowChoiceCard: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.13,
    shadowRadius: 4,
  },
  android: {elevation: 3},
  default: {},
});

export const shadowFooterUp: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  android: {elevation: 12},
  default: {},
});

export const cardShadow: ViewStyle = shadowBurgerCard;

/** Screen titles — kiosk headings (~22px / ~18px bold). */
export const titleHero: TextStyle = {
  fontFamily: fonts.bold,
  fontSize: 22,
  lineHeight: 28,
  fontWeight: '400',
  color: palette.textPrimary,
  letterSpacing: -0.2,
};

export const titleSection: TextStyle = {
  fontFamily: fonts.semibold,
  fontSize: 18,
  lineHeight: 24,
  fontWeight: '400',
  color: palette.textPrimary,
};

export const bodyMuted: TextStyle = {
  fontFamily: fonts.regular,
  fontSize: 14,
  lineHeight: 20,
  fontWeight: '400',
  color: palette.textSecondary,
};

/** `.txt1` helper / small captions */
export const typeCaptionSm: TextStyle = {
  fontFamily: fonts.regular,
  fontSize: 12,
  lineHeight: 16,
  fontWeight: '400',
  color: palette.textSecondary,
};

/**
 * DFC / `kiosk_image3` strip at the very top. Use everywhere **except** `MenuScreen` (`menuHeaderBrandLogo` stays bar-specific there).
 */
export const kioskTopBrandLogo: ImageStyle = {
  width: 350,
  height: 100,
  maxWidth: '85%',
};

export const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: palette.accentPrimary,
    background: palette.bgPrimary,
    card: palette.bgPrimary,
    text: palette.textPrimary,
    border: palette.borderSubtle,
    notification: palette.danger,
  },
  fonts: {
    regular: {fontFamily: fonts.regular, fontWeight: '400'},
    medium: {fontFamily: fonts.semibold, fontWeight: '400'},
    bold: {fontFamily: fonts.bold, fontWeight: '400'},
    heavy: {fontFamily: fonts.bold, fontWeight: '400'},
  },
};
