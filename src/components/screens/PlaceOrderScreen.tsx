import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
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
import {LanguageSelector} from '../LanguageSelector';
import {translate} from '../../stores/Localization/LocalizationStore';

/**
 * Post-login screen: splash image as background, visible CTA button pinned
 * to the bottom on top of the image.
 */
export function PlaceOrderScreen(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const wireRow = useAuthStore(s => s.wireRow);

  const goToDiningChoice = () => {
    navigation.navigate(ROUTES.DiningChoice);
  };

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <KioskSplashLayout wireRow={wireRow} logTag="PlaceOrder" style={styles.image}>
        <Pressable
          style={styles.tapRoot}
          onPress={goToDiningChoice}
          accessibilityRole="button"
          accessibilityLabel={translate('kiosk.placeOrderA11y')}>
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
                onPress={goToDiningChoice}>
                <Text style={styles.ctaButtonText}>
                  {translate('kiosk.startCta')}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Pressable>
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
    width: '100%',
    height: '100%',
  },
  tapRoot: {
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  ctaButtonPressed: {
    opacity: 0.9,
  },
  ctaButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
