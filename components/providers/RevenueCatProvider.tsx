import { useAction, useConvex, useQuery } from 'convex/react';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesPackage,
  WebPurchaseRedemptionResultType,
} from 'react-native-purchases';

import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromiseWithType } from '~/utils/catch-promise';

const APIKeys = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  google: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
};

export type RedemptionResult =
  | { status: 'success' }
  | { status: 'expired'; email?: string }
  | { status: 'belongs_to_other_user' }
  | { status: 'invalid' }
  | { status: 'login_required' }
  | { status: 'not_ready' }
  | { status: 'error'; error?: unknown };

interface RevenueCatProps {
  purchasePackage?: (pack: PurchasesPackage) => Promise<'active' | 'inactive' | 'pending'>;
  restorePermissions?: () => Promise<'active' | 'inactive' | 'pending'>;
  packages: PurchasesPackage[];
  offeringsLoading: boolean;
  storeUserIdentified: boolean;
  offeringsError: string | null;
  reloadOfferings: () => Promise<void>;
  hasActiveStoreSubscription: boolean;
  isPro: boolean;
  redeemWebPurchaseUrl: (url: string) => Promise<RedemptionResult>;
}

const RevenueCatContext = createContext<Partial<RevenueCatProps>>({});

const isUserCancelledError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'userCancelled' in error &&
  error.userCancelled === true;

const customerHasActiveSubscription = (customerInfo: CustomerInfo) =>
  customerInfo.activeSubscriptions.length > 0 ||
  Object.keys(customerInfo.entitlements.active).length > 0;

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const convex = useConvex();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [identifiedMemberId, setIdentifiedMemberId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasActiveStoreSubscription, setHasActiveStoreSubscription] = useState(false);
  const billingStatus = useQuery(api.revenueCatEntitlements.myStatus);
  const isPro = billingStatus?.isPro ?? false;
  const reconcileMine = useAction(api.revenueCatEntitlements.reconcileMine);

  const loadOfferings = useCallback(async () => {
    setOfferingsLoading(true);
    setOfferingsError(null);
    try {
      const offerings = await Purchases.getOfferings();
      const available = offerings.current?.availablePackages ?? [];
      setPackages(available);
      if (!available.length)
        setOfferingsError('Subscription plans are unavailable right now. Please try again.');
    } catch (error) {
      console.warn('[RevenueCat] loadOfferings failed', error);
      setOfferingsError('Could not load subscription plans. Please try again.');
    } finally {
      setOfferingsLoading(false);
    }
  }, []);

  const updateCustomerInformation = useCallback(
    async (customerInfo: CustomerInfo) => {
      // SDK CustomerInfo is a signal, never authority for access.
      setHasActiveStoreSubscription(customerHasActiveSubscription(customerInfo));
      if (currentUser?._id && (await Purchases.getAppUserID()) === currentUser._id.toString())
        await reconcileMine({});
    },
    [currentUser?._id, reconcileMine]
  );

  const verifyIdentifiedMember = useCallback(async () => {
    if (!currentUser?._id || (await Purchases.getAppUserID()) !== currentUser._id.toString())
      throw new Error('RevenueCat member identification is pending');
  }, [currentUser?._id]);

  const purchasePackage = useCallback(
    async (pack: PurchasesPackage) => {
      try {
        await verifyIdentifiedMember();
        await Purchases.purchasePackage(pack);
        setHasActiveStoreSubscription(
          customerHasActiveSubscription(await Purchases.getCustomerInfo())
        );
        return await reconcileMine({});
      } catch (error) {
        if (!isUserCancelledError(error)) alert(error);
        throw error;
      }
    },
    [reconcileMine, verifyIdentifiedMember]
  );

  const restorePermissions = useCallback(async () => {
    await verifyIdentifiedMember();
    setHasActiveStoreSubscription(
      customerHasActiveSubscription(await Purchases.restorePurchases())
    );
    return reconcileMine({});
  }, [reconcileMine, verifyIdentifiedMember]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
        const apiKey = Platform.OS === 'android' ? APIKeys.google : APIKeys.apple;

        if (!apiKey) {
          setOfferingsLoading(false);
          setOfferingsError('Subscriptions are unavailable in this build.');
          console.warn('[RevenueCat] API key not configured, skipping initialization');
          return;
        }

        await Purchases.configure({ apiKey });
        if (!cancelled) setIsConfigured(true);
        await loadOfferings();
      } catch (error) {
        setOfferingsLoading(false);
        setOfferingsError('Could not load subscription plans. Please try again.');
        console.warn('[RevenueCat] initialization failed', error);
      }
    };

    init().catch((error) => console.warn('[RevenueCat] initialization failed', error));
    return () => {
      cancelled = true;
    };
  }, [loadOfferings]);

  useEffect(() => {
    if (!isConfigured) return;

    const listener = (info: CustomerInfo) => {
      updateCustomerInformation(info).catch((error) =>
        console.warn('[RevenueCat] Customer info sync failed', error)
      );
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [isConfigured, updateCustomerInformation]);

  useEffect(() => {
    if (!isConfigured || !currentUser?._id) return;

    let cancelled = false;

    const identifyAndSync = async () => {
      try {
        await Purchases.logIn(currentUser._id.toString());
        if (!cancelled) setIdentifiedMemberId(currentUser._id.toString());
        const info = await Purchases.getCustomerInfo();
        if (!cancelled) await updateCustomerInformation(info);
      } catch (error) {
        console.warn('[RevenueCat] User identification failed', error);
      }
    };

    identifyAndSync().catch((error) =>
      console.warn('[RevenueCat] User identification failed', error)
    );
    return () => {
      cancelled = true;
    };
  }, [currentUser?._id, isConfigured, updateCustomerInformation]);

  const redeemWebPurchaseUrl = useCallback(
    async (url: string): Promise<RedemptionResult> => {
      try {
        if (!isConfigured) return { status: 'not_ready' };

        const trimmedUrl = url?.trim();
        if (!trimmedUrl) return { status: 'invalid' };

        const [userError, authenticatedUser] = await CatchPromiseWithType(
          convex.query(api.users.current)
        );

        if (userError || !authenticatedUser?._id) return { status: 'login_required' };

        await Purchases.logIn(authenticatedUser._id.toString());

        if (__DEV__) {
          console.log(
            '[RevenueCatRedemption] RevenueCat user identified',
            await Purchases.getAppUserID()
          );
        }

        const redemption = await Purchases.parseAsWebPurchaseRedemption(trimmedUrl);
        if (!redemption) return { status: 'invalid' };

        const result = await Purchases.redeemWebPurchase(redemption);

        if (__DEV__) console.log('[RevenueCatRedemption] Result', result.result);

        switch (result.result) {
          case WebPurchaseRedemptionResultType.SUCCESS:
            if ((await reconcileMine({})) !== 'active') {
              return {
                status: 'not_ready',
              };
            }

            return { status: 'success' };

          case WebPurchaseRedemptionResultType.EXPIRED:
            return { status: 'expired', email: result.obfuscatedEmail };
          case WebPurchaseRedemptionResultType.PURCHASE_BELONGS_TO_OTHER_USER:
            return { status: 'belongs_to_other_user' };
          case WebPurchaseRedemptionResultType.INVALID_TOKEN:
            return { status: 'invalid' };
          case WebPurchaseRedemptionResultType.ERROR:
            return { status: 'error', error: result.error };
        }
      } catch (error) {
        console.error('[RevenueCat] Web purchase redemption failed', error);
        return { status: 'error', error };
      }
    },
    [convex, isConfigured, reconcileMine]
  );

  const value = useMemo(
    () => ({
      restorePermissions,
      packages,
      offeringsLoading,
      storeUserIdentified: Boolean(
        currentUser?._id && identifiedMemberId === currentUser._id.toString()
      ),
      offeringsError,
      reloadOfferings: loadOfferings,
      purchasePackage,
      hasActiveStoreSubscription,
      isPro,
      redeemWebPurchaseUrl,
    }),
    [
      restorePermissions,
      packages,
      offeringsLoading,
      currentUser?._id,
      identifiedMemberId,
      offeringsError,
      loadOfferings,
      purchasePackage,
      hasActiveStoreSubscription,
      isPro,
      redeemWebPurchaseUrl,
    ]
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
};

export const useRevenueCat = () => useContext(RevenueCatContext) as RevenueCatProps;
