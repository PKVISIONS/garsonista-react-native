import React, {useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {observer} from 'mobx-react-lite';
import {theme} from '@theme/kiosk';
import {localizationStore, translate} from '../stores/Localization/LocalizationStore';

/** Two-letter (or localized) code next to the flag — `kiosk.lang.<code>Short` in every locale; fallback ISO upper. */
function kioskLanguageShortLabel(isoCode: string): string {
  const key = `kiosk.lang.${isoCode}Short`;
  const value = translate(key);
  return value === key ? isoCode.toUpperCase() : value;
}

type Props = {
  style?: object;
};

export const LanguageSelector = observer(function LanguageSelector({
  style,
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const code = localizationStore.currentLanguageCode;

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="toolbar"
      accessibilityLabel={translate('kiosk.lang.a11y')}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('kiosk.lang.a11y')}
        onPress={() => setOpen(true)}
        style={({pressed}) => [styles.trigger, pressed && styles.pressed]}>
        <Text style={styles.triggerText}>
          {localizationStore.supportedLanguages.find(l => l.code === code)
            ?.label ?? '🌐'}{' '}
          {kioskLanguageShortLabel(code)}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={translate('kiosk.lang.closePickerA11y')}
          />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <View style={styles.sheet}>
              {localizationStore.supportedLanguages.map(lang => (
                <Pressable
                  key={lang.code}
                  accessibilityRole="button"
                  accessibilityState={{selected: lang.code === code}}
                  style={({pressed}) => [
                    styles.row,
                    lang.code === code && styles.rowOn,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() => {
                    void localizationStore.changeLanguage(lang.code);
                    setOpen(false);
                  }}>
                  <Text style={styles.rowText}>
                    {lang.label} {kioskLanguageShortLabel(lang.code)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  /** ~16px below prior position (kiosk: clearer separation from top safe area) */
  wrap: {
    marginTop: 50,
    marginRight: 40,
  },
  trigger: {
    minWidth: 108,
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 2,
    borderColor: theme.color.borderSubtle,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.textSecondary,
    textAlign: 'center',
  },
  pressed: {opacity: 0.88},
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  sheet: {
    alignSelf: 'center',
    minWidth: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.color.bgPrimary,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.borderSubtle,
  },
  rowOn: {
    backgroundColor: theme.color.bgMuted,
  },
  rowPressed: {opacity: 0.9},
  rowText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.color.textPrimary,
    textAlign: 'center',
  },
});
