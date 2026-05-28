import React, {useCallback} from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {Category, Product} from '@models';
import {theme, cardShadow} from '@theme/kiosk';
import {pickCatalogText} from '@utils/catalogText';
import {MENU_GRID_GAP} from '@constants/menuLayout';
import {ProductGridImage, PRODUCT_IMAGE_ASPECT_RATIO} from './ProductGridImage';

type ProductTileProps = {
  id: number;
  title: string;
  price: number;
  imageUri: string | null;
  cardWidth: number;
  onPress: (id: number) => void;
};

const ProductTile = React.memo(function ProductTile({
  id,
  title,
  price,
  imageUri,
  cardWidth,
  onPress,
}: ProductTileProps): React.JSX.Element {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[styles.card, {width: cardWidth}]}
      onPress={() => onPress(id)}>
      <View style={styles.cardImageWrap}>
        {imageUri ? (
          <ProductGridImage uri={imageUri} width={cardWidth} />
        ) : (
          <View
            style={[
              styles.cardImagePlaceholder,
              {height: cardWidth / PRODUCT_IMAGE_ASPECT_RATIO},
            ]}
          />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={3}>
          {title}
        </Text>
        <View style={styles.pricePill}>
          <Text style={styles.pricePillText}>
            {price.toFixed(2).replace('.', ',')}€
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

type CategoryProductGridProps = {
  categoryId: number;
  category: Category | undefined;
  products: Product[];
  isActive: boolean;
  lang: string;
  cardWidth: number;
  productImageUriById: Record<number, string>;
  fallbackTitle: string;
  onPressProduct: (productId: number) => void;
};

export const CategoryProductGrid = React.memo(function CategoryProductGrid({
  categoryId,
  category,
  products,
  isActive,
  lang,
  cardWidth,
  productImageUriById,
  fallbackTitle,
  onPressProduct,
}: CategoryProductGridProps): React.JSX.Element {
  const categoryTitle = category
    ? pickCatalogText(lang, category.name, category.nameEn)
    : fallbackTitle;

  const renderProductItem = useCallback(
    ({item}: {item: Product}) => (
      <ProductTile
        id={item.id}
        title={pickCatalogText(lang, item.name, item.nameEn)}
        price={item.basePrice}
        imageUri={productImageUriById[item.id] ?? null}
        cardWidth={cardWidth}
        onPress={onPressProduct}
      />
    ),
    [lang, productImageUriById, cardWidth, onPressProduct],
  );

  return (
    <View
      key={`cat-list-${String(categoryId)}`}
      pointerEvents={isActive ? 'auto' : 'none'}
      style={[
        styles.productListLayer,
        isActive ? styles.productListLayerActive : styles.productListLayerHidden,
      ]}>
      <FlatList
        style={styles.productList}
        data={products}
        keyExtractor={p => String(p.id)}
        numColumns={3}
        columnWrapperStyle={styles.row3Wrap}
        contentContainerStyle={styles.productListContent}
        initialNumToRender={9}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={isActive && Platform.OS === 'android'}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>{categoryTitle}</Text>
        }
        showsVerticalScrollIndicator={false}
        renderItem={renderProductItem}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  productList: {
    flex: 1,
    paddingLeft: 8,
    paddingRight: 10,
    paddingTop: 0,
  },
  productListLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  productListLayerActive: {
    opacity: 1,
  },
  productListLayerHidden: {
    opacity: 0,
  },
  productListContent: {
    paddingTop: 15,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.color.textPrimary,
    marginBottom: 14,
    marginTop: 0,
  },
  row3Wrap: {
    marginBottom: 12,
    paddingHorizontal: 0,
    gap: MENU_GRID_GAP,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  card: {
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardImageWrap: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.color.bgPrimary,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
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
  cardTitle: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 17,
    color: theme.color.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
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
});
