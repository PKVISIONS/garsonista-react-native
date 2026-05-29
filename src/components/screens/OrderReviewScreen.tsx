import {CommonActions} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type ImageStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useAuthStore, useCartStore, useCatalogStore} from '@store';
import {theme, cardShadow, shadowFooterUp} from '@theme/kiosk';
import {KioskPressable as Pressable} from '../KioskPressable';
import {KioskTopBrandLogo} from '../KioskTopBrandLogo';
import {StartOverConfirmModal} from '../StartOverConfirmModal';
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
  const cardMargin = Math.max(12, Math.round(width * 0.03));
  const lang = localizationStore.currentLanguageCode;
  const [startOverModalVisible, setStartOverModalVisible] = useState(false);

  const total = useMemo(() => {
    if (!cart) {
      return 0;
    }
    return cart.items.reduce((s, i) => s + i.lineTotal, 0);
  }, [cart]);

  const resetToDining = () => {
    setStartOverModalVisible(false);
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
        <KioskTopBrandLogo source={logoSource} />
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
                          style={styles.lineCategoryIcon as ImageStyle}
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
            style={styles.totalCartIcon as ImageStyle}
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
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setStartOverModalVisible(true)}>
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
      <StartOverConfirmModal
        visible={startOverModalVisible}
        onClose={() => setStartOverModalVisible(false)}
        onConfirm={resetToDining}
      />
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
    paddingBottom: 12,
    gap: 10,
  },
  orderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
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
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    ...cardShadow,
  },
  /** Category icon from menu rail — no border; larger than before */
  lineCategoryColumn: {
    width: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineCategoryBadge: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineCategoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  lineCategoryIconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: theme.color.pricePillBg,
  },
  lineCategoryEmpty: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.textPrimary,
    marginBottom: 8,
    lineHeight: 22,
  },
  itemDescription: {
    fontSize: 15,
    color: theme.color.textSecondary,
    lineHeight: 20,
  },
  spacer: {
    flex: 0.15,
  },
  qtyColumn: {
    alignItems: 'center',
    gap: 10,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.color.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyCircleText: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.color.accentPrimary,
    lineHeight: 24,
  },
  qtyNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  removeBtn: {
    borderWidth: 1.5,
    borderColor: theme.color.border,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  removeText: {
    fontSize: 14,
    color: theme.color.textSecondary,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.textPrimary,
    minWidth: 72,
    marginRight: 0,
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
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.textPrimary,
    flex: 1,
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  completeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  completeBtn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  completeBtnDisabled: {
    opacity: 0.45,
  },
  completeBtnText: {
    fontSize: 16,
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
