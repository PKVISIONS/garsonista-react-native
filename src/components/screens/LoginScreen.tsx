import {observer} from 'mobx-react-lite';
import React, {useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {KioskTouchableOpacity as TouchableOpacity} from '../KioskTouchableOpacity';
import {LanguageSelector} from '../LanguageSelector';
import {useAuthStore} from '@store';
import {theme, typeCaptionSm} from '@theme/kiosk';
import {formatRequestError} from '@utils/errors';
import {translate} from '../../stores/Localization/LocalizationStore';

export const LoginScreen = observer(function LoginScreen(): React.JSX.Element {
  const {width} = useWindowDimensions();
  const sheetPadH = width < 576 ? 15 : 85;
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(translate('loginScreen.emailAndPasswordRequired'));
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(formatRequestError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <LanguageSelector style={styles.langRow} />
      <View style={[styles.sheet, {paddingHorizontal: sheetPadH}]}>
        <Text style={styles.formTitle}>{translate('loginScreen.title')}</Text>
        <Text style={styles.fieldLabel}>{translate('loginScreen.email')}</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
          placeholder={translate('loginScreen.email')}
          placeholderTextColor={theme.color.textMuted}
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.fieldLabel}>{translate('loginScreen.password')}</Text>
        <TextInput
          style={[styles.input, styles.inputLast]}
          secureTextEntry
          editable={!loading}
          placeholder={translate('loginScreen.password')}
          placeholderTextColor={theme.color.textMuted}
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => {
            void onSubmit();
          }}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.color.onAccent} />
          ) : (
            <Text style={styles.buttonText}>{translate('loginScreen.title')}</Text>
          )}
        </TouchableOpacity>
        {loading ? (
          <Text style={styles.loadingHint}>{translate('loginScreen.loading')}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    paddingTop: 12,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: theme.color.bgMuted,
  },
  langRow: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    marginRight: 4,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: theme.color.bgPrimary,
    borderRadius: 10,
    paddingTop: 55,
    paddingBottom: 55,
  },
  formTitle: {
    fontSize: 30,
    color: theme.color.textLabel,
    lineHeight: 36,
    textTransform: 'uppercase',
    textAlign: 'left',
    width: '100%',
    paddingBottom: 32,
    fontWeight: '400',
  },
  fieldLabel: {
    ...typeCaptionSm,
    fontSize: 13,
    color: theme.color.textLabel,
    lineHeight: 18,
    textTransform: 'uppercase',
    paddingBottom: 11,
    width: '100%',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.inputBorder,
    borderRadius: theme.radius.input,
    height: 55,
    paddingHorizontal: 25,
    marginBottom: 36,
    fontSize: 18,
    fontWeight: '400',
    color: theme.color.textLabel,
    backgroundColor: theme.color.bgPrimary,
  },
  inputLast: {
    marginBottom: 12,
  },
  error: {color: theme.color.danger, marginBottom: theme.space.sm, fontSize: 14},
  button: {
    backgroundColor: theme.color.loginButtonBg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.radius.loginCta,
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 280,
    marginTop: theme.space.sm,
  },
  buttonDisabled: {opacity: 0.55},
  buttonText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
  loadingHint: {
    marginTop: theme.space.md,
    textAlign: 'center',
    fontSize: 15,
    color: theme.color.textSecondary,
    paddingHorizontal: theme.space.sm,
  },
});
