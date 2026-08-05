import { router, usePathname } from 'expo-router';
import { useCallback, useRef } from 'react';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { useTabStore } from '~/store/useTabStore';

type SubscriptionGuardOptions = {
  redirectTo?: string;
  source?: string;
};

/**
 * Guards premium actions without restricting access to the screen itself.
 * The action must stop when this returns false. We deliberately only return
 * to the originating screen after purchase; callers must never resume an
 * upload or destructive action automatically.
 */
export function useSubscriptionGuard() {
  const { isPro } = useRevenueCat();
  const pathname = usePathname();
  const currentTab = useTabStore((state) => state.currentTab);
  // Settings intentionally has no paywall route; use the dashboard paywall
  // while preserving the settings screen as the post-purchase destination.
  const paywallTab = currentTab === 'settings' ? 'dashboard' : currentTab;
  const openingPaywallRef = useRef(false);

  const requireSubscription = useCallback(
    ({ redirectTo, source }: SubscriptionGuardOptions = {}) => {
      if (isPro) return true;

      if (pathname.includes('paywall') || pathname === '/subscription') {
        return false;
      }

      if (!openingPaywallRef.current) {
        openingPaywallRef.current = true;
        router.push({
          pathname: `/(tabs)/${paywallTab}/paywall` as any,
          params: {
            redirectTo: redirectTo || pathname || '/(tabs)/dashboard',
            ...(source ? { source } : {}),
          },
        });

        // Prevent rapid double taps from stacking multiple paywalls while
        // still allowing the guard to be used again after navigation settles.
        setTimeout(() => {
          openingPaywallRef.current = false;
        }, 750);
      }

      return false;
    },
    [isPro, pathname, paywallTab]
  );

  return { isPro, requireSubscription };
}
