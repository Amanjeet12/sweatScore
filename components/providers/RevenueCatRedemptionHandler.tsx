import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { REVENUECAT_PENDING_REDEMPTION_KEY } from '~/utils/revenuecatRedemption';
import { getData, removeData, storage } from '~/utils/storage';

export default function RevenueCatRedemptionHandler() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const { redeemWebPurchaseUrl } = useRevenueCat();
  const processingRef = useRef(false);
  const currentProcessingUrlRef = useRef<string | null>(null);
  const attemptedErrorUrlRef = useRef<string | null>(null);

  const getPendingRedemptionUrl = useCallback(() => {
    const value = getData(REVENUECAT_PENDING_REDEMPTION_KEY);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }, []);

  const clearPendingRedemption = useCallback(() => {
    removeData(REVENUECAT_PENDING_REDEMPTION_KEY);
  }, []);

  const handleSuccess = useCallback(() => {
    clearPendingRedemption();
    Alert.alert(
      "You're Premium! 🎉",
      'Your SweatScore membership is now active.',
      [{ text: 'Continue', onPress: () => router.replace('/(tabs)/dashboard') }],
      { cancelable: false }
    );
  }, [clearPendingRedemption]);

  const handleExpired = useCallback(
    (email?: string) => {
      clearPendingRedemption();
      const destination = email
        ? `\n\nA new link has been sent to: ${email}`
        : '\n\nPlease use the latest link sent to your email.';
      Alert.alert('Link Expired', `This redemption link has expired.${destination}`, [
        { text: 'OK' },
      ]);
    },
    [clearPendingRedemption]
  );

  const handleOtherUser = useCallback(() => {
    clearPendingRedemption();
    Alert.alert(
      'Different Account',
      'This subscription is already linked to another SweatScore account.\n\nPlease sign in with the account associated with this purchase.',
      [{ text: 'OK' }]
    );
  }, [clearPendingRedemption]);

  const handleInvalid = useCallback(() => {
    clearPendingRedemption();
    Alert.alert(
      'Invalid Link',
      'This subscription redemption link is invalid.\n\nPlease use the latest link sent to your email.',
      [{ text: 'OK' }]
    );
  }, [clearPendingRedemption]);

  const handleError = useCallback((error?: unknown) => {
    if (__DEV__) console.error('[RevenueCatRedemption] Redemption failed', error);
    Alert.alert(
      'Could Not Activate Membership',
      'We could not activate your membership right now. Check your connection, then open the redemption link again.',
      [{ text: 'OK' }]
    );
  }, []);

  const processRedemptionUrl = useCallback(
    async (url: string) => {
      const normalizedUrl = url.trim();

      if (
        !normalizedUrl ||
        !currentUser?._id ||
        !currentUser.onboarded ||
        processingRef.current ||
        currentProcessingUrlRef.current === normalizedUrl ||
        attemptedErrorUrlRef.current === normalizedUrl
      ) {
        return;
      }

      processingRef.current = true;
      currentProcessingUrlRef.current = normalizedUrl;

      try {
        const result = await redeemWebPurchaseUrl(normalizedUrl);

        switch (result.status) {
          case 'success':
            handleSuccess();
            break;
          case 'expired':
            handleExpired(result.email);
            break;
          case 'belongs_to_other_user':
            handleOtherUser();
            break;
          case 'invalid':
            handleInvalid();
            break;
          case 'error':
            attemptedErrorUrlRef.current = normalizedUrl;
            handleError(result.error);
            break;
          case 'login_required':
          case 'not_ready':
            break;
        }
      } catch (error) {
        attemptedErrorUrlRef.current = normalizedUrl;
        handleError(error);
      } finally {
        processingRef.current = false;
        currentProcessingUrlRef.current = null;
      }
    },
    [
      currentUser?._id,
      handleError,
      handleExpired,
      handleInvalid,
      handleOtherUser,
      handleSuccess,
      redeemWebPurchaseUrl,
    ]
  );

  const processPendingRedemption = useCallback(async () => {
    if (!currentUser?._id || !currentUser.onboarded) return;

    const pendingUrl = getPendingRedemptionUrl();
    if (pendingUrl) await processRedemptionUrl(pendingUrl);
  }, [currentUser?._id, currentUser?.onboarded, getPendingRedemptionUrl, processRedemptionUrl]);

  useEffect(() => {
    processPendingRedemption().catch(handleError);
  }, [handleError, processPendingRedemption]);

  // Expo Router's +native-intent is the sole URL entry point. Watching its
  // MMKV write also handles warm links without a second Linking URL listener.
  useEffect(() => {
    const subscription = storage.addOnValueChangedListener((key) => {
      if (key === REVENUECAT_PENDING_REDEMPTION_KEY) {
        attemptedErrorUrlRef.current = null;
        processPendingRedemption().catch(handleError);
      }
    });

    return subscription.remove;
  }, [handleError, processPendingRedemption]);

  return null;
}
