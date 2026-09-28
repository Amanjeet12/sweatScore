import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';

type SubscriptionGuardOptions = {
  redirectTo?: string;
  source?: string;
  paywallPath?: '/subscription' | '/(tabs)/dashboard/paywall';
};

// RevenueCatProvider.isPro reflects the persisted server-verified entitlement.
// Existing member actions remain gated without opening a second in-app paywall.
export function useSubscriptionGuard() {
  const { isPro } = useRevenueCat();
  const requireSubscription = useCallback(
    (_options: SubscriptionGuardOptions = {}) => {
      if (isPro) return true;
      Alert.alert(
        'Premium access unavailable',
        'Your purchase is not currently verified. Use Restore purchases on Today.'
      );
      return false;
    },
    [isPro]
  );
  return { isPro, requireSubscription };
}
