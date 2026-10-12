import { useConvex } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { useAuthStore } from '~/store/useAuthStore';
import { resumeMember } from '~/utils/coachResumeNavigation';
import { REVENUECAT_PENDING_REDEMPTION_KEY } from '~/utils/revenuecatRedemption';
import { getData, removeData, storage } from '~/utils/storage';

const PENDING_VERIFICATION_KEY = 'pending-revenuecat-verification-member';

export default function RevenueCatRedemptionHandler() {
  const convex = useConvex();
  const currentUser = useAuthStore((state) => state.currentUser);
  const { redeemWebPurchaseUrl, verifyWebPurchase } = useRevenueCat();
  const [verificationRetry, setVerificationRetry] = useState(0);
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

  const handleSuccess = useCallback(async () => {
    removeData(PENDING_VERIFICATION_KEY);
    clearPendingRedemption();
    const decision = await resumeMember(convex);
    if (decision?.screen === 'today' && decision.requestStatus === 'ready')
      setTimeout(
        () =>
          Alert.alert(
            "You're Premium! 🎉",
            'Your saved plan is ready. Choose “View today’s plan” on Today.'
          ),
        300
      );
  }, [clearPendingRedemption, convex]);

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
            await handleSuccess();
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
            break;
          case 'not_ready':
            // Keep the untouched link until the SDK finishes initialization.
            break;
          case 'verification_pending':
            // Redemption succeeded. Never spend this one-use link again.
            storage.set(PENDING_VERIFICATION_KEY, String(currentUser._id));
            clearPendingRedemption();
            setVerificationRetry((value) => value + 1);
            Alert.alert(
              'Verification pending',
              'Your purchase was redeemed. We are checking your membership. You do not need to purchase again.',
              [
                { text: 'OK' },
                {
                  text: 'Retry verification',
                  onPress: () => setVerificationRetry((value) => value + 1),
                },
              ]
            );
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
      clearPendingRedemption,
    ]
  );

  useEffect(() => {
    if (
      !currentUser?._id ||
      !verifyWebPurchase ||
      getData(PENDING_VERIFICATION_KEY) !== String(currentUser._id)
    )
      return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      attempts += 1;
      try {
        const status = await verifyWebPurchase();
        if (cancelled) return;
        if (status === 'active') {
          await handleSuccess();
          return;
        }
      } catch {
        /* Preserve the member-bound pending state for retry. */
      }
      if (!cancelled && attempts < 4) timer = setTimeout(check, 15000);
    };
    check().catch(handleError);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentUser?._id, verifyWebPurchase, verificationRetry, handleSuccess, handleError]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setVerificationRetry((value) => value + 1);
    });
    return () => listener.remove();
  }, []);

  const processPendingRedemption = useCallback(async () => {
    if (!currentUser?._id) return;

    const pendingUrl = getPendingRedemptionUrl();
    if (pendingUrl) await processRedemptionUrl(pendingUrl);
  }, [currentUser?._id, getPendingRedemptionUrl, processRedemptionUrl]);

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
