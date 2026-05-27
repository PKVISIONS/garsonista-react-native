import React from 'react';
import {Image, Platform, StyleSheet, View} from 'react-native';
import {remoteUriSource} from '@utils/productImage';

/** Fixed product image frame ratio used across menu cards and option tiles. */
const PRODUCT_IMAGE_ASPECT_RATIO = 16 / 9;

/**
 * Product tile image: fixed 16:9 frame so every card has the same image area.
 * Used by `MenuScreen` and `ProductDetailScreen` option tiles for matching layout.
 */
export function ProductGridImage({
  uri,
  width,
  resizeMode = 'cover',
}: {
  uri: string;
  width: number;
  /** `cover` keeps every image in the same 16:9 frame. */
  resizeMode?: 'cover' | 'contain';
}): React.JSX.Element {
  const height = Math.round(width * (9 / 16));

  return (
    <View
      style={[
        styles.frame,
        {width: '100%', height, aspectRatio: PRODUCT_IMAGE_ASPECT_RATIO},
      ]}>
      <Image
        source={remoteUriSource(uri)}
        style={styles.image}
        resizeMode={resizeMode}
        fadeDuration={Platform.OS === 'android' ? 0 : undefined}
      />
    </View>
  );
}

export {PRODUCT_IMAGE_ASPECT_RATIO};

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
