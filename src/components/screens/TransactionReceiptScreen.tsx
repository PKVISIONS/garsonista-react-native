/**
 * After payment: full thank-you screen matching the reference.
 *
 * Cordova `kiosk_order_finished` (`www/index.html` + `main.css`):
 * - top: DFC / brand = `kiosk_image3` (`kioskLogoImageUri`); bottom: `garsonista-kiosk-logo.png` (powered by Garsonista)
 * - receipt art `www/img/Group 2087326741.png` → `kiosk-order-receipt-bg.png` (order number only on screen)
 * - cash: receipt prints on payment screen; card: prints here after submit
 *
 * Flow: submit order, print slip; receipt screen auto-returns to `PlaceOrder` after 5s.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CommonActions, useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ROUTES} from '@constants/routes';
import type {RootStackParamList} from '@navigation/types';
import {enqueueOfflineCart, submitCartOnline} from '@services/orderService';
import {sendVivaFinal} from '@services/paymentService';
import {printFinalReceipt} from '@services/printing/printerService';
import {useAuthStore, useCartStore, useCatalogStore, usePaymentStore} from '@store';
import {useNetworkStatus} from '@hooks/useNetworkStatus';
import {buildWireContext} from '@utils/orderContext';
import {
  resolveFiscalisationDataFromInvoiceUrl,
  resolveFiscalisationQrCodeUrlFromInvoiceUrl,
  resolveFiscalisationQrCodeUrlFromPayload,
} from '@utils/fiscalisationFromInvoice';
import {parseVivaFiscalSigningDetails} from '@utils/fiscalSigningDetails';
import {nextTicketNumber} from '@services/ticketCounter';
import {theme} from '@theme/kiosk';
import {KioskTopBrandLogo} from '../KioskTopBrandLogo';
import {buildVivaPaymentUri} from '@services/payment/vivaDeepLink';
import {captureFailedCardAttempt} from '@services/payment/cardPaymentRecovery';
import {navigateToCardFailed} from '@services/payment/vivaFlow';
import {Linking} from 'react-native';
import {kioskLogoImageUri, remoteUriSource} from '@utils/productImage';
import {translate} from '../../stores/Localization/LocalizationStore';
import {
  buildReceiptPrintContext,
  ensureReceiptCatalogPremises,
} from '@utils/receiptCompanyContext';

type Props = NativeStackScreenProps<RootStackParamList, typeof ROUTES.TransactionReceipt>;

const receiptBg = require('../../assets/images/kiosk-order-receipt-bg.png');
const garsonistaPoweredByLogo = require('../../assets/images/garsonista-kiosk-logo.png');

const PRINT_TIMEOUT_MS = 8000;
const RECEIPT_AUTO_RETURN_SECONDS = 5;
const RECEIPT_TIMER_SIZE = 72;
const RECEIPT_TIMER_TICK_COUNT = 28;
const RECEIPT_TIMER_TEXT_SIZE = 18;
const tableLabelFor = (type: 'dine-in' | 'takeaway', tableId: number) =>
  type === 'dine-in' ? `Τραπέζι ${tableId}` : 'Takeaway';
const idleScheduler = globalThis as typeof globalThis & {
  requestIdleCallback?: (callback: () => void) => unknown;
  cancelIdleCallback?: (handle: unknown) => void;
};

function scheduleReceiptTask(task: () => void): () => void {
  if (typeof idleScheduler.requestIdleCallback === 'function') {
    const handle = idleScheduler.requestIdleCallback(task);
    return () => {
      idleScheduler.cancelIdleCallback?.(handle);
    };
  }
  const timeout = setTimeout(task, 0);
  return () => {
    clearTimeout(timeout);
  };
}

function parseAadePayload(raw: string | null | undefined):
  | {
      id: string;
      digest: string;
      signature: string;
    }
  | undefined {
  if (!raw || !raw.trim()) {
    return undefined;
  }
  const unwrapJson = (value: unknown, depth = 0): unknown => {
    if (depth > 2) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return value;
      }
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
        try {
          return unwrapJson(JSON.parse(trimmed), depth + 1);
        } catch {
          return value;
        }
      }
    }
    return value;
  };
  try {
    const parsed = unwrapJson(JSON.parse(raw)) as Record<string, unknown>;
    const candidates = [
      parsed,
      parsed.signature_data,
      parsed.fiscalisationData,
      parsed.fiscalisationSigningDetails,
    ];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }
      const row = candidate as Record<string, unknown>;
      const id = String(row.id ?? row.idtaxdocument ?? '').trim();
      const digest = String(row.digest ?? row.aadeProviderSignatureData ?? '').trim();
      const signature = String(row.signature ?? row.aadeProviderSignature ?? '').trim();
      if (id && digest && signature) {
        if (__DEV__) {
          console.log(
            `[VivaFlow] parseAadePayload id=${id} digestLen=${digest.length} signatureLen=${signature.length} rawPreview=${String(raw).slice(
              0,
              140,
            )}`,
          );
        }
        return {id, digest, signature};
      }
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function parseLegacyVivaSignatureData(raw: string | null | undefined): {
  hasVivaFiscalProvider: boolean;
  fiscalData?: string;
  digest?: string;
  signature?: string;
  id?: string;
} | null {
  if (!raw || !raw.trim()) {
    return null;
  }
  const unwrapJson = (value: unknown, depth = 0): unknown => {
    if (depth > 2) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return value;
      }
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
        try {
          return unwrapJson(JSON.parse(trimmed), depth + 1);
        } catch {
          return value;
        }
      }
    }
    return value;
  };
  try {
    const parsed = unwrapJson(JSON.parse(raw)) as Record<string, unknown>;
    const roots: Record<string, unknown>[] = [parsed];
    const nested = parsed.signature_data;
    if (nested && typeof nested === 'object') {
      roots.push(nested as Record<string, unknown>);
    }
    for (const root of roots) {
      const hasVivaFiscalProvider = Boolean(root.viva_fiscal_provider);
      const fiscalData = String(root.fiscal_data ?? root.fiscalData ?? '').trim();
      const digest = String(root.digest ?? '').trim();
      const signature = String(root.signature ?? '').trim();
      const id = String(root.id ?? root.idtaxdocument ?? '').trim();
      if (hasVivaFiscalProvider || fiscalData || digest || signature || id) {
        if (__DEV__) {
          console.log(
            `[VivaFlow] parseLegacyVivaSignatureData hasVivaFiscalProvider=${String(
              hasVivaFiscalProvider,
            )} fiscalLen=${fiscalData.length} digestLen=${digest.length} signatureLen=${signature.length} id=${id} rawPreview=${String(
              raw,
            ).slice(0, 140)}`,
          );
        }
        return {
          hasVivaFiscalProvider,
          fiscalData: fiscalData || undefined,
          digest: digest || undefined,
          signature: signature || undefined,
          id: id || undefined,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function TransactionReceiptScreen({navigation, route}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const session = useAuthStore(s => s.session);
  const wireRow = useAuthStore(s => s.wireRow);
  const cart = useCartStore(s => s.cart);
  const clearCart = useCartStore(s => s.clear);
  const pendingOrderNumber = usePaymentStore(s => s.pendingOrderNumber);
  const pendingReceiptOrderNumber = usePaymentStore(s => s.pendingReceiptOrderNumber);
  const setPendingReceiptOrderNumber = usePaymentStore(s => s.setPendingReceiptOrderNumber);
  const online = useNetworkStatus();

  const brandLogoUri = useMemo(() => kioskLogoImageUri(wireRow), [wireRow]);
  const topBrandLogoSource = brandLogoUri
    ? remoteUriSource(brandLogoUri)
    : garsonistaPoweredByLogo;

  const [submitting, setSubmitting] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(RECEIPT_AUTO_RETURN_SECONDS);
  const submitStartedRef = useRef(false);
  const paymentMethod = route.params?.paymentMethod ?? 'cash';
  const receiptPrinted = route.params?.receiptPrinted === true;
  const skipCardLaunch = route.params?.skipCardLaunch === true;
  const transactionId = route.params?.transactionId ?? undefined;
  const clientTransactionId = route.params?.clientTransactionId ?? undefined;
  const aadeTransactionId = route.params?.aadeTransactionId ?? undefined;
  const cardType = route.params?.cardType ?? undefined;
  const accountNumber = route.params?.accountNumber ?? undefined;
  const attemptId = route.params?.attemptId ?? 0;
  const legacyMainUserId = Number(wireRow?.main_user_id ?? 0);
  const legacyParoxosCustomersId = Number(wireRow?.paroxos_customers_id ?? 0);
  const accountType =
    legacyParoxosCustomersId === 50
      ? 'demo'
      : String(wireRow?.account_type ?? wireRow?.accountType ?? wireRow?.type_account ?? '');
  const includeIsv =
    ![971, 2851, 3503, 3506].includes(legacyMainUserId) &&
    legacyParoxosCustomersId !== 50;
  const receiptTimerActiveTicks = Math.max(
    0,
    Math.round((remainingSeconds / RECEIPT_AUTO_RETURN_SECONDS) * RECEIPT_TIMER_TICK_COUNT),
  );

  const goHome = useCallback(() => {
    clearCart();
    const resetAction = CommonActions.reset({
      index: 0,
      routes: [{name: ROUTES.PlaceOrder}],
    });
    const parent = navigation.getParent();
    if (parent) {
      parent.dispatch(resetAction);
      return;
    }
    navigation.dispatch(resetAction);
  }, [clearCart, navigation]);

  useEffect(() => {
    submitStartedRef.current = false;
  }, [attemptId]);

  useFocusEffect(
    useCallback(() => {
      if (submitting) {
        setRemainingSeconds(RECEIPT_AUTO_RETURN_SECONDS);
        return undefined;
      }

      setRemainingSeconds(RECEIPT_AUTO_RETURN_SECONDS);
      const countdownId = setInterval(() => {
        setRemainingSeconds(prev => Math.max(prev - 1, 0));
      }, 1000);
      const timeoutId = setTimeout(() => {
        goHome();
      }, RECEIPT_AUTO_RETURN_SECONDS * 1000);

      return () => {
        clearInterval(countdownId);
        clearTimeout(timeoutId);
      };
    }, [goHome, submitting]),
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (submitStartedRef.current) {
        return;
      }
      if (!session || !cart) {
        if (!cancelled) {
          setSubmitting(false);
        }
        return;
      }
      submitStartedRef.current = true;
      const ticket = route.params?.orderNumber ?? pendingOrderNumber ?? nextTicketNumber();
      let receiptOrderNumber: string | null =
        skipCardLaunch && pendingReceiptOrderNumber?.trim()
          ? pendingReceiptOrderNumber.trim()
          : null;
      if (!cancelled && receiptOrderNumber) {
        setOrderNumber(receiptOrderNumber);
      }
      if (paymentMethod === 'card') {
        captureFailedCardAttempt(cart, ticket);
      }
      const ctx = buildWireContext(session, wireRow, cart.tableId);
      const shouldSubmitOrder = !(paymentMethod === 'card' && skipCardLaunch);
      const waitForVivaCallback = paymentMethod === 'card' && !skipCardLaunch;
      try {
        let fiscalisationData: string | undefined;
        let qrCodeUrl: string | undefined;
        let invoiceRaw: string | undefined;
        let backendReceiptPayload: string | undefined;
        let legacySignatureData:
          | {
              hasVivaFiscalProvider: boolean;
              fiscalData?: string;
              digest?: string;
              signature?: string;
              id?: string;
            }
          | null = null;
        const vivaReceiptDetailsFromCallback =
          paymentMethod === 'card'
            ? {
                transactionId,
                cardType,
                accountNumber,
                fiscalisationSigningDetails:
                  route.params?.fiscalisationSigningDetails ?? undefined,
              }
            : undefined;
        let aadePayload:
          | {
              id: string;
              digest: string;
              signature: string;
            }
          | undefined;
        if (online && shouldSubmitOrder) {
          const submitted = await submitCartOnline(cart, ctx, {
            paymentMethod,
            orderNumber: ticket,
            tipAmount: 0,
          });
          const backendOrderNumber =
            submitted.orderNumber?.trim() || submitted.fiscalDoc?.receiptNumber?.trim();
          if (backendOrderNumber) {
            receiptOrderNumber = backendOrderNumber;
            setPendingReceiptOrderNumber(receiptOrderNumber);
            if (!cancelled) {
              setOrderNumber(receiptOrderNumber);
            }
          }
          invoiceRaw = submitted.fiscalDoc?.invoiceUrl;
          backendReceiptPayload =
            submitted.fiscalDoc?.escpos ??
            submitted.fiscalDoc?.signatureData ??
            submitted.fiscalDoc?.fiscalData ??
            invoiceRaw;
          if (__DEV__) {
            console.log(
              `[VivaFlow] TransactionReceipt fiscalDoc invoiceUrlLen=${invoiceRaw?.length ?? 0} escposLen=${submitted.fiscalDoc?.escpos?.length ?? 0} fiscalDataLen=${submitted.fiscalDoc?.fiscalData?.length ?? 0} signatureDataLen=${submitted.fiscalDoc?.signatureData?.length ?? 0} backendReceiptPayloadLen=${backendReceiptPayload?.length ?? 0}`,
            );
            console.log(
              `[VivaFlow] TransactionReceipt fiscalDoc invoiceUrlPreview=${String(invoiceRaw ?? '').slice(
                0,
                160,
              )}`,
            );
            console.log(
              `[VivaFlow] TransactionReceipt fiscalDoc signaturePreview=${String(
                submitted.fiscalDoc?.signatureData ?? '',
              ).slice(0, 160)}`,
            );
          }
          legacySignatureData =
            parseLegacyVivaSignatureData(submitted.fiscalDoc?.signatureData) ??
            parseLegacyVivaSignatureData(invoiceRaw) ??
            parseLegacyVivaSignatureData(backendReceiptPayload);
          fiscalisationData =
            legacySignatureData?.fiscalData ??
            resolveFiscalisationDataFromInvoiceUrl(invoiceRaw) ??
            resolveFiscalisationDataFromInvoiceUrl(backendReceiptPayload) ??
            submitted.fiscalDoc?.fiscalData ??
            undefined;
          if (!legacySignatureData?.hasVivaFiscalProvider) {
            aadePayload =
              parseAadePayload(submitted.fiscalDoc?.signatureData) ??
              parseAadePayload(invoiceRaw) ??
              parseAadePayload(backendReceiptPayload) ??
              aadePayload;
          }
          if (__DEV__) {
            const rawInvoice = submitted.fiscalDoc?.invoiceUrl ?? '';
            console.log(
                `[VivaFlow] TransactionReceipt insert_orders done hasFiscal=${Boolean(
                  fiscalisationData?.trim(),
                )} fiscalLen=${fiscalisationData?.length ?? 0} hasAadePayload=${Boolean(
                  aadePayload?.digest && aadePayload?.signature && aadePayload?.id,
                )} hasVivaFiscalProvider=${String(
                  legacySignatureData?.hasVivaFiscalProvider ?? false,
                )} invoicePreview=${String(rawInvoice).slice(
                  0,
                  120,
                )}`,
            );
            console.log(
              `[VivaFlow] TransactionReceipt launch inputs ticket=${ticket} aadeId=${
                aadePayload?.id ?? 'none'
              } digestLen=${aadePayload?.digest?.length ?? 0} signatureLen=${aadePayload?.signature?.length ?? 0} fiscalPreview=${String(
                fiscalisationData ?? '',
              ).slice(0, 140)} legacyFiscalPreview=${String(
                legacySignatureData?.fiscalData ?? '',
              ).slice(0, 140)}`,
            );
            console.log(
              `[VivaFlow] TransactionReceipt launch raw aade id=${aadePayload?.id ?? 'none'} digest=${aadePayload?.digest ?? 'none'} signature=${aadePayload?.signature ?? 'none'}`,
            );
            console.log(
              `[VivaFlow] TransactionReceipt legacyIsvRule main_user_id=${legacyMainUserId} paroxos_customers_id=${legacyParoxosCustomersId} includeIsv=${String(
                includeIsv,
              )}`,
            );
          }
          if (cancelled) {
            return;
          }
        } else if (shouldSubmitOrder) {
          enqueueOfflineCart(cart, ctx);
          if (cancelled) {
            return;
          }
        }
        if (paymentMethod === 'card' && !skipCardLaunch) {
          if (!fiscalisationData && !aadePayload) {
            if (__DEV__) {
              console.log(
                '[VivaFlow] TransactionReceipt card path: launching without fiscalisationData',
              );
            }
          }
          if (__DEV__) {
            console.log(
              `[VivaFlow] TransactionReceipt launching Viva from insert_orders amount=${cart.items
                .reduce((sum, item) => sum + item.lineTotal, 0)
                .toFixed(2)} fiscalLen=${fiscalisationData?.length ?? 0} aadeId=${aadePayload?.id ?? ''} legacyFiscalProvider=${String(
                  legacySignatureData?.hasVivaFiscalProvider ?? false,
                )}`,
            );
          }
          const vivaClientTransactionId = aadePayload?.id
            ? `AUTX${aadePayload.id}`
            : String(ticket);
          const vivaUri = buildVivaPaymentUri({
            clientTransactionId: vivaClientTransactionId,
            amountEuros: cart.items.reduce((sum, item) => sum + item.lineTotal, 0),
            fiscalisationData,
            includeIsv,
            accountType,
            aade: aadePayload
              ? {
                  providerId: aadePayload.id,
                  digest: aadePayload.digest,
                  signature: aadePayload.signature,
                }
                : undefined,
          });
          if (__DEV__) {
            console.log(
              `[VivaFlow] TransactionReceipt vivaUri inputs hasAade=${Boolean(
                aadePayload?.id && aadePayload?.digest && aadePayload?.signature,
              )} hasFiscal=${Boolean(fiscalisationData?.trim())} clientId=${vivaClientTransactionId} uriLen=${vivaUri.length}`,
            );
            console.log(
              `[VivaFlow] TransactionReceipt vivaUri raw clientId=${vivaClientTransactionId} aadeId=${
                aadePayload?.id ?? 'none'
              } aadeDigest=${aadePayload?.digest ?? 'none'} aadeSignature=${aadePayload?.signature ?? 'none'} fiscalData=${fiscalisationData ?? 'none'}`,
            );
          }
          try {
            const canOpen = await Linking.canOpenURL(vivaUri);
            if (!canOpen) {
              if (!cancelled) {
                setSubmitting(false);
                navigateToCardFailed(navigation, undefined, {cart, orderNumber: ticket});
              }
              return;
            }
            await Linking.openURL(vivaUri);
            if (__DEV__) {
              console.log('[VivaFlow] TransactionReceipt Linking.openURL resolved');
            }
          } catch (e) {
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt Linking.openURL failed msg=${(e as Error)?.message ?? String(
                  e,
                )}`,
              );
            }
            if (!cancelled) {
              setSubmitting(false);
              navigateToCardFailed(navigation, undefined, {cart, orderNumber: ticket});
            }
            return;
          }

          return;
        }

        if (paymentMethod === 'card' && skipCardLaunch) {
          try {
            const catalog = await ensureReceiptCatalogPremises(
              useCatalogStore.getState().data,
            );
            if (catalog && catalog.storePremises.length > 0) {
              useCatalogStore.getState().setBootstrap(catalog);
            }
            const invoiceQrSource = resolveFiscalisationQrCodeUrlFromInvoiceUrl(invoiceRaw);
            const backendQrSource =
              invoiceQrSource ??
              resolveFiscalisationQrCodeUrlFromPayload(backendReceiptPayload ?? '');
            const parsedFiscalSigning = parseVivaFiscalSigningDetails(
              route.params?.fiscalisationSigningDetails ?? fiscalisationData ?? invoiceRaw,
            );
            const rawVivaTransId = String(clientTransactionId ?? ticket);
            const vivaTransIdForFinal = rawVivaTransId.replace(/^AUTX/, '');
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt send_viva_final ids raw=${rawVivaTransId} stripped=${vivaTransIdForFinal} aadeTxId=${
                  aadeTransactionId ?? transactionId ?? 'none'
                }`,
              );
            }
            const vivaFinalResponse = await sendVivaFinal({
              vivaTransId: vivaTransIdForFinal,
              aadeTransactionId: String(aadeTransactionId ?? transactionId ?? ''),
              cardType: cardType ?? '',
              accountNumber: accountNumber ?? '',
              userId: ctx.userId,
              userLogin: ctx.userLogin,
              password: ctx.password,
              notaxdocsToLocalPrinter: 0,
            });
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt send_viva_final response len=${vivaFinalResponse.length}`,
              );
              console.log(
                `[VivaFlow] TransactionReceipt send_viva_final preview=${vivaFinalResponse.slice(
                  0,
                  180,
                )}`,
              );
            }
            try {
              const parsedVivaFinal = JSON.parse(vivaFinalResponse) as Record<
                string,
                unknown
              >;
              const finalInvoiceUrl = String(
                parsedVivaFinal.invoiceUrl ?? parsedVivaFinal.invoice_url ?? '',
              );
              if (finalInvoiceUrl.trim()) {
                invoiceRaw = finalInvoiceUrl;
                backendReceiptPayload = finalInvoiceUrl;
                const finalQr =
                  resolveFiscalisationQrCodeUrlFromInvoiceUrl(finalInvoiceUrl) ??
                  resolveFiscalisationQrCodeUrlFromPayload(finalInvoiceUrl);
                if (finalQr) {
                  qrCodeUrl = finalQr;
                }
                if (__DEV__) {
                  console.log(
                    `[VivaFlow] TransactionReceipt send_viva_final invoiceUrl len=${finalInvoiceUrl.length} qr=${
                      finalQr ?? 'none'
                    }`,
                  );
                }
              }
            } catch {
              /* keep fallback payloads */
            }
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt signingDetailsLen=${
                  route.params?.fiscalisationSigningDetails?.length ?? 0
                } invoiceLen=${invoiceRaw?.length ?? 0} invoiceQr=${
                  invoiceQrSource ?? 'none'
                } backendQr=${
                  backendQrSource ?? 'none'
                } parsedQr=${
                  parsedFiscalSigning?.fiskaltrustQr?.trim() ?? 'none'
                } parsedVivaQr=${parsedFiscalSigning?.vivaQr?.trim() ?? 'none'}`,
              );
            }
            qrCodeUrl =
              backendQrSource?.trim() ||
              parsedFiscalSigning?.fiskaltrustQr?.trim() ||
              parsedFiscalSigning?.vivaQr?.trim() ||
              qrCodeUrl?.trim();
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt QR source=${qrCodeUrl ?? 'none'} fiskaltrust=${
                  parsedFiscalSigning?.fiskaltrustQr?.trim() ?? 'none'
                } viva=${parsedFiscalSigning?.vivaQr?.trim() ?? 'none'}`,
              );
              if (qrCodeUrl) {
                console.log(`[VivaFlow] TransactionReceipt QR value=${qrCodeUrl}`);
              }
            }
            const printPromise = printFinalReceipt(
              session,
              cart,
              buildReceiptPrintContext(wireRow, cart, {
                orderNumber: receiptOrderNumber,
                createdAt: new Date(),
                paymentMethod,
                tableLabel: tableLabelFor(cart.type, cart.tableId),
                serviceLabel:
                  cart.type === 'dine-in' ? 'Κατανάλωση στο χώρο' : 'Takeaway',
                vivaReceiptDetails: {
                  ...parsedFiscalSigning,
                  qrCodeUrl,
                  ...vivaReceiptDetailsFromCallback,
                },
              }, catalog),
            );
            const timeoutPromise = new Promise<null>(resolve =>
              setTimeout(() => resolve(null), PRINT_TIMEOUT_MS),
            );
            const printed = await Promise.race([printPromise, timeoutPromise]);
            if (!cancelled && !printed && __DEV__) {
              console.log('[VivaFlow] TransactionReceipt print timeout (non-blocking)');
            }
          } catch {
            /* optional */
          }
          return;
        }

        if (!receiptPrinted) {
          try {
            const catalog = await ensureReceiptCatalogPremises(
              useCatalogStore.getState().data,
            );
            if (catalog && catalog.storePremises.length > 0) {
              useCatalogStore.getState().setBootstrap(catalog);
            }
            const invoiceQrSource = resolveFiscalisationQrCodeUrlFromInvoiceUrl(invoiceRaw);
            const backendQrSource =
              invoiceQrSource ??
              resolveFiscalisationQrCodeUrlFromPayload(backendReceiptPayload ?? '');
            const parsedFiscalSigning = parseVivaFiscalSigningDetails(
              route.params?.fiscalisationSigningDetails ?? fiscalisationData ?? invoiceRaw,
            );
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt signingDetailsLen=${
                  route.params?.fiscalisationSigningDetails?.length ?? 0
                } invoiceLen=${invoiceRaw?.length ?? 0} invoiceQr=${
                  invoiceQrSource ?? 'none'
                } backendQr=${
                  backendQrSource ?? 'none'
                } parsedQr=${
                  parsedFiscalSigning?.fiskaltrustQr?.trim() ?? 'none'
                } parsedVivaQr=${parsedFiscalSigning?.vivaQr?.trim() ?? 'none'}`,
              );
            }
            qrCodeUrl =
              backendQrSource?.trim() ||
              parsedFiscalSigning?.fiskaltrustQr?.trim() ||
              parsedFiscalSigning?.vivaQr?.trim() ||
              qrCodeUrl?.trim();
            if (__DEV__) {
              console.log(
                `[VivaFlow] TransactionReceipt QR source=${qrCodeUrl ?? 'none'} fiskaltrust=${
                  parsedFiscalSigning?.fiskaltrustQr?.trim() ?? 'none'
                } viva=${parsedFiscalSigning?.vivaQr?.trim() ?? 'none'}`,
              );
              if (qrCodeUrl) {
                console.log(`[VivaFlow] TransactionReceipt QR value=${qrCodeUrl}`);
              }
            }
            const printPromise = printFinalReceipt(
              session,
              cart,
              buildReceiptPrintContext(wireRow, cart, {
                orderNumber: receiptOrderNumber,
                createdAt: new Date(),
                paymentMethod,
                tableLabel: tableLabelFor(cart.type, cart.tableId),
                serviceLabel:
                  cart.type === 'dine-in' ? 'Κατανάλωση στο χώρο' : 'Takeaway',
                vivaReceiptDetails: {
                  ...parsedFiscalSigning,
                  qrCodeUrl,
                  ...vivaReceiptDetailsFromCallback,
                },
              }, catalog),
            );
            const timeoutPromise = new Promise<null>(resolve =>
              setTimeout(() => resolve(null), PRINT_TIMEOUT_MS),
            );
            const printed = await Promise.race([printPromise, timeoutPromise]);
            if (!cancelled && !printed && __DEV__) {
              console.log('[VivaFlow] TransactionReceipt print timeout (non-blocking)');
            }
          } catch {
            /* optional */
          }
        }
        if (paymentMethod !== 'card') {
          clearCart();
        }
      } catch {
        enqueueOfflineCart(cart, ctx);
        if (cancelled) {
          return;
        }
        if (paymentMethod === 'card') {
          if (!cancelled) {
            setSubmitting(false);
            navigateToCardFailed(navigation, undefined, {cart, orderNumber: ticket});
          }
          return;
        }
        clearCart();
      } finally {
        if (!cancelled && !waitForVivaCallback) {
          setSubmitting(false);
        }
      }
    };

    const cancelScheduledRun = scheduleReceiptTask(run);
    return () => {
      cancelled = true;
      cancelScheduledRun();
    };
  }, [
    session,
    wireRow,
    cart,
    online,
    clearCart,
    paymentMethod,
    receiptPrinted,
    route.params?.orderNumber,
    route.params?.attemptId,
    skipCardLaunch,
    pendingOrderNumber,
    setPendingReceiptOrderNumber,
    navigation,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {!submitting ? (
          <View
            style={[
              styles.receiptTimerWrap,
              {
                top: insets.top + 8,
                right: 12,
              },
            ]}
            pointerEvents="none">
            <View
              style={[
                styles.receiptTimerRing,
                {
                  width: RECEIPT_TIMER_SIZE,
                  height: RECEIPT_TIMER_SIZE,
                  borderRadius: RECEIPT_TIMER_SIZE / 2,
                },
              ]}>
              <View style={styles.receiptTimerTickContainer}>
                {Array.from({length: RECEIPT_TIMER_TICK_COUNT}).map((_, index) => {
                  const angle =
                    (index / RECEIPT_TIMER_TICK_COUNT) * (Math.PI * 2) - Math.PI / 2;
                  const markerRadius = RECEIPT_TIMER_SIZE / 2 - 5;
                  const x = RECEIPT_TIMER_SIZE / 2 + markerRadius * Math.cos(angle);
                  const y = RECEIPT_TIMER_SIZE / 2 + markerRadius * Math.sin(angle);
                  const isActive = index < receiptTimerActiveTicks;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.receiptTimerTick,
                        isActive
                          ? styles.receiptTimerTickActive
                          : styles.receiptTimerTickInactive,
                        {
                          left: x - 1.5,
                          top: y - 4,
                          transform: [{rotate: `${((angle * 180) / Math.PI) + 90}deg`}],
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.receiptTimerFace}>
                <Text style={[styles.receiptTimerText, {fontSize: RECEIPT_TIMER_TEXT_SIZE}]}>
                  {remainingSeconds}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.topLogoSection}>
          <KioskTopBrandLogo source={topBrandLogoSource} />
        </View>

        <View style={styles.center}>
          <Text style={styles.thankTitle}>{translate('kiosk.receipt.thankYou')}</Text>
          <Text style={styles.preparing}>{translate('kiosk.receipt.preparing')}</Text>

          <View style={styles.receiptWrap}>
            <ImageBackground
              source={receiptBg}
              style={styles.receiptBg}
              resizeMode="contain">
              <View style={styles.receiptInner}>
                <Text style={styles.orderLabel}>{translate('kiosk.receipt.orderNumber')}</Text>
                {orderNumber?.trim() ? (
                  <Text style={styles.orderDigit}>
                    {orderNumber}
                  </Text>
                ) : submitting ? (
                  <ActivityIndicator
                    size="large"
                    color={theme.color.accentPrimary}
                    style={styles.spinner}
                  />
                ) : (
                  <Text style={styles.orderDigit}>{translate('kiosk.receipt.dash')}</Text>
                )}
              </View>
            </ImageBackground>
          </View>

        </View>

        <View style={styles.footer}>
          <Image
            source={garsonistaPoweredByLogo}
            style={styles.footerGarsonistaLogo}
            resizeMode="contain"
            accessibilityLabel={translate('kiosk.receipt.garsonistaA11y')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.color.bgMuted,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  receiptTimerWrap: {
    position: 'absolute',
    zIndex: 20,
  },
  receiptTimerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  receiptTimerTickContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  receiptTimerTick: {
    position: 'absolute',
    width: 3,
    height: 8,
    borderRadius: 4,
  },
  receiptTimerTickActive: {
    backgroundColor: theme.color.accentPrimary,
  },
  receiptTimerTickInactive: {
    backgroundColor: 'rgba(255, 129, 39, 0.22)',
  },
  receiptTimerFace: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.color.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptTimerText: {
    fontFamily: theme.font.bold,
    color: theme.color.textPrimary,
    fontWeight: '400',
  },
  topLogoSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thankTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  preparing: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.color.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  receiptWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  receiptBg: {
    width: 180,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptInner: {
    paddingVertical: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  orderLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  orderDigit: {
    fontSize: 44,
    fontWeight: '700',
    color: theme.color.accentPrimary,
    textAlign: 'center',
    lineHeight: 48,
  },
  spinner: {
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  footerGarsonistaLogo: {
    width: 650,
    height: 550,
    maxWidth: '100%',
  },
});
