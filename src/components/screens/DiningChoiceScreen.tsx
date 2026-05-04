import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {Image, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useAuthStore} from '@store/authStore';
import {kioskTopBrandLogo, theme, shadowChoiceCard} from '@theme/kiosk';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.DiningChoice>;

const dineInImg = require('../../assets/images/kiosk_dinein.png');
const takeAwayImg = require('../../assets/images/takeaway_kiosk.png');
/** Same as `MenuScreen` / Order review — `kiosk_image3` + `garsonista-kiosk-logo` fallback */
const kioskBrandLogoFallback = require('../../assets/images/garsonista-kiosk-logo.png');

export function DiningChoiceScreen({navigation}: Props): React.JSX.Element {
  const wireRow = useAuthStore(s => s.wireRow);
  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const topBrandSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : kioskBrandLogoFallback;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBrand}>
        <Image
          source={topBrandSource}
          style={styles.topBrandLogo}
          resizeMode="contain"
          fadeDuration={Platform.OS === 'android' ? 0 : undefined}
          accessibilityLabel={translate('kiosk.receipt.brand')}
        />
      </View>
      <View style={styles.centerWrap}>
        <View style={styles.centeredContent}>
          <Text style={styles.question}>{translate('kiosk.dining.question')}</Text>
          <View style={styles.cardsRow}>
            <Pressable
              style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                navigation.navigate(ROUTES.Menu, {serviceType: 'dine-in'})
              }>
              <Image
                source={dineInImg}
                style={styles.cardIcon}
                resizeMode="contain"
              />
              <Text style={styles.cardLabel}>{translate('kiosk.dining.dineIn')}</Text>
            </Pressable>
            <Pressable
              style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                navigation.navigate(ROUTES.Menu, {serviceType: 'takeaway'})
              }>
              <Image
                source={takeAwayImg}
                style={styles.cardIcon}
                resizeMode="contain"
              />
              <Text style={styles.cardLabel}>{translate('kiosk.dining.takeaway')}</Text>
            </Pressable>
          </View>
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
  topBrand: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  topBrandLogo: {
    ...kioskTopBrandLogo,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContent: {
    paddingHorizontal: theme.space.lg,
    width: '100%',
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 280,
    minHeight: 300,
    maxWidth: 380,
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.large,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowChoiceCard,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardIcon: {
    width: 120,
    height: 100,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.textPrimary,
    marginTop: 10,
    textAlign: 'center',
  },
});
