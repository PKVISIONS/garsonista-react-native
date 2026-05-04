import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useAuthStore} from '@store/authStore';
import {useCartStore} from '@store/cartStore';
import {useCatalogStore} from '@store/catalogStore';
import {theme, cardShadow, shadowFooterUp, kioskTopBrandLogo} from '@theme/kiosk';
import {pickCatalogText} from '@utils/catalogText';
import {
  imagesBaseUrlFromWireRow,
  kioskLogoImageUri,
  productImageSource,
  remoteUriSource,
} from '@utils/productImage';
import {localizationStore, translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.OrderReview>;

/** When `kiosk_image3` missing (Cordova `.logo_new_image` — see `productImage.kioskLogoImageUri`) */
const kioskLogoFallback = require('../../assets/images/garsonista-kiosk-logo.png');
const cartIconImg = require('../../assets/images/cart-icon.png');

export function OrderReviewScreen({navigation}: Props): React.JSX.Element {
  const wireRow = useAuthStore(s => s.wireRow);
  const imagesBaseUrl = useAuthStore(s => imagesBaseUrlFromWireRow(s.wireRow));
  const logoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const logoSource = logoUri ? remoteUriSource(logoUri) : kioskLogoFallback;
  const cart = useCartStore(s => s.cart);
  const catalog = useCatalogStore(s => s.data);
  const updateLineQuantity = useCartStore(s => s.updateLineQuantity);
  const removeLine = useCartStore(s => s.removeLine);
  const clear = useCartStore(s => s.clear);

  const {width} = useWindowDimensions();
  const cardMargin = Math.round(width * 0.06);
  const lang = localizationStore.currentLanguageCode;

  const total = useMemo(() => {
    if (!cart) {
      return 0;
    }
    return cart.items.reduce((s, i) => s + i.lineTotal, 0);
  }, [cart]);

  const resetToDining = () => {
    clear();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: ROUTES.PlaceOrder}],
      }),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Image
          source={logoSource}
          style={styles.headerBrandLogo}
          resizeMode="contain"
          accessibilityLabel={translate('kiosk.receipt.brand')}
        />
        <Text style={styles.orderTitle}>{translate('kiosk.orderReview.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingHorizontal: cardMargin},
        ]}
        showsVerticalScrollIndicator={false}>
        {!cart || cart.items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{translate('kiosk.orderReview.emptyCart')}</Text>
          </View>
        ) : (
          cart.items.map(item => {
            const lineStr = `${item.lineTotal.toFixed(2).replace('.', ',')}€`;
            const desc =
              item.selectedOptions.length > 0
                ? item.selectedOptions.map(o => o.label).join(', ')
                : '';
            const prod = catalog?.products.find(p => p.id === item.productId);
            const menuCategory = prod
              ? catalog?.categories.find(c => c.id === prod.categoryId)
              : undefined;
            const categoryLabel = menuCategory
              ? pickCatalogText(lang, menuCategory.name, menuCategory.nameEn)
              : null;
            const categoryIconSrc = menuCategory?.imageUrl
              ? productImageSource(menuCategory.imageUrl, imagesBaseUrl)
              : null;
            return (
              <View key={item.lineId} style={styles.cartCard}>
                <View style={styles.lineCategoryColumn}>
                  {menuCategory ? (
                    <View style={styles.lineCategoryBadge}>
                      {categoryIconSrc ? (
                        <Image
                          source={categoryIconSrc}
                          style={styles.lineCategoryIcon}
                          resizeMode="contain"
                          fadeDuration={Platform.OS === 'android' ? 0 : undefined}
                          accessibilityLabel={
                            categoryLabel && categoryLabel.length > 0
                              ? categoryLabel
                              : undefined
                          }
                        />
                      ) : (
                        <View
                          style={styles.lineCategoryIconPlaceholder}
                          accessibilityRole="image"
                        />
                      )}
                    </View>
                  ) : (
                    <View style={styles.lineCategoryBadge}>
                      <View style={styles.lineCategoryEmpty} />
                    </View>
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  {desc ? (
                    <Text style={styles.itemDescription} numberOfLines={2}>
                      {desc}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.qtyColumn}>
                  <View style={styles.qtyRow}>
                    <Pressable
                      style={styles.qtyCircleBtn}
                      onPress={() =>
                        item.quantity > 1
                          ? updateLineQuantity(
                              item.lineId,
                              item.quantity - 1,
                            )
                          : removeLine(item.lineId)
                      }>
                      <Text style={styles.qtyCircleText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyNumber}>{item.quantity}</Text>
                    <Pressable
                      style={styles.qtyCircleBtn}
                      onPress={() =>
                        updateLineQuantity(item.lineId, item.quantity + 1)
                      }>
                      <Text style={styles.qtyCircleText}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => removeLine(item.lineId)}
                    style={styles.removeBtn}>
                    <Text style={styles.removeText}>{translate('kiosk.orderReview.remove')}</Text>
                  </Pressable>
                </View>
                <View style={styles.spacer} />
                <Text style={styles.itemPrice}>{lineStr}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.totalRow}>
          <Image
            source={cartIconImg}
            style={styles.totalCartIcon}
            resizeMode="contain"
          />
          <Text style={styles.totalLabel}>{translate('kiosk.orderReview.total')}</Text>
          <Text style={styles.totalPrice}>
            {total.toFixed(2).replace('.', ',')}€
          </Text>
        </View>
        <View style={styles.completeBtnRow}>
          <Pressable
            style={[styles.completeBtn, total <= 0 && styles.completeBtnDisabled]}
            disabled={total <= 0}
            onPress={() => navigation.navigate(ROUTES.PaymentMethod)}>
            <Text style={styles.completeBtnText}>{translate('kiosk.orderReview.complete')}</Text>
          </Pressable>
        </View>
        <View style={styles.secondaryRow}>
          <Pressable style={styles.secondaryBtn} onPress={resetToDining}>
            <Text style={styles.secondaryBtnText}>{translate('kiosk.orderReview.fromStart')}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              if (!cart) {
                navigation.goBack();
                return;
              }
              navigation.navigate(ROUTES.Menu, {serviceType: cart.type});
            }}>
            <Text style={styles.secondaryBtnText}>{translate('kiosk.orderReview.backToMenu')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.bgSecondary,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  headerBrandLogo: {
    ...kioskTopBrandLogo,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.textPrimary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.color.textMuted,
  },
  cartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.large,
    paddingHorizontal: 28,
    paddingVertical: 20,
    gap: 14,
    ...cardShadow,
  },
  /** Category icon from menu rail — no border; larger than before */
  lineCategoryColumn: {
    width: 88,
    marginLeft: '4%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineCategoryBadge: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineCategoryIcon: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  lineCategoryIconPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: theme.color.pricePillBg,
  },
  lineCategoryEmpty: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.textPrimary,
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 13,
    color: theme.color.textSecondary,
    lineHeight: 19,
  },
  spacer: {
    flex: 0.4,
  },
  qtyColumn: {
    alignItems: 'center',
    gap: 12,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qtyCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyCircleText: {
    fontSize: 26,
    fontWeight: '600',
    color: theme.color.accentPrimary,
    lineHeight: 30,
  },
  qtyNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.textPrimary,
    minWidth: 28,
    textAlign: 'center',
  },
  removeBtn: {
    borderWidth: 1.5,
    borderColor: theme.color.border,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  removeText: {
    fontSize: 15,
    color: theme.color.textSecondary,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.textPrimary,
    minWidth: 60,
    marginRight: 100,
    textAlign: 'right',
  },
  bottomBar: {
    backgroundColor: theme.color.bgPrimary,
    paddingBottom: 20,
    gap: 10,
    ...shadowFooterUp,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  totalCartIcon: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  totalLabel: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.color.textPrimary,
    flex: 1,
  },
  totalPrice: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  completeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  completeBtn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 12,
    alignItems: 'center',
    width: '50%',
  },
  completeBtnDisabled: {
    opacity: 0.45,
  },
  completeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.onAccent,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.textPrimary,
  },
});
