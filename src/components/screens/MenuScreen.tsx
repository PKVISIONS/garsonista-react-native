import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import type {Category} from '@models';
import {resolveDefaultTableId} from '@services/catalogService';
import {useAuthStore, useCartStore, useCatalogStore, useMenuPreloadStore} from '@store';
import {theme} from '@theme/kiosk';
import {KioskTouchableOpacity as TouchableOpacity} from '../KioskTouchableOpacity';
import {KioskTopBrandLogo} from '../KioskTopBrandLogo';
import {pickCatalogText} from '@utils/catalogText';
import {
  imagesBaseUrlFromWireRow,
  kioskLogoImageUri,
  productImageSource,
  remoteUriSource,
} from '@utils/productImage';
import {useMenuGridMetrics} from '@hooks/useMenuGridMetrics';
import {CategoryProductGrid} from '../MenuProductGrid';
import {StartOverConfirmModal} from '../StartOverConfirmModal';
import {localizationStore, translate} from '../../stores/Localization/LocalizationStore';

const cartIconImg = require('../../assets/images/cart-icon.png');
const kioskBrandLogoFallback = require('../../assets/images/garsonista-kiosk-logo.png');

/** Footer “Start from the beginning” — max width (px). */
const FOOTER_START_OVER_MAX_WIDTH = 400;
/** Footer “View order” — max width (px). */
const FOOTER_VIEW_ORDER_MAX_WIDTH = 540;

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.Menu>;

export function MenuScreen({navigation, route}: Props): React.JSX.Element {
  const {serviceType = 'dine-in'} = route.params;
  const lang = localizationStore.currentLanguageCode;
  const wireRow = useAuthStore(s => s.wireRow);
  const imagesBaseUrl = useAuthStore(s => imagesBaseUrlFromWireRow(s.wireRow));
  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const menuHeaderImageSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : kioskBrandLogoFallback;

  const data = useCatalogStore(s => s.data);
  const cart = useCartStore(s => s.cart);
  const resetForServiceType = useCartStore(s => s.resetForServiceType);
  const clear = useCartStore(s => s.clear);
  const setServiceType = useMenuPreloadStore(s => s.setServiceType);
  const setActiveCategoryId = useMenuPreloadStore(s => s.setActiveCategoryId);
  const preloadTableIds = useMenuPreloadStore(s => s.tableIds);
  const stagedCategoryIds = useMenuPreloadStore(s => s.stagedCategoryIds);
  const productsByTableId = useMenuPreloadStore(s => s.productsByTableId);
  const productImageUriById = useMenuPreloadStore(s => s.productImageUriById);

  const categories = useMemo(() => {
    const c = data?.categories ?? [];
    return c.filter(x => x.parentId == null);
  }, [data]);

  const categoryById = useMemo(() => {
    const map = new Map<number, Category>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const [catId, setCatId] = React.useState<number | null>(null);
  const [startOverModalVisible, setStartOverModalVisible] = React.useState(false);

  const activeCatId = catId ?? categories[0]?.id ?? null;
  const tableId = preloadTableIds[serviceType];
  const productsForTable = productsByTableId[tableId] ?? {};

  const mountedCategoryIds =
    stagedCategoryIds.length > 0
      ? stagedCategoryIds
      : categories.map(category => category.id);

  React.useEffect(() => {
    const defaultTableId =
      preloadTableIds[serviceType] ||
      resolveDefaultTableId(data?.storeTables ?? [], serviceType);
    if (
      !cart ||
      cart.tableId !== defaultTableId ||
      cart.type !== serviceType
    ) {
      resetForServiceType(serviceType, defaultTableId);
    }
  }, [cart, data, preloadTableIds, resetForServiceType, serviceType]);

  React.useEffect(() => {
    setServiceType(serviceType);
  }, [serviceType, setServiceType]);

  React.useEffect(() => {
    if (activeCatId != null) {
      setActiveCategoryId(activeCatId);
    }
  }, [activeCatId, setActiveCategoryId]);

  const total = useMemo(() => {
    if (!cart) {
      return 0;
    }
    return cart.items.reduce((s, i) => s + i.lineTotal, 0);
  }, [cart]);

  const cartCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const {screenWidth, leftRailWidth, cardWidth} = useMenuGridMetrics();

  const onPressProduct = useCallback(
    (productId: number) => {
      navigation.navigate(ROUTES.ProductDetail, {productId});
    },
    [navigation],
  );

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

  const onSelectCategory = useCallback(
    (id: number) => {
      setCatId(id);
      setActiveCategoryId(id);
    },
    [setActiveCategoryId],
  );

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
            resizeMode="cover"
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
        <KioskTopBrandLogo
          source={menuHeaderImageSource}
          style={styles.menuHeaderBrandLogo}
        />
      </View>
      <View style={styles.body}>
        <View style={[styles.leftBar, {width: leftRailWidth}]}>
          <View style={styles.leftBarInner}>
            <ScrollView
              style={styles.leftBarScroll}
              contentContainerStyle={styles.leftBarContent}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {categories.map((item: Category) => (
                <React.Fragment key={item.id}>
                  {renderCategoryRow(
                    activeCatId === item.id,
                    pickCatalogText(lang, item.name, item.nameEn),
                    () => onSelectCategory(item.id),
                    item.imageUrl,
                  )}
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.productListsHost}>
          {mountedCategoryIds.map(categoryId => (
            <CategoryProductGrid
              key={`cat-list-${String(categoryId)}`}
              categoryId={categoryId}
              category={categoryById.get(categoryId)}
              products={productsForTable[categoryId] ?? []}
              isActive={categoryId === activeCatId}
              lang={lang}
              cardWidth={cardWidth}
              productImageUriById={productImageUriById}
              fallbackTitle={translate('kiosk.menu.defaultCategory')}
              onPressProduct={onPressProduct}
            />
          ))}
        </View>
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
      <View
        style={[
          styles.footerBtnRow,
          {paddingHorizontal: Math.round(screenWidth * 0.04)},
        ]}>
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
          <Text style={styles.footerBtnTextSolid}>
            {translate('kiosk.menu.viewOrder')}
          </Text>
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
  menuTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: theme.color.bgSecondary,
  },
  menuHeaderBrandLogo: {
    flexShrink: 0,
    marginLeft: 0,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  leftBar: {
    flexShrink: 0,
    flexGrow: 0,
    alignSelf: 'stretch',
    padding: 10,
    backgroundColor: theme.color.bgSecondary,
  },
  leftBarInner: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
  },
  leftBarScroll: {
    flex: 1,
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
    minHeight: 96,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    width: '100%',
  },
  sideItemActive: {
    borderBottomColor: theme.color.accentPrimary,
  },
  sideIcon: {
    width: 90,
    height: 51,
    marginBottom: 5,
    borderRadius: 8,
    backgroundColor: theme.color.bgSecondary,
  },
  sideIconPlaceholder: {
    width: 90,
    height: 51,
    marginBottom: 5,
    borderRadius: 8,
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
  productListsHost: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: theme.color.bgSecondary,
  },
  footerTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    transform: [{translateX: -170}],
    backgroundColor: theme.color.bgSecondary,
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
    backgroundColor: theme.color.bgSecondary,
  },
  footerBtn: {
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
