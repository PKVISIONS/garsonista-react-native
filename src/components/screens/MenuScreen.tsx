import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {FlatList, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {KIOSK_ORDER_TABLE_ID} from '@constants/service';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import type {Category, Product} from '@models';
import {priceProductsForTable} from '@services/catalogService';
import {useAuthStore, useCartStore, useCatalogStore} from '@store';
import {theme, cardShadow, shadowFooterUp} from '@theme/kiosk';
import {pickCatalogText} from '@utils/catalogText';
import {
  imagesBaseUrlFromWireRow,
  kioskLogoImageUri,
  productImageSource,
  remoteUriSource,
} from '@utils/productImage';
import {StartOverConfirmModal} from '../StartOverConfirmModal';
import {ProductGridImage, PRODUCT_IMAGE_FALLBACK_ASPECT} from '../ProductGridImage';
import {localizationStore, translate} from '../../stores/Localization/LocalizationStore';

const cartIconImg = require('../../assets/images/cart-icon.png');
const kioskBrandLogoFallback = require('../../assets/images/garsonista-kiosk-logo.png');

/** Horizontal padding on `productList` (left + right) — must match `styles.productList`. */
const PRODUCT_LIST_H_PAD = 8 + 10;
const MENU_GRID_GAP = 10;
/** Footer “Start from the beginning” — max width (px). */
const FOOTER_START_OVER_MAX_WIDTH = 400;
/** Footer “View order” — max width (px); change independently of `FOOTER_START_OVER_MAX_WIDTH`. */
const FOOTER_VIEW_ORDER_MAX_WIDTH = 540;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.Menu>;

export function MenuScreen({navigation, route}: Props): React.JSX.Element {
  const {serviceType = 'dine-in'} = route.params;
  const lang = localizationStore.currentLanguageCode;
  const wireRow = useAuthStore(s => s.wireRow);
  const imagesBaseUrl = useAuthStore(s => imagesBaseUrlFromWireRow(s.wireRow));
  /**
   * Brand mark: `user_logedin[0]`.`kiosk_image3` (Cordova `.logo_new_image`) — same as Order review.
   * Not `kiosk_image1`/`2` (those are portrait/wide splashes for PlaceOrder).
   */
  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const menuHeaderImageSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : kioskBrandLogoFallback;

  const data = useCatalogStore(s => s.data);
  const cart = useCartStore(s => s.cart);
  const resetForServiceType = useCartStore(s => s.resetForServiceType);
  const clear = useCartStore(s => s.clear);

  React.useEffect(() => {
    if (
      !cart ||
      cart.tableId !== KIOSK_ORDER_TABLE_ID ||
      cart.type !== serviceType
    ) {
      resetForServiceType(serviceType);
    }
  }, [cart, resetForServiceType, serviceType]);

  const categories = useMemo(() => {
    const c = data?.categories ?? [];
    return c.filter(x => x.parentId == null);
  }, [data]);

  const [catId, setCatId] = React.useState<number | null>(null);
  const [startOverModalVisible, setStartOverModalVisible] = React.useState(false);

  const activeCatId = catId ?? categories[0]?.id ?? null;

  const sectionTitle = useMemo(() => {
    const activeCategory = categories.find(c => c.id === activeCatId);
    if (!activeCategory) {
      return translate('kiosk.menu.defaultCategory');
    }
    return pickCatalogText(lang, activeCategory.name, activeCategory.nameEn);
  }, [activeCatId, categories, lang]);

  const products: Product[] = useMemo(() => {
    const all = data?.products ?? [];
    const rows = data?.productPrices ?? [];
    const priced =
      rows.length > 0
        ? priceProductsForTable(all, rows, KIOSK_ORDER_TABLE_ID)
        : all;
    if (activeCatId == null) {
      return priced;
    }
    return priced.filter(p => p.categoryId === activeCatId);
  }, [data, activeCatId]);

  const total = useMemo(() => {
    if (!cart) {
      return 0;
    }
    return cart.items.reduce((s, i) => s + i.lineTotal, 0);
  }, [cart]);

  const cartCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const {width: screenWidth, height: windowHeight} = useWindowDimensions();

  /** Wider than old fixed 130; scales with screen, clamped so grid + rail stay usable. */
  const leftRailWidth = useMemo(
    () => Math.round(clamp(screenWidth * 0.195, 142, 240)),
    [screenWidth],
  );

  const cardWidth = useMemo(() => {
    const gridInner =
      screenWidth - leftRailWidth - PRODUCT_LIST_H_PAD;
    return Math.max(
      0,
      Math.floor((gridInner - 2 * MENU_GRID_GAP) / 3),
    );
  }, [screenWidth, leftRailWidth]);
  /** Sidebar white card: hug content; cap height so long lists scroll */
  const sideRailMaxHeight = Math.round(windowHeight * 0.78);

  React.useEffect(() => {
    // #region agent log
    const p0 = products[0];
    const src0 = p0 ? productImageSource(p0.imageUrl, imagesBaseUrl) : null;
    fetch('http://127.0.0.1:7806/ingest/a1837756-80df-4bbf-b9af-46808b0f37e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'616b00'},body:JSON.stringify({sessionId:'616b00',hypothesisId:'H4',location:'MenuScreen.tsx:useEffect',message:'menu layout + sample product',data:{screenWidth,cardWidth,leftRailWidth,productsN:products.length,brandRemote:!!brandLogoUri,img0:src0?.uri?.slice?.(0,140)??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [screenWidth, cardWidth, leftRailWidth, products, imagesBaseUrl, brandLogoUri]);

  const onConfirmStartOver = () => {
    setStartOverModalVisible(false);
    clear();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: ROUTES.PlaceOrder}],
      }),
    );
  };

  const renderCategoryRow = (
    selected: boolean,
    label: string,
    onPress: () => void,
    imageUrl?: string | null,
  ) => {
    const imgSrc = imageUrl
      ? productImageSource(imageUrl, imagesBaseUrl)
      : null;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.sideItem, selected && styles.sideItemActive]}
        onPress={onPress}>
        {imgSrc ? (
          <Image
            source={imgSrc}
            style={styles.sideIcon}
            resizeMode="contain"
            fadeDuration={Platform.OS === 'android' ? 0 : undefined}
          />
        ) : (
          <View style={styles.sideIconPlaceholder} />
        )}
        <Text
          style={[styles.sideText, selected && styles.sideTextActive]}
          numberOfLines={2}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.menuTopBar} accessibilityRole="header">
        <Image
          source={menuHeaderImageSource}
          style={styles.menuHeaderBrandLogo}
          resizeMode="contain"
          accessibilityLabel={translate('kiosk.receipt.brand')}
        />
      </View>
      <View style={styles.body}>
        <View style={[styles.leftBar, {width: leftRailWidth}]}>
          <View
            style={[styles.leftBarInner, {maxHeight: sideRailMaxHeight}]}>
            <ScrollView
              style={{maxHeight: sideRailMaxHeight}}
              contentContainerStyle={styles.leftBarContent}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {categories.map((item: Category) => (
                <React.Fragment key={item.id}>
                  {/* item.name is server-provided — not localizable via translate() */}
                  {renderCategoryRow(
                    activeCatId === item.id,
                    pickCatalogText(lang, item.name, item.nameEn),
                    () => setCatId(item.id),
                    item.imageUrl,
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        </View>
        <FlatList
          style={styles.productList}
          data={products}
          keyExtractor={p => String(p.id)}
          numColumns={3}
          columnWrapperStyle={styles.row3Wrap}
          contentContainerStyle={styles.productListContent}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          }
          ListEmptyComponent={
            <Text style={styles.emptyList}>{translate('kiosk.menu.emptyProducts')}</Text>
          }
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => {
            const src = productImageSource(item.imageUrl, imagesBaseUrl);
            return (
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.card, {width: cardWidth}]}
                onPress={() =>
                  navigation.navigate(ROUTES.ProductDetail, {productId: item.id})
                }>
                <View style={styles.cardImageWrap}>
                  {src ? (
                    <ProductGridImage
                      key={item.id}
                      uri={src.uri}
                      width={cardWidth}
                    />
                  ) : (
                    <View
                      style={[
                        styles.cardImagePlaceholder,
                        {
                          height: cardWidth / PRODUCT_IMAGE_FALLBACK_ASPECT,
                        },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.cardBody}>
                  {/* item.name is server-provided — not localizable via translate() */}
                  <Text style={styles.cardTitle} numberOfLines={3}>
                    {pickCatalogText(lang, item.name, item.nameEn)}
                  </Text>
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>
                      {item.basePrice.toFixed(2).replace('.', ',')}€
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
        <View style={styles.footerTotalRow}>
          <View style={styles.cartWrap}>
            <Image source={cartIconImg} style={styles.footerCartIcon} />
            {cartCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cartCount > 99 ? '99+' : String(cartCount)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.total}>
            {total.toFixed(2).replace('.', ',')}€
          </Text>
        </View>
        <View style={[styles.footerBtnRow, {paddingHorizontal: Math.round(screenWidth * 0.04)}]}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.footerBtn, styles.footerBtnOutline]}
            onPress={() => setStartOverModalVisible(true)}>
            <Text style={styles.footerBtnTextOutline}>
              {translate('kiosk.menu.startOver')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.footerBtn, styles.footerBtnSolid]}
            onPress={() => navigation.navigate(ROUTES.OrderReview)}>
            <Text style={styles.footerBtnTextSolid}>{translate('kiosk.menu.viewOrder')}</Text>
          </TouchableOpacity>
        </View>
      <StartOverConfirmModal
        visible={startOverModalVisible}
        onClose={() => setStartOverModalVisible(false)}
        onConfirm={onConfirmStartOver}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.bgSecondary,
  },
  /** `images_url` + `kiosk_image3` (Cordova logo) — not kiosk_image1/2 splashes */
  menuTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: theme.color.bgSecondary,
  },
  menuHeaderBrandLogo: {
    width: 350,
    height: 100,
    maxWidth: '85%',
    flexShrink: 0,
    marginLeft: 30,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  /** `.kiosk-cat-column` — width from `leftRailWidth` (responsive) */
  leftBar: {
    flexShrink: 0,
    padding: 10,
    backgroundColor: theme.color.bgSecondary,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  /** White panel wraps category list; no forced full-column stretch */
  leftBarInner: {
    alignSelf: 'flex-start',
    width: '100%',
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
  },
  leftBarContent: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 10,
  },
  sideItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    width: '100%',
  },
  sideItemActive: {
    borderBottomColor: theme.color.accentPrimary,
  },
  /** No `tintColor` on remote photos; no border (user request). */
  sideIcon: {
    width: 45,
    height: 45,
    marginBottom: 5,
    borderRadius: 5,
  },
  sideIconPlaceholder: {
    width: 45,
    height: 45,
    marginBottom: 5,
    borderRadius: 5,
    backgroundColor: theme.color.pricePillBg,
  },
  sideText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.textPrimary,
    textAlign: 'center',
    lineHeight: 15,
  },
  sideTextActive: {
    color: theme.color.accentPrimary,
  },
  /** `.kiosk-prod-column-container` */
  productList: {
    flex: 1,
    paddingLeft: 8,
    paddingRight: 10,
    paddingTop: 0,
  },
  productListContent: {
    paddingTop: 15,
    paddingBottom: 12,
  },
  /** `.kiosk-cat-title` */
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.color.textPrimary,
    marginBottom: 14,
    marginTop: 0,
  },
  emptyList: {
    color: theme.color.textSecondary,
    paddingVertical: theme.space.xl,
    textAlign: 'center',
  },
  row3Wrap: {
    marginBottom: 12,
    paddingHorizontal: 0,
    gap: MENU_GRID_GAP,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  /** Product tile — image area height = intrinsic aspect; no fill behind photo */
  card: {
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    ...cardShadow,
  },
  /** Top corners only — bottom radius on the image strip clipped tall photos; bottom edge stays square to body */
  cardImageWrap: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.color.bgPrimary,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  cardImagePlaceholder: {
    width: '100%',
    backgroundColor: theme.color.bgMuted,
  },
  cardBody: {
    paddingHorizontal: 0,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 6,
    minHeight: 88,
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
  },
  /** Product name — simple black, like reference combos */
  cardTitle: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 17,
    color: theme.color.textPrimary,
    textAlign: 'center',
    letterSpacing: 0,
    paddingHorizontal: 10,
  },
  /** Grey band ~80% of card width (10% inset each side) */
  pricePill: {
    width: '90%',
    backgroundColor: theme.color.menuComboPricePillBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignSelf: 'center',
    alignItems: 'center',
  },
  pricePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.pricePillText,
  },
  footer: {
    backgroundColor: theme.color.bgSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    ...shadowFooterUp,
  },
  /** Cart + total: centered, nudged a few px left (see `translateX`) */
  footerTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    transform: [{translateX: -170}],
  },
  cartWrap: {
    position: 'relative',
  },
  footerCartIcon: {width: 38, height: 38},
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E32619',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: theme.color.bgSecondary,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  total: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  footerBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 10,
    paddingBottom: 16,
    paddingTop: 2,
  },
  /** Shared padding + shape; `maxWidth` is per-button below */
  footerBtn: {
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Start over — cap width independent of “View order” */
  footerBtnOutline: {
    flex: 1,
    maxWidth: FOOTER_START_OVER_MAX_WIDTH,
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
  },
  footerBtnTextOutline: {
    color: theme.color.textPrimary,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  /** View order — own `maxWidth` + flex so size is tunable apart from “Start over” */
  footerBtnSolid: {
    flex: 1.55,
    maxWidth: FOOTER_VIEW_ORDER_MAX_WIDTH,
    backgroundColor: theme.color.accentPrimary,
  },
  footerBtnTextSolid: {
    color: theme.color.onAccent,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
});
