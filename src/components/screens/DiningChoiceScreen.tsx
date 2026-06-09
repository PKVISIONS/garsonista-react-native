import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {Image, Platform, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useAuthStore} from '@store';
import {theme, shadowChoiceCard} from '@theme/kiosk';
import {KioskPressable as Pressable} from '../KioskPressable';
import {KioskTopBrandLogo} from '../KioskTopBrandLogo';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {prepareCartForMenu} from '@utils/menuPreload';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.DiningChoice>;

const dineInImg = require('../../assets/images/kiosk_dinein.png');
const takeAwayImg = require('../../assets/images/takeaway_kiosk.png');
const kioskBrandLogoFallback = require('../../assets/images/garsonista-kiosk-logo.png');

function hasServiceTable(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function DiningChoiceCard({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: number;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}>
      <View style={styles.cardIconWrap}>
        <Image
          source={icon}
          style={styles.cardIcon}
          resizeMode="contain"
          fadeDuration={Platform.OS === 'android' ? 0 : undefined}
        />
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
    </Pressable>
  );
}

export function DiningChoiceScreen({navigation}: Props): React.JSX.Element {
  const wireRow = useAuthStore(s => s.wireRow);
  const showDineIn = hasServiceTable(wireRow?.dineinbtn_table);
  const showTakeaway = hasServiceTable(wireRow?.takeawaybtn_table);
  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const topBrandSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : kioskBrandLogoFallback;

  const openMenu = (serviceType: 'dine-in' | 'takeaway') => {
    prepareCartForMenu(serviceType);
    navigation.navigate(ROUTES.Menu, {serviceType});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBrand}>
        <KioskTopBrandLogo source={topBrandSource} />
      </View>
      <View style={styles.centerWrap}>
        <View style={styles.centeredContent}>
          <Text style={styles.question}>{translate('kiosk.dining.question')}</Text>
          <View style={styles.cardsRow}>
            {showDineIn ? (
              <DiningChoiceCard
                label={translate('kiosk.dining.dineIn')}
                icon={dineInImg}
                onPress={() => openMenu('dine-in')}
              />
            ) : null}
            {showTakeaway ? (
              <DiningChoiceCard
                label={translate('kiosk.dining.takeaway')}
                icon={takeAwayImg}
                onPress={() => openMenu('takeaway')}
              />
            ) : null}
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
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 280,
    minHeight: 300,
    maxWidth: 380,
    backgroundColor: theme.color.bgPrimary,
    borderRadius: theme.radius.large,
    paddingHorizontal: 10,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadowChoiceCard,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardIconWrap: {
    flex: 1,
    width: '100%',
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    width: 160,
    height: 140,
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.textPrimary,
    textAlign: 'center',
  },
});
