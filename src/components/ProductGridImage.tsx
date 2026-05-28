import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, View} from 'react-native';
import {productImageExpoSource} from '@utils/productImage';

/** Fixed product image frame ratio used across menu cards and option tiles. */
const PRODUCT_IMAGE_ASPECT_RATIO = 16 / 9;

type ProductGridImageProps = {
  uri: string;
  width: number;
  /** `cover` keeps every image in the same 16:9 frame. */
  resizeMode?: 'cover' | 'contain';
};

/**
 * Product tile image: fixed 16:9 frame so every card has the same image area.
 * Used by `MenuScreen` and `ProductDetailScreen` option tiles for matching layout.
 */
export const ProductGridImage = React.memo(function ProductGridImage({
  uri,
  width,
  resizeMode = 'cover',
}: ProductGridImageProps): React.JSX.Element {
  const height = Math.round(width * (9 / 16));

  return (
    <View
      style={[
        styles.frame,
        {width: '100%', height, aspectRatio: PRODUCT_IMAGE_ASPECT_RATIO},
      ]}>
      <Image
        source={productImageExpoSource(uri)}
        style={styles.image}
        contentFit={resizeMode}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        transition={0}
      />
    </View>
  );
});

export {PRODUCT_IMAGE_ASPECT_RATIO};

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
