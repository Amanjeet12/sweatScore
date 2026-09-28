export function canRetryFailedPlan(
  request:
    | {
        status: 'pending' | 'ready' | 'failed';
        errorCode?: string;
        promptVersion?: string;
      }
    | null
    | undefined,
  currentPromptVersion: string,
  policyResolved = false
): boolean {
  return Boolean(
    request?.status === 'failed' &&
    request.errorCode !== 'superseded' &&
    (request.errorCode !== 'policy_unresolved' || policyResolved) &&
    request.promptVersion === currentPromptVersion
  );
}
