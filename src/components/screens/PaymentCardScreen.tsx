import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useRef} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {KioskTouchableOpacity as TouchableOpacity} from '../KioskTouchableOpacity';
import {DEBUG_LOGS_ENABLED} from '@constants/config';
import type {RootStackParamList} from '@navigation/types';
import {buildVivaPaymentUri} from '@services/payment/vivaDeepLink';
import {idtaxdocumentFromClientTransactionId} from '@services/payment/cardPaymentRecovery';
import {navigateToCardFailed} from '@services/payment/vivaFlow';
import {vivaLog} from '@services/payment/vivaLogger';
import {revertSaleKiosk} from '@services/paymentService';
import {useAuthStore, usePaymentStore} from '@store';
import {theme, titleSection} from '@theme/kiosk';
import {translate} from '../../stores/Localization/LocalizationStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentCard'>;

export function PaymentCardScreen({route, navigation}: Props): React.JSX.Element {
  const {amountEuros, fiscalisationData, clientTransactionId, orderNumber} = route.params;
  const txId = String(orderNumber ?? clientTransactionId);
  const wireRow = useAuthStore(s => s.wireRow);
  const mainUserId = Number(wireRow?.main_user_id ?? 0);
  const paroxosCustomersId = Number(wireRow?.paroxos_customers_id ?? 0);
  const accountType =
    paroxosCustomersId === 50
      ? 'demo'
      : String(wireRow?.account_type ?? wireRow?.accountType ?? wireRow?.type_account ?? '');
  const includeIsv =
    ![971, 2851, 3503, 3506].includes(mainUserId) &&
    paroxosCustomersId !== 50;
  const setPhase = usePaymentStore(s => s.setPhase);
  const setError = usePaymentStore(s => s.setError);
  const setVivaRequest = usePaymentStore(s => s.setVivaRequest);
  const setVivaResponse = usePaymentStore(s => s.setVivaResponse);
  const launchedRef = useRef(false);

  const launch = async () => {
    if (DEBUG_LOGS_ENABLED) {
      console.log(
        `[VivaFlow] PaymentCard launch start amount=${amountEuros.toFixed(2)} txId=${txId} hasFiscal=${Boolean(
          fiscalisationData?.trim(),
        )} fiscalLen=${fiscalisationData?.length ?? 0}`,
      );
    }
    setError(null);
    setPhase('initiating');
    if (!fiscalisationData || !fiscalisationData.trim()) {
      if (DEBUG_LOGS_ENABLED) {
        console.log('[VivaFlow] PaymentCard launching without fiscalisationData');
      }
    }
    const uri = buildVivaPaymentUri({
      clientTransactionId: txId,
      amountEuros,
      fiscalisationData,
      includeIsv,
      accountType,
    });
    setVivaRequest(uri);
    setVivaResponse(null);
    vivaLog('PaymentCard intent ready', {
      amountEuros,
      txId,
      clientTransactionId,
      orderNumber: orderNumber ?? null,
      hasFiscalisationData: Boolean(fiscalisationData?.trim()),
      fiscalisationDataLength: fiscalisationData?.length ?? 0,
      accountType,
      includeIsv,
      uri,
    });
    try {
      if (DEBUG_LOGS_ENABLED) {
        console.log('[VivaFlow] PaymentCard deeplink built');
      }
      console.log('[Viva] Launch URI:', uri);
      const can = await Linking.canOpenURL(uri);
      console.log('[Viva] canOpenURL:', can);
      vivaLog('PaymentCard canOpenURL result', {canOpen: can, uri});
      if (DEBUG_LOGS_ENABLED) {
        console.log(`[VivaFlow] Linking.canOpenURL=${String(can)}`);
      }
      if (!can) {
        setPhase('failed');
        setError(translate('kiosk.paymentCard.vivaUnavailable'));
        navigateToCardFailed(navigation);
        return;
      }
      const idtaxdocument =
        idtaxdocumentFromClientTransactionId(clientTransactionId) ??
        idtaxdocumentFromClientTransactionId(txId);
      if (idtaxdocument) {
        if (DEBUG_LOGS_ENABLED) {
          console.log(
            `[VivaFlow] PaymentCard pre-viva revert_sale_kiosk_ajax idtaxdocument=${idtaxdocument}`,
          );
        }
        vivaLog('PaymentCard pre-viva revert_sale_kiosk_ajax start', {
          idtaxdocument,
          lastVivaRequest: uri,
          lastVivaResponse: 'no response yet',
        });
        await revertSaleKiosk(idtaxdocument, {
          lastVivaRequest: uri,
          lastVivaResponse: 'no response yet',
        });
        vivaLog('PaymentCard pre-viva revert_sale_kiosk_ajax done', {
          idtaxdocument,
        });
      }
      setPhase('awaiting_app');
      vivaLog('PaymentCard Linking.openURL start', {uri});
      await Linking.openURL(uri);
      vivaLog('PaymentCard Linking.openURL resolved', {uri});
      if (DEBUG_LOGS_ENABLED) {
        console.log('[VivaFlow] Linking.openURL resolved');
      }
    } catch (e) {
      vivaLog('PaymentCard launch error', {
        name: (e as Error)?.name ?? 'unknown',
        message: (e as Error)?.message ?? String(e),
        uri,
      });
      if (DEBUG_LOGS_ENABLED) {
        console.log(
          `[VivaFlow] PaymentCard launch error name=${(e as Error)?.name ?? 'unknown'} message=${(e as Error)?.message ?? String(e)}`,
        );
      }
      setPhase('failed');
      setError(String(e));
      navigateToCardFailed(navigation);
    }
  };

  useEffect(() => {
    if (DEBUG_LOGS_ENABLED) {
      console.log(
        `[VivaFlow] PaymentCard mounted amount=${amountEuros.toFixed(2)} txId=${txId} hasFiscal=${Boolean(
          fiscalisationData?.trim(),
        )}`,
      );
    }
    if (launchedRef.current) {
      return;
    }
    launchedRef.current = true;
    void launch();
  }, []);

  return (
    <View style={styles.box}>
      <Text style={[titleSection, styles.title]}>{translate('kiosk.paymentCard.title')}</Text>
      <Text style={styles.sub}>{translate('kiosk.paymentCard.sub')}</Text>
      <Text style={styles.sub}>
        {translate('kiosk.paymentCard.amount').replace('{{amount}}', amountEuros.toFixed(2))}
      </Text>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btn}
        onPress={() => {
          void launch();
        }}>
        <Text style={styles.btnText}>{translate('kiosk.paymentCard.open')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.btnGhost}
        onPress={() => setPhase('cancelled')}>
        <Text style={styles.btnGhostText}>{translate('kiosk.paymentCard.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {flex: 1, padding: theme.space.lg, backgroundColor: theme.color.bgPrimary, gap: theme.space.sm},
  title: {marginBottom: theme.space.xs},
  sub: {color: theme.color.textSecondary, marginBottom: theme.space.sm, fontSize: 14, lineHeight: 20},
  btn: {
    backgroundColor: theme.color.accentPrimary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.space.sm,
  },
  btnText: {color: theme.color.onAccent, fontWeight: '600', fontSize: 16},
  btnGhost: {
    backgroundColor: theme.color.bgSecondary,
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
  },
  btnGhostText: {color: theme.color.textPrimary, fontWeight: '600', fontSize: 16},
});
