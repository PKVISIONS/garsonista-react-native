/**
 * Product / combo detail — mirrors reference kiosk CSS (`www/css/main.css`, `www/css/head.css`):
 * - `.kiosk-product-modal-content` / `#E8E8E8`
 * - `#id01-new-product-con-image2` — full width, height from image aspect (see `heroLayout`); cap uses `cover`
 * - `.kiosk-modifiers-basket-box` summary card
 * - `#modif_section` horizontal padding 15px
 * - `input.moditem+label` / `:checked+label` option tiles
 * - `.kiosk-add-btn-section` + `.general_btn` / `.general_btn2` + `.kiosk-add-btn-qty-control`
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import type {OptionGroup, OptionValue, SelectedOption} from '@models';
import {priceProductsForTable} from '@services/catalogService';
import {useAuthStore} from '@store/authStore';
import {useCartStore} from '@store/cartStore';
import {useCatalogStore} from '@store/catalogStore';
import {cardShadow, shadowBurgerCard, theme} from '@theme/kiosk';
import {pickCatalogText} from '@utils/catalogText';
import {
  imagesBaseUrlFromWireRow,
  productImageSource,
  resolveProductImageUri,
} from '@utils/productImage';
import {ProductGridImage} from '../ProductGridImage';
import {localizationStore, translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.ProductDetail>;

/** Fallback / loading height before `Image.getSize` — Cordova used 500px. */
const PRODUCT_DETAIL_HERO_PX = 500;
/** Clamp natural height: wide shots get a floor; very tall product shots get a cap (use `cover` at cap). */
const PRODUCT_DETAIL_HERO_MIN_PX = 200;
const PRODUCT_DETAIL_HERO_MAX_PX = 800;
/** Cordova `#content-3-add`: `max-width: 550px; border-radius: 15px; margin-top: 20px; background: #fff` */
const PRODUCT_DETAIL_HERO_CARD_TOP = 0;

function formatEuro(n: number): string {
  return `${n.toFixed(2).replace('.', ',')}€`;
}

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push(arr.slice(i, i + 2));
  }
  return out;
}

export function ProductDetailScreen({navigation, route}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const {width: windowWidth} = useWindowDimensions();
  const heroCardWidth = windowWidth;

  const {productId} = route.params;
  const imagesBaseUrl = useAuthStore(s => imagesBaseUrlFromWireRow(s.wireRow));
  const data = useCatalogStore(s => s.data);
  const addItem = useCartStore(s => s.addItem);
  const cart = useCartStore(s => s.cart);
  const lang = localizationStore.currentLanguageCode;
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<Record<number, number[]>>({});

  const product = useMemo(() => {
    const raw = data?.products.find(p => p.id === productId);
    if (!raw || !cart) {
      return undefined;
    }
    const rows = data?.productPrices ?? [];
    return rows.length > 0
      ? priceProductsForTable([raw], rows, cart.tableId)[0]
      : raw;
  }, [data, productId, cart]);

  /** Remote URI for hero `Image.getSize` (same asset as `productImageSource` below). */
  const productHeroUri = useMemo(() => {
    if (!data || !cart) {
      return null;
    }
    const raw = data.products.find(p => p.id === productId);
    if (!raw) {
      return null;
    }
    const src = productImageSource(raw.imageUrl, imagesBaseUrl);
    if (!src || typeof (src as {uri: string}).uri !== 'string') {
      return null;
    }
    return (src as {uri: string}).uri;
  }, [data, productId, cart, imagesBaseUrl]);

  const [heroIntrinsic, setHeroIntrinsic] = useState<{w: number; h: number} | null>(
    null,
  );

  useEffect(() => {
    setHeroIntrinsic(null);
    if (!productHeroUri) {
      return;
    }
    let cancelled = false;
    Image.getSize(
      productHeroUri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) {
          setHeroIntrinsic({w, h});
        }
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [productHeroUri]);

  const heroLayout = useMemo(() => {
    if (!heroIntrinsic) {
      return {
        displayH: PRODUCT_DETAIL_HERO_PX,
        resizeMode: 'contain' as const,
      };
    }
    const naturalH = (heroCardWidth * heroIntrinsic.h) / heroIntrinsic.w;
    const displayH = Math.max(
      PRODUCT_DETAIL_HERO_MIN_PX,
      Math.min(PRODUCT_DETAIL_HERO_MAX_PX, Math.round(naturalH)),
    );
    if (naturalH > PRODUCT_DETAIL_HERO_MAX_PX) {
      return {displayH, resizeMode: 'cover' as const};
    }
    if (naturalH < PRODUCT_DETAIL_HERO_MIN_PX) {
      return {displayH: PRODUCT_DETAIL_HERO_MIN_PX, resizeMode: 'contain' as const};
    }
    return {displayH, resizeMode: 'contain' as const};
  }, [heroCardWidth, heroIntrinsic]);

  const optionGroups = useMemo(() => {
    const list = data?.optionGroups.filter(g => g.productId === productId) ?? [];
    const seen = new Set<number>();
    return list.filter(g => {
      if (seen.has(g.id)) {
        return false;
      }
      seen.add(g.id);
      return true;
    });
  }, [data, productId]);

  /** Required groups with a single choice are pre-selected; multi-choice required are not highlighted in the title. */
  useLayoutEffect(() => {
    setSelections(prev => {
      const next: Record<number, number[]> = {...prev};
      let changed = false;
      const validIds = new Set(optionGroups.map(g => g.id));
      for (const key of Object.keys(next)) {
        const id = Number(key);
        if (!validIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      for (const g of optionGroups) {
        if (g.required && g.values.length === 1) {
          const only = g.values[0];
          if (only && (next[g.id]?.length ?? 0) === 0) {
            next[g.id] = [only.id];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [productId, optionGroups]);

  const toggleOption = useCallback((group: OptionGroup, valueId: number) => {
    setSelections(prev => {
      const cur = prev[group.id] ?? [];
      if (group.multiSelect) {
        const set = new Set(cur);
        if (set.has(valueId)) {
          set.delete(valueId);
        } else {
          set.add(valueId);
        }
        return {...prev, [group.id]: [...set]};
      }
      return {...prev, [group.id]: [valueId]};
    });
  }, []);

  const selectedOptions: SelectedOption[] = useMemo(() => {
    const out: SelectedOption[] = [];
    for (const g of optionGroups) {
      const ids = selections[g.id] ?? [];
      for (const id of ids) {
        const v = g.values.find(x => x.id === id);
        if (v) {
          out.push({
            groupId: g.id,
            valueId: v.id,
            label: pickCatalogText(lang, v.name, v.nameEn),
            priceDelta: v.priceDelta,
          });
        }
      }
    }
    return out;
  }, [lang, optionGroups, selections]);

  const optionsExtra = useMemo(
    () => selectedOptions.reduce((s, o) => s + o.priceDelta, 0),
    [selectedOptions],
  );

  const unitWithOptions = product ? product.basePrice + optionsExtra : 0;
  const lineTotal = unitWithOptions * qty;

  if (!product || !cart) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{translate('kiosk.product.notFound')}</Text>
      </View>
    );
  }

  const imgSrc = productImageSource(product.imageUrl, imagesBaseUrl);

  const onAdd = () => {
    for (const g of optionGroups) {
      if (g.required) {
        const sel = selections[g.id] ?? [];
        if (sel.length === 0) {
          Alert.alert(
            translate('kiosk.product.optionRequiredTitle'),
            translate('kiosk.product.selectOption').replace(
              '{{name}}',
              pickCatalogText(lang, g.name, g.nameEn),
            ),
            [{text: translate('kiosk.product.ok')}],
          );
          return;
        }
      }
    }
    addItem({
      productId: product.id,
      productName: pickCatalogText(lang, product.name, product.nameEn),
      unitPrice: unitWithOptions,
      quantity: qty,
      selectedOptions,
      lineTotal,
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, {width: windowWidth}]} edges={['top']}>
      <View style={[styles.page, {width: windowWidth}]}>
        {/**
         * Hero: width = screen; height = natural aspect at that width (no side letterboxing);
         * very tall images capped (cover); wide images get min height (contain).
         */}
        <View
          style={[
            styles.heroCard,
            {
              width: heroCardWidth,
              marginTop: PRODUCT_DETAIL_HERO_CARD_TOP,
            },
          ]}>
          <View
            style={[
              styles.heroImageFrame,
              {height: heroLayout.displayH, width: heroCardWidth},
            ]}>
            {imgSrc ? (
              <Image
                source={imgSrc}
                style={styles.heroImage}
                resizeMode={heroLayout.resizeMode}
                fadeDuration={Platform.OS === 'android' ? 0 : undefined}
                onLoad={e => {
                  const w = e.nativeEvent.source?.width;
                  const h = e.nativeEvent.source?.height;
                  if (w > 0 && h > 0) {
                    setHeroIntrinsic(cur => (cur ? cur : {w, h}));
                  }
                }}
              />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, styles.scrollContentGrow]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.scrollInner}>
          {/* `.kiosk-modifiers-basket-box` */}
          <View style={styles.basketBox}>
            {/* `.kiosk-modifiers-basket-table` + title + `.kiosk-modifiers-basket-desc` */}
            <View style={styles.basketTable}>
              <View style={styles.basketLeft}>
                {/* server-provided — not localizable via translate() */}
                <Text style={styles.basketTitle} numberOfLines={2}>
                  {pickCatalogText(lang, product.name, product.nameEn)}
                </Text>
                {pickCatalogText(
                  lang,
                  product.longDescription,
                  product.longDescriptionEn,
                ) ? (
                  <Text style={styles.basketDesc}>
                    {pickCatalogText(
                      lang,
                      product.longDescription,
                      product.longDescriptionEn,
                    )}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.basketPrice}>{formatEuro(unitWithOptions)}</Text>
            </View>
          </View>

          {optionGroups.map(group => (
            <View key={group.id} style={styles.section}>
              {/* server-provided — not localizable via translate() */}
              <Text style={styles.sectionTitle}>
                {pickCatalogText(lang, group.name, group.nameEn)}
                {group.required ? (
                  <Text style={styles.sectionRequiredAsterisk}> *</Text>
                ) : null}
              </Text>
              {chunkPairs(group.values).map((pair, rowIdx) => (
                <View key={`${group.id}-${rowIdx}`} style={styles.optionRow}>
                  {pair.map((v: OptionValue) => (
                    <OptionTile
                      key={v.id}
                      lang={lang}
                      value={v}
                      selected={(selections[group.id] ?? []).includes(v.id)}
                      imagesBaseUrl={imagesBaseUrl}
                      onPress={() => toggleOption(group, v.id)}
                    />
                  ))}
                  {pair.length === 1 ? <View style={styles.optionHalf} /> : null}
                </View>
              ))}
            </View>
          ))}
          </View>
        </ScrollView>

        {/* `.kiosk-add-btn-section` — same #E8E8E8 as page; padding 30px */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          <Pressable
            style={({pressed}) => [styles.generalBtn, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}>
            <Text style={styles.generalBtnText}>{translate('kiosk.product.cancel')}</Text>
          </Pressable>

          <View style={styles.footerQty}>
            <Pressable
              style={styles.qtyControl}
              onPress={() => setQty(q => Math.max(1, q - 1))}>
              <Text style={styles.qtyControlText}>−</Text>
            </Pressable>
            <Text style={styles.qtyText}>{qty}</Text>
            <Pressable
              style={styles.qtyControl}
              onPress={() => setQty(q => q + 1)}>
              <Text style={styles.qtyControlText}>+</Text>
            </Pressable>
          </View>

          <Pressable
            style={({pressed}) => [
              styles.generalBtn2,
              pressed && styles.pressed,
            ]}
            onPress={onAdd}>
            <Text style={styles.generalBtn2Text} numberOfLines={1}>
              {formatEuro(lineTotal)} {translate('kiosk.product.add')}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** `scrollInner` (20+20) + `optionRow` gap(10) — half column for two-up grid, same as menu. */
function useOptionTileWidth(): number {
  const {width: windowWidth} = useWindowDimensions();
  return Math.max(0, Math.floor((windowWidth - 50) / 2));
}

function OptionTile({
  lang,
  value,
  selected,
  imagesBaseUrl,
  onPress,
}: {
  lang: string;
  value: OptionValue;
  selected: boolean;
  imagesBaseUrl: string | null;
  onPress: () => void;
}): React.JSX.Element {
  const optionTileW = useOptionTileWidth();
  const imageUri = value.imageUrl
    ? resolveProductImageUri(value.imageUrl, imagesBaseUrl)
    : null;
  const priceLine =
    value.priceDelta !== 0
      ? `${value.priceDelta > 0 ? '+' : ''}${formatEuro(value.priceDelta)}`
      : null;

  if (imageUri) {
    return (
      <Pressable
        style={({pressed}) => [
          styles.optionHalf,
          styles.moditemLabel,
          selected ? styles.moditemChecked : styles.moditemUnchecked,
          shadowBurgerCard,
          pressed && styles.pressed,
        ]}
        onPress={onPress}>
        {/* Full image at column width — height from intrinsic aspect (`ProductGridImage`, same idea as product hero) */}
        <View style={styles.optionImageWrap}>
          <ProductGridImage uri={imageUri} width={optionTileW} resizeMode="contain" />
        </View>
        <View style={styles.optionCardBody}>
          <Text
            style={[
              styles.optionTitleWithImage,
              styles.optionTitleFullWidth,
              selected && styles.optionTextOn,
            ]}
            numberOfLines={3}>
            {pickCatalogText(lang, value.name, value.nameEn)}
          </Text>
          {priceLine ? (
            <View
              style={[
                styles.optionPricePill,
                selected && styles.optionPricePillSelected,
              ]}>
              <Text
                style={[
                  styles.optionPricePillText,
                  selected && styles.optionPricePillTextOn,
                ]}
                numberOfLines={1}>
                {priceLine}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({pressed}) => [
        styles.optionHalf,
        styles.moditemLabel,
        styles.moditemTextOnly,
        selected ? styles.moditemChecked : styles.moditemUnchecked,
        shadowBurgerCard,
        pressed && styles.pressed,
      ]}
      onPress={onPress}>
      <View style={styles.optionCardBodyTextOnly}>
        <Text
          style={[
            styles.optionTitle,
            styles.optionTitleFullWidth,
            selected && styles.optionTextOn,
          ]}
          numberOfLines={3}>
          {pickCatalogText(lang, value.name, value.nameEn)}
        </Text>
        {priceLine ? (
          <View
            style={[
              styles.optionPricePill,
              selected && styles.optionPricePillSelected,
            ]}>
            <Text
              style={[
                styles.optionPricePillText,
                selected && styles.optionPricePillTextOn,
              ]}
              numberOfLines={1}>
              {priceLine}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.color.productDetailPageBg,
  },
  page: {
    flex: 1,
    backgroundColor: theme.color.productDetailPageBg,
  },
  scroll: {flex: 1, width: '100%'},
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  scrollContentGrow: {
    flexGrow: 1,
  },
  /** `#modif_section` horizontal padding — not on hero */
  scrollInner: {
    paddingHorizontal: 20,
    width: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.productDetailPageBg,
  },
  err: {color: theme.color.textSecondary, fontSize: 16},

  /** Full-bleed hero card — no side margins, no rounded corners, no background fill. */
  heroCard: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  /** Full width; height from intrinsic aspect (or min/max with contain/cover) */
  heroImageFrame: {
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
  },

  /** Cordova `#basket300`: padding 25px, border-radius 20px, white bg */
  basketBox: {
    marginTop: 20,
    marginBottom: 8,
    padding: 25,
    borderRadius: 20,
    backgroundColor: theme.color.bgPrimary,
    width: '100%',
    ...cardShadow,
  },
  /** Title + description left; price alone on the right, vertically centered vs. the text block */
  basketTable: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  basketLeft: {
    flex: 1,
    minWidth: 0,
  },
  /** Cordova `#id01-new-product-con-descr2`: font-size 16px, bold */
  basketTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.color.textPrimary,
    textAlign: 'left',
  },
  /** Cordova `#id01-new-product-con-ldescr2`: font-size 13px, padding 5px 0 */
  basketDesc: {
    paddingTop: 5,
    paddingBottom: 5,
    fontSize: 13,
    fontWeight: '400',
    color: theme.color.textPrimary,
    textAlign: 'left',
  },
  basketPrice: {
    flexShrink: 0,
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.color.textPrimary,
    textAlign: 'right',
  },

  section: {
    marginTop: 16,
    width: '100%',
  },
  /** "Select" / group heading — centered, strong (reference) */
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    paddingTop: 4,
  },
  sectionRequiredAsterisk: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.color.danger,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  optionHalf: {flex: 1, minWidth: 0},

  /**
   * `input.moditem+label` / `:checked+label` (head.css)
   * border-radius 15px; min-height 54px; shadow; bg #fff / #FF8127
   */
  moditemLabel: {
    borderRadius: 15,
    overflow: 'hidden',
    minHeight: 54,
    width: '100%',
  },
  moditemUnchecked: {
    backgroundColor: theme.color.bgPrimary,
  },
  moditemChecked: {
    backgroundColor: theme.color.accentPrimary,
  },
  /** Text-only: bigger tap/text box than min 54, centered */
  moditemTextOnly: {
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Top strip: full-bleed image, aspect height from `ProductGridImage` (align with `MenuScreen` `cardImageWrap`) */
  optionImageWrap: {
    width: '100%',
    alignSelf: 'stretch',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  /** Body under option photo: title + price, roomier box */
  optionCardBody: {
    width: '100%',
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  optionCardBodyTextOnly: {
    width: '100%',
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  /** Cordova `.alabel_mod`: font-size 13px, font-weight bold — text-only tiles */
  optionTitle: {
    fontWeight: 'bold',
    fontSize: 13,
    lineHeight: 18,
    color: theme.color.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  /** Image option tiles: slightly larger label than text-only; centered */
  optionTitleWithImage: {
    fontWeight: 'bold',
    fontSize: 20,
    lineHeight: 21,
    color: theme.color.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  /** Ensure centered labels use full row width (avoids LTR/RTL off-center) */
  optionTitleFullWidth: {
    alignSelf: 'stretch',
    width: '100%',
    textAlign: 'center',
  },
  optionTextOn: {
    color: theme.color.onAccent,
  },
  optionPricePill: {
    width: '90%',
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignSelf: 'center',
    alignItems: 'center',
  },
  optionPricePillSelected: {
    backgroundColor: 'transparent',
  },
  /** Cordova `.alabel_mod_price`: font-size 13px, bold */
  optionPricePillText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.color.pricePillText,
    textAlign: 'center',
  },
  optionPricePillTextOn: {
    color: theme.color.onAccent,
  },
  pressed: {opacity: 0.9},

  /** `.kiosk-add-btn-section` */
  footer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 30,
    backgroundColor: theme.color.productDetailPageBg,
  },
  /** `.general_btn` */
  generalBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generalBtnText: {
    fontSize: 12,
    color: theme.color.textPrimary,
    fontWeight: '400',
  },
  /** `.kiosk-add-btn-qty-cell` — 33.33% */
  footerQty: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `.kiosk-add-btn-qty-control` */
  qtyControl: {
    width: 40,
    height: 40,
    marginHorizontal: 5,
    backgroundColor: theme.color.qtyControlBg,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyControlText: {
    fontSize: 16,
    color: '#444444',
    lineHeight: 22,
    fontWeight: '400',
  },
  /** `.kiosk-add-btn-qty-text` */
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.textPrimary,
    marginHorizontal: 10,
    minWidth: 24,
    textAlign: 'center',
  },
  /** `.general_btn2` */
  generalBtn2: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: theme.color.accentPrimary,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generalBtn2Text: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.color.onAccent,
    textAlign: 'center',
  },
});
