import { useConvex, useMutation } from 'convex/react';
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
  purchasePackage?: (pack: PurchasesPackage) => Promise<void>;
  restorePermissions?: () => Promise<CustomerInfo>;
  packages: PurchasesPackage[];
  isPro: boolean;
  redeemWebPurchaseUrl: (url: string) => Promise<RedemptionResult>;
}

const RevenueCatContext = createContext<Partial<RevenueCatProps>>({});

const isUserCancelledError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'userCancelled' in error &&
  error.userCancelled === true;

export const RevenueCatProvider = ({ children }: PropsWithChildren) => {
  const convex = useConvex();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const updateUserIsPremium = useMutation(api.users.updateUserIsPremium);

  const loadOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (error) {
      console.warn('[RevenueCat] loadOfferings failed', error);
    }
  }, []);

  const syncAdminAsPro = useCallback(async () => {
    const [error, result] = await CatchPromiseWithType(convex.query(api.users.current));

    if (error) return false;

    if (result?.isAdmin) {
      setIsPro(true);
      return true;
    }

    return false;
  }, [convex]);

  const updateCustomerInformation = useCallback(
    async (customerInfo: CustomerInfo) => {
      if (await syncAdminAsPro()) return;

      const hasActivePremium = customerInfo.entitlements.active['Premium'] !== undefined;

      if (__DEV__) {
        console.log('[RevenueCat] Premium active', hasActivePremium);
      }

      setIsPro(hasActivePremium);
      await updateUserIsPremium({ isPremium: hasActivePremium });
    },
    [syncAdminAsPro, updateUserIsPremium]
  );

  const purchasePackage = useCallback(async (pack: PurchasesPackage) => {
    try {
      await Purchases.purchasePackage(pack);
    } catch (error) {
      if (!isUserCancelledError(error)) alert(error);
      throw error;
    }
  }, []);

  const restorePermissions = useCallback(async () => Purchases.restorePurchases(), []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
        const apiKey = Platform.OS === 'android' ? APIKeys.google : APIKeys.apple;

        if (!apiKey) {
          console.warn('[RevenueCat] API key not configured, skipping initialization');
          return;
        }

        await Purchases.configure({ apiKey });
        if (!cancelled) setIsConfigured(true);
        await loadOfferings();
      } catch (error) {
        console.warn('[RevenueCat] initialization failed', error);
      } finally {
        if (!cancelled) setIsReady(true);
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
            await updateCustomerInformation(result.customerInfo);

            if (result.customerInfo.entitlements.active['Premium'] === undefined) {
              return {
                status: 'error',
                error: new Error(
                  'Redemption succeeded but the Premium entitlement is not active. Check RevenueCat product configuration.'
                ),
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
    [convex, isConfigured, updateCustomerInformation]
  );

  const value = useMemo(
    () => ({ restorePermissions, packages, purchasePackage, isPro, redeemWebPurchaseUrl }),
    [restorePermissions, packages, purchasePackage, isPro, redeemWebPurchaseUrl]
  );

  if (!isReady) return null;

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
};

export const useRevenueCat = () => useContext(RevenueCatContext) as RevenueCatProps;
