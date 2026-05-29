import React from 'react';
import {
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {KioskPressable as Pressable} from './KioskPressable';
import {cardShadow, theme} from '@theme/kiosk';
import {translate} from '../stores/Localization/LocalizationStore';

/** Cordova `www/img/Vector_2.png` — same asset as `.cancel_all_order` in `catalog-navigation.js` (width 60). */
const startOverModalIcon = require('../assets/images/kiosk-start-over-icon.png');

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function StartOverConfirmModal({
  visible,
  onClose,
  onConfirm,
}: Props): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={translate('kiosk.menu.startOverModalBackdropA11y')}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={[styles.card, cardShadow]} accessibilityViewIsModal>
            <Image
              source={startOverModalIcon}
              style={styles.modalIcon}
              resizeMode="contain"
              fadeDuration={Platform.OS === 'android' ? 0 : undefined}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={styles.title}>
              {translate('kiosk.menu.startOverModalTitle')}
            </Text>
            {translate('kiosk.menu.startOverModalMessage') ? (
              <Text style={styles.subtitle}>
                {translate('kiosk.menu.startOverModalMessage')}
              </Text>
            ) : null}
            <View style={styles.btnRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('kiosk.menu.startOverModalYes')}
                style={({pressed}) => [styles.btnPrimary, pressed && styles.btnPressed]}
                onPress={onConfirm}>
                <Text style={styles.btnPrimaryText}>
                  {translate('kiosk.menu.startOverModalYes')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('kiosk.menu.startOverModalNo')}
                style={({pressed}) => [styles.btnSecondary, pressed && styles.btnPressed]}
                onPress={onClose}>
                <Text style={styles.btnSecondaryText}>
                  {translate('kiosk.menu.startOverModalNo')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modalIcon: {
    width: 60,
    height: 60,
    alignSelf: 'center',
    marginBottom: 4,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: theme.color.bgPrimary,
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
  },
  title: {
    fontFamily: theme.font.bold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontFamily: theme.font.regular,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginTop: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  btnPrimary: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.color.accentPrimary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    color: theme.color.onAccent,
    textAlign: 'center',
  },
  btnSecondary: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.color.bgMuted,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    color: theme.color.textPrimary,
    textAlign: 'center',
  },
  btnPressed: {
    opacity: 0.9,
  },
});
