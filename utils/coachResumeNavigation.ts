import { ConvexReactClient } from 'convex/react';
import { router } from 'expo-router';

import { api } from '~/convex/_generated/api';
import { enforceResumeAccess, ResumeScreen } from '~/shared/coachResume';

export function resumePath(screen: ResumeScreen) {
  switch (screen) {
    case 'bio':
      return '/(auth)/setup-profile' as const;
    case 'profile':
    case 'daily':
      return '/coach-onboarding' as const;
    case 'health':
      return '/(auth)/ask-health-permission' as const;
    case 'setup':
      return '/coach-setup' as const;
    case 'paywall':
      return '/subscription' as const;
    case 'trial_notifications':
      return '/trial-notifications' as const;
    case 'today':
      return '/(tabs)/dashboard' as const;
  }
}

export function resumePathForDecision(decision: {
  screen: ResumeScreen;
  requestStatus: 'none' | 'pending' | 'ready' | 'failed';
  completedOnboarding?: boolean;
  returningMember?: boolean;
}) {
  return resumePath(decision.screen);
}

export async function resumeMember(convex: ConvexReactClient) {
  const decision = enforceResumeAccess(await convex.query(api.coachResume.myDecision, {}));
  router.replace(resumePathForDecision(decision));
  return decision;
}
