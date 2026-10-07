import { isUnanswered } from './coachBodyFeeling';

export type ResumeScreen =
  | 'bio'
  | 'profile'
  | 'health'
  | 'setup'
  | 'daily'
  | 'paywall'
  | 'trial_notifications'
  | 'today';

// Older servers can return Today with inactive access. Enforce the access
// boundary on the client as well, including when opening the paywall itself.
// verifiedAccess is server-owned and already includes the admin exemption.
export function enforceResumeAccess<T extends { screen: ResumeScreen; verifiedAccess: boolean }>(
  decision: T
): T {
  if (
    !decision.verifiedAccess &&
    (decision.screen === 'today' || decision.screen === 'daily' || decision.screen === 'setup')
  ) {
    return { ...decision, screen: 'paywall' };
  }
  return decision;
}

export type ResumeInput = {
  trialNotificationPending?: boolean;
  hasBio: boolean;
  hasProfile: boolean;
  hasHealthContinuation: boolean;
  verifiedAccess: boolean;
  isAdmin?: boolean;
  previouslyVerified?: boolean;
  profileDraft?: Record<string, unknown>;
  dailyDraft?: Record<string, unknown>;
  hasTodayRequest: boolean;
  hasTodayPlan: boolean;
  requestStatus?: 'pending' | 'ready' | 'failed';
  changedDay: boolean;
  setupPending?: boolean;
  completedOnboarding?: boolean;
  returningMember?: boolean;
};

const profileKeys = [
  'weight',
  'goal',
  'bodyFeeling',
  'routineFeeling',
  'foodRelationship',
  'usualSleep',
  'biggestChallenge',
];
const dailyKeys = ['sleep', 'energy', 'upFor', 'trainedYesterday', 'body'];

export function resumeDecision(input: ResumeInput): {
  screen: ResumeScreen;
  question: number;
  changedDay: boolean;
  requestStatus: 'none' | 'pending' | 'ready' | 'failed';
} {
  const base = {
    changedDay: input.changedDay,
    requestStatus: input.hasTodayPlan
      ? ('ready' as const)
      : (input.requestStatus ?? ('none' as const)),
  };
  if (input.isAdmin) return { screen: 'today', question: 0, ...base };
  // Every returning member must pass the subscription gate before Today.
  // Check this before onboarding completeness because legacy accounts may not
  // have the newer coach-profile fields persisted.
  if (!input.verifiedAccess && (input.previouslyVerified || input.returningMember))
    return { screen: 'paywall', question: 0, ...base };
  if (input.returningMember && input.verifiedAccess)
    return { screen: 'today', question: 0, ...base };
  if (!input.hasBio) return { screen: 'bio', question: 0, ...base };
  if (!input.hasProfile)
    return { screen: 'profile', question: firstMissing(profileKeys, input.profileDraft), ...base };
  if (!input.hasHealthContinuation && !input.verifiedAccess)
    return { screen: 'health', question: 0, ...base };
  if (!input.verifiedAccess) return { screen: 'paywall', question: 0, ...base };
  if (input.hasTodayRequest || input.hasTodayPlan || input.completedOnboarding)
    return { screen: 'today', question: 0, ...base };
  return { screen: 'today', question: firstMissing(dailyKeys, input.dailyDraft), ...base };
}

function firstMissing(keys: string[], draft?: Record<string, unknown>): number {
  const missing = keys.findIndex((key) => isUnanswered(draft?.[key]));
  return missing < 0 ? keys.length - 1 : missing;
}
