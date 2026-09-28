import { ConvexReactClient } from 'convex/react';
import { router } from 'expo-router';
import { api } from '~/convex/_generated/api';
import { ResumeScreen } from '~/shared/coachResume';

export function resumePath(screen: ResumeScreen) {
  switch (screen) {
    case 'bio':
      return '/(auth)/setup-profile' as const;
    case 'profile':
    case 'daily':
      return '/coach-onboarding' as const;
    case 'health':
      return '/(auth)/ask-health-permission' as const;
    case 'paywall':
      return '/subscription' as const;
    case 'today':
      return '/(tabs)/dashboard' as const;
  }
}

export async function resumeMember(convex: ConvexReactClient) {
  const decision = await convex.query(api.coachResume.myDecision, {});
  router.replace(resumePath(decision.screen));
  return decision;
}
