// A synchronous lock also invalidates delayed recovery/capture work before React rerenders.
export function createCheckInOperationGuard() {
  let revision = 0;
  let locked = false;
  return {
    snapshot: () => revision,
    isCurrent: (token: number) => token === revision,
    begin: () => {
      if (locked) return null;
      locked = true;
      return ++revision;
    },
    end: (token: number) => {
      if (token === revision) locked = false;
    },
    invalidate: () => {
      revision++;
      locked = false;
    },
  };
}

export type MealFeedbackInput = { helpful?: boolean; correction: string };

// Persist the successful post before attempting private feedback. A retry receives
// that result and cannot call the public share operation again.
export async function shareMealWithFeedback<Result>(input: {
  posted?: Result;
  share: () => Promise<Result>;
  onPosted: (result: Result) => void;
  feedback?: MealFeedbackInput;
  submitFeedback: (feedback: { helpful: boolean; correction: string }) => Promise<unknown>;
}) {
  const result = input.posted ?? (await input.share());
  input.onPosted(result);
  if (input.feedback?.helpful !== undefined) {
    await input.submitFeedback({
      helpful: input.feedback.helpful,
      correction: input.feedback.correction,
    });
  }
  return result;
}

export function mealReportMatchesPhoto(
  storageId: string | undefined,
  report: { storageId: string | null; draft: { storageId: string } | null } | undefined
) {
  return Boolean(
    storageId &&
    report?.storageId === storageId &&
    (!report.draft || report.draft.storageId === storageId)
  );
}

// A server-side retake may have succeeded just before the screen closed. Never
// recover the discarded local photo when its old storage identity was cleared.
export function reconcileCapture<
  T extends {
    storageId?: string;
    uri?: string;
    captureId?: string;
    mealFeedback?: unknown;
    postedMeal?: unknown;
    shareWithoutAnalysis?: boolean;
  },
>(saved: T, storageId: T['storageId']) {
  const discarded = Boolean(saved.storageId && saved.storageId !== storageId);
  return {
    ...saved,
    storageId,
    ...(discarded
      ? {
          uri: undefined,
          captureId: undefined,
          mealFeedback: undefined,
          postedMeal: undefined,
          shareWithoutAnalysis: undefined,
        }
      : {}),
  };
}
