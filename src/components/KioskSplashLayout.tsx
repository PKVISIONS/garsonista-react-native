import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {useKioskSplashBackground} from '@hooks/useKioskSplashBackground';
import {theme} from '@theme/kiosk';

type Props = {
  wireRow: Record<string, unknown> | null | undefined;
  logTag: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Full-bleed kiosk splash from backend (`images_url` + `kiosk_image1` / `kiosk_image2`). */
export function KioskSplashLayout({
  wireRow,
  logTag,
  style,
  children,
}: Props): React.JSX.Element {
  const {source, onLoad, onError} = useKioskSplashBackground(
    wireRow,
    logTag,
  );

  return (
    <View style={[styles.root, style]}>
      {source ? (
        <Image
          source={source}
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={source.uri}
          style={styles.image}
          transition={0}
          onLoad={onLoad}
          onError={onError}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: theme.color.bgPrimary,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    backgroundColor: theme.color.bgPrimary,
  },
  content: {
    flex: 1,
  },
});
