import { router, usePathname } from 'expo-router';
import { useCallback, useRef } from 'react';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';

type SubscriptionGuardOptions = {
  redirectTo?: string;
  source?: string;
};

export function useSubscriptionGuard() {
  const { isPro } = useRevenueCat();
  const pathname = usePathname();

  const openingPaywallRef = useRef(false);

  const requireSubscription = useCallback(
    ({ redirectTo, source }: SubscriptionGuardOptions = {}) => {
      if (isPro) {
        return true;
      }

      if (pathname === '/subscription' || pathname.includes('paywall')) {
        return false;
      }

      if (openingPaywallRef.current) {
        return false;
      }

      openingPaywallRef.current = true;

      router.push({
        pathname: '/subscription',
        params: {
          redirectTo: redirectTo || pathname || '/(tabs)/dashboard',
          ...(source ? { source } : {}),
        },
      });

      setTimeout(() => {
        openingPaywallRef.current = false;
      }, 750);

      return false;
    },
    [isPro, pathname]
  );

  return {
    isPro,
    requireSubscription,
  };
}
