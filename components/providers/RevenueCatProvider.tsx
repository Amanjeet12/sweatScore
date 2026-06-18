import { useMutation, useConvex } from 'convex/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

import { api } from '~/convex/_generated/api';
import { CatchPromiseWithType } from '~/utils/catch-promise';

// Use keys from you RevenueCat API Keys
const APIKeys = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY!,
  google: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY!,
};

interface RevenueCatProps {
  purchasePackage?: (pack: PurchasesPackage) => Promise<void>;
  restorePermissions?: () => Promise<CustomerInfo>;
  packages: PurchasesPackage[];
  isPro: boolean;
}

const RevenueCatContext = createContext<Partial<RevenueCatProps>>({});

// Provide RevenueCat functions to our app
export const RevenueCatProvider = ({ children }: any) => {
  const convex = useConvex();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const updateUserIsPremium = useMutation(api.users.updateUserIsPremium);

  // Load all offerings a user can (currently) purchase
  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setPackages(offerings.current.availablePackages);
      }
    } catch (e) {
      // Store may be unavailable (dev/preview builds on Android). Swallow so
      // the rest of the app still works.
      console.warn('[RevenueCat] loadOfferings failed', e);
    }
  };

  // Admin check runs independently of the store so it works even when
  // Google Play Billing is unreachable (dev/preview builds).
  const syncAdminAsPro = async () => {
    const [error, result] = await CatchPromiseWithType(convex.query(api.users.current));
    if (error) return false;
    if (result?.isAdmin) {
      setIsPro(true);
      return true;
    }
    return false;
  };

  // Update user state based on previous purchases
  const updateCustomerInformation = async (customerInfo: CustomerInfo) => {
    const isAdmin = await syncAdminAsPro();
    if (isAdmin) return;

    const hasActivePremium = customerInfo?.entitlements.active['Premium'] !== undefined;

    // Update local state
    setIsPro(hasActivePremium);

    // Update database - this will trigger a re-fetch of currentUser
    await updateUserIsPremium({
      isPremium: hasActivePremium,
    });
  };

  // Purchase a package
  const purchasePackage = useCallback(async (pack: PurchasesPackage) => {
    try {
      await Purchases.purchasePackage(pack);
    } catch (e: any) {
      if (!e.userCancelled) {
        alert(e);
      }
      throw e; // Re-throw so the caller can handle it
    }
  }, []);

  // // Restore previous purchases
  const restorePermissions = useCallback(async () => {
    const customer = await Purchases.restorePurchases();
    return customer;
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        // Use more logging during debug if want!
        Purchases.setLogLevel(LOG_LEVEL.ERROR);

        // Skip if API keys are not configured
        const hasValidKeys =
          (Platform.OS === 'android' && APIKeys.google) ||
          (Platform.OS === 'ios' && APIKeys.apple);

        if (!hasValidKeys) {
          console.warn('[RevenueCat] API keys not configured, skipping initialization');
          setIsReady(true);
          return;
        }

        if (Platform.OS === 'android') {
          await Purchases.configure({ apiKey: APIKeys.google });
        } else {
          await Purchases.configure({ apiKey: APIKeys.apple });
        }

        // Admin bypass runs first and does not depend on the store.
        const isAdmin = await syncAdminAsPro();

        // Listen for customer updates
        Purchases.addCustomerInfoUpdateListener(async (info) => {
          updateCustomerInformation(info);
        });

        // Load all offerings and the user object with entitlements
        await loadOfferings();

        // Explicitly fetch customer info so isPro is resolved even when the
        // update listener doesn't fire at launch. Skip for admins — already set.
        if (!isAdmin) {
          try {
            const info = await Purchases.getCustomerInfo();
            await updateCustomerInformation(info);
          } catch (e) {
            console.warn('[RevenueCat] getCustomerInfo failed', e);
          }
        }
      } catch (e) {
        console.warn('[RevenueCat] initialization failed', e);
      } finally {
        setIsReady(true);
      }
    };

    init();
  }, []);

  const value = useMemo(
    () => ({
      restorePermissions,
      packages,
      purchasePackage,
      isPro,
    }),
    [restorePermissions, packages, purchasePackage, isPro]
  );

  // Return empty fragment if provider is not ready (Purchase not yet initialised)
  if (!isReady) return <></>;

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
};

// Export context for easy usage
export const useRevenueCat = () => {
  return useContext(RevenueCatContext) as RevenueCatProps;
};
