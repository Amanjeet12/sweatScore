type DeletionActions = {
  deleteAccount: () => Promise<{ success: boolean } | null | undefined>;
  clearUser: () => void;
  signOut: () => Promise<unknown>;
  billingLogout: () => Promise<unknown>;
  onCleanupError: (step: 'signOut' | 'billingLogout', error: unknown) => void;
};

export async function deleteAccountAndClearSession(actions: DeletionActions) {
  const result = await actions.deleteAccount();
  if (!result?.success) throw new Error('Account deletion was not confirmed');
  actions.clearUser();
  for (const step of ['signOut', 'billingLogout'] as const) {
    try {
      await actions[step]();
    } catch (error) {
      actions.onCleanupError(step, error);
    }
  }
}
