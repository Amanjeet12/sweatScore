export type ResumeScreen = 'bio' | 'profile' | 'health' | 'setup' | 'daily' | 'paywall' | 'today';
export type ResumeInput = {
  hasBio: boolean;
  hasProfile: boolean;
  hasHealthContinuation: boolean;
  verifiedAccess: boolean;
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
const dailyKeys = ['sleep', 'energy', 'mood', 'upFor', 'body'];

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
  if (!input.hasBio) return { screen: 'bio', question: 0, ...base };
  // Previously entitled members see an access-limited Today screen while
  // billing is inactive, even if their coach profile was never completed.
  if (!input.verifiedAccess && input.previouslyVerified)
    return { screen: 'today', question: 0, ...base };
  // Returning members always enter Today. A new local day or a missing plan is
  // an invitation to start setup, not a reason to leave the home screen.
  if (input.returningMember) return { screen: 'today', question: 0, ...base };
  if (!input.hasProfile)
    return { screen: 'profile', question: firstMissing(profileKeys, input.profileDraft), ...base };
  if (!input.hasHealthContinuation && !input.verifiedAccess)
    return { screen: 'health', question: 0, ...base };
  if (!input.verifiedAccess)
    return {
      screen: input.setupPending && !input.hasTodayRequest ? 'setup' : 'paywall',
      question: 0,
      ...base,
    };
  if (input.hasTodayRequest || input.hasTodayPlan || input.completedOnboarding)
    return { screen: 'today', question: 0, ...base };
  return { screen: 'daily', question: firstMissing(dailyKeys, input.dailyDraft), ...base };
}

function firstMissing(keys: string[], draft?: Record<string, unknown>): number {
  const missing = keys.findIndex((key) => draft?.[key] === undefined);
  return missing < 0 ? keys.length - 1 : missing;
}
