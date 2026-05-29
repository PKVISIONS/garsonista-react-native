import React from 'react';
import type {ImageSourcePropType, StyleProp, ViewStyle} from 'react-native';
import {Image, Platform, View} from 'react-native';
import {kioskTopBrandLogo, kioskTopBrandLogoWrap} from '@theme/kiosk';
import {translate} from '../stores/Localization/LocalizationStore';

type Props = {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
};

export function KioskTopBrandLogo({source, style}: Props): React.JSX.Element {
  return (
    <View style={[kioskTopBrandLogoWrap, style]}>
      <Image
        source={source}
        style={kioskTopBrandLogo}
        resizeMode="contain"
        fadeDuration={Platform.OS === 'android' ? 0 : undefined}
        accessibilityLabel={translate('kiosk.receipt.brand')}
      />
    </View>
  );
}
