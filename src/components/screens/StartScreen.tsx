import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect} from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {KioskSplashLayout} from '../KioskSplashLayout';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useAuthStore} from '@store';
import {theme} from '@theme/kiosk';
import {kioskSplashImageUri} from '@utils/productImage';
import {logRemoteImageDiagnostics} from '@utils/imageDebug';
import {LanguageSelector} from '../LanguageSelector';
import {translate} from '../../stores/Localization/LocalizationStore';

/**
 * First screen: full-bleed background image + CTA button together.
 * Image source: `kiosk_image1` from wireRow.
 */
export function StartScreen(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const wireRow = useAuthStore(s => s.wireRow);
  const splashUri = kioskSplashImageUri(wireRow);

  useEffect(() => {
    void logRemoteImageDiagnostics(splashUri ?? '', 'start_kiosk_splash');
  }, [splashUri]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KioskSplashLayout wireRow={wireRow} logTag="Start" style={styles.image}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <LanguageSelector style={styles.langRow} />
          <View style={styles.flexSpacer} />
          <View style={styles.ctaBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('kiosk.placeOrderA11y')}
              style={({pressed}) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
              ]}
              android_ripple={{color: 'rgba(255,255,255,0.3)'}}
              onPress={() => navigation.replace(ROUTES.Login)}>
              <Text style={styles.ctaButtonText}>
                {translate('kiosk.startCta')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KioskSplashLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.bgPrimary,
  },
  image: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  langRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  flexSpacer: {
    flex: 1,
  },
  ctaBar: {
    backgroundColor: 'rgba(0,0,0,0.50)',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  ctaButtonPressed: {
    backgroundColor: '#F0F0F0',
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
