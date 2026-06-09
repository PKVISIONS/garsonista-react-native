import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useState} from 'react';
import type {ImageSourcePropType, StyleProp, ViewStyle} from 'react-native';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {useAdminAccessStore, useAuthStore} from '@store';
import {kioskTopBrandLogo, kioskTopBrandLogoWrap} from '@theme/kiosk';
import {theme} from '@theme/kiosk';
import {translate} from '../stores/Localization/LocalizationStore';

type Props = {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
};

export function KioskTopBrandLogo({source, style}: Props): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const credentials = useAuthStore(s => s.credentials);
  const setAdminUnlockVisible = useAdminAccessStore(s => s.setUnlockVisible);
  const [unlockVisible, setUnlockVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const closeUnlock = () => {
    setUnlockVisible(false);
    setPassword('');
    setError(null);
  };

  const openAdminUnlock = () => {
    setPassword('');
    setError(null);
    setUnlockVisible(true);
  };

  const submitUnlock = () => {
    if (!credentials?.password) {
      setError(translate('kiosk.admin.unlockPasswordUnavailable'));
      return;
    }
    if (password === credentials.password) {
      closeUnlock();
      navigation.navigate(ROUTES.AdminSettings);
      return;
    }
    setError(translate('kiosk.admin.unlockWrongPassword'));
  };

  useEffect(() => {
    setAdminUnlockVisible(unlockVisible);
    return () => setAdminUnlockVisible(false);
  }, [setAdminUnlockVisible, unlockVisible]);

  return (
    <>
      <Pressable
        delayLongPress={1800}
        onLongPress={openAdminUnlock}
        accessibilityRole="imagebutton"
        accessibilityLabel={translate('kiosk.receipt.brand')}>
        <View style={[kioskTopBrandLogoWrap, style]}>
          <Image
            source={source}
            style={kioskTopBrandLogo}
            resizeMode="contain"
            fadeDuration={Platform.OS === 'android' ? 0 : undefined}
            accessibilityLabel={translate('kiosk.receipt.brand')}
          />
        </View>
      </Pressable>
      <Modal
        visible={unlockVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeUnlock}>
        <View style={styles.modalBackdrop}>
          <View style={styles.unlockCard}>
            <Text style={styles.unlockTitle}>{translate('kiosk.admin.unlockTitle')}</Text>
            <Text style={styles.unlockText}>{translate('kiosk.admin.unlockMessage')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={text => {
                setPassword(text);
                setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={translate('kiosk.admin.password')}
              placeholderTextColor={theme.color.textMuted}
              onSubmitEditing={submitUnlock}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.unlockButton} onPress={submitUnlock}>
                <Text style={styles.unlockButtonText}>{translate('kiosk.admin.openSettings')}</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={closeUnlock}>
                <Text style={styles.cancelText}>{translate('kiosk.admin.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    padding: 24,
  },
  unlockCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: theme.color.bgPrimary,
    padding: 22,
  },
  unlockTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.color.textPrimary,
    marginBottom: 6,
  },
  unlockText: {
    fontSize: 14,
    color: theme.color.textSecondary,
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.color.textPrimary,
    backgroundColor: theme.color.bgMuted,
  },
  error: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.danger,
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  unlockButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.accentPrimary,
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.color.onAccent,
  },
});
