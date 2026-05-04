import React, {useCallback, useEffect, useState} from 'react';
import {Image, type ImageLoadEventData, type NativeSyntheticEvent, Platform, View} from 'react-native';
import {getCachedImageAspect, setCachedImageAspect} from '@utils/imageAspectCache';
import {remoteUriSource} from '@utils/productImage';

/** Before `Image.getSize` / `onLoad` reports real pixels (same as menu grid) */
const PRODUCT_IMAGE_FALLBACK_ASPECT = 1.35;

const imageFrameStyle = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

/**
 * Product tile image: height from intrinsic aspect (no letterboxed fixed band).
 * Used by `MenuScreen` and `ProductDetailScreen` option tiles for matching layout.
 */
export function ProductGridImage({
  uri,
  width,
  resizeMode = 'contain',
}: {
  uri: string;
  width: number;
  /** `cover` fills the frame (no letterboxing); `contain` matches menu grid. */
  resizeMode?: 'contain' | 'cover';
}): React.JSX.Element {
  const [aspect, setAspect] = useState<number | null>(() =>
    getCachedImageAspect(uri),
  );

  useEffect(() => {
    const cached = getCachedImageAspect(uri);
    if (cached != null) {
      setAspect(cached);
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) {
          const r = w / h;
          setCachedImageAspect(uri, r);
          setAspect(r);
        }
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const onLoad = useCallback(
    (e: NativeSyntheticEvent<ImageLoadEventData>) => {
      const {width: w, height: h} = e.nativeEvent.source;
      if (w && h) {
        const r = w / h;
        setCachedImageAspect(uri, r);
        setAspect(r);
      }
    },
    [uri],
  );

  const ratio = aspect ?? PRODUCT_IMAGE_FALLBACK_ASPECT;
  const height = width / ratio;

  return (
    <View style={[imageFrameStyle, {width, minHeight: height}]}>
      <Image
        source={remoteUriSource(uri)}
        style={{width, height}}
        resizeMode={resizeMode}
        onLoad={onLoad}
        fadeDuration={Platform.OS === 'android' ? 0 : undefined}
      />
    </View>
  );
}

export {PRODUCT_IMAGE_FALLBACK_ASPECT};
