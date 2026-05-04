import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {RootStackParamList} from '@navigation/types';
import {lookupAfm} from '@services/taxService';
import {theme, titleSection} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'TaxCustomer'>;

export function TaxCustomerScreen(_props: Props): React.JSX.Element {
  const [afm, setAfm] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    setResult(null);
    setLoading(true);
    try {
      const c = await lookupAfm(afm.trim());
      setResult(
        translate('kiosk.tax.result')
          .replace('{{name}}', c.businessName)
          .replace('{{vat}}', c.vatId),
      );
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={[titleSection, styles.title]}>{translate('kiosk.tax.title')}</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        placeholder={translate('kiosk.tax.placeholder')}
        placeholderTextColor={theme.color.textSecondary}
        value={afm}
        onChangeText={setAfm}
      />
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={() => {
          void run();
        }}>
        <Text style={styles.btnText}>{translate('kiosk.tax.search')}</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator style={styles.sp} color={theme.color.accentPrimary} />
      ) : null}
      {result ? <Text style={styles.ok}>{result}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {flex: 1, padding: theme.space.lg, backgroundColor: theme.color.bgPrimary},
  title: {marginBottom: theme.space.md},
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.button,
    padding: 12,
    marginBottom: theme.space.md,
    fontSize: 16,
    color: theme.color.textPrimary,
  },
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
  sp: {marginTop: theme.space.md},
  ok: {marginTop: theme.space.md, color: theme.color.textPrimary, fontSize: 14},
  err: {marginTop: theme.space.md, color: theme.color.danger, fontSize: 14},
});
