type DeletionActions = {
  deleteAccount: () => Promise<{ success: boolean } | null | undefined>;
  clearUser: () => void;
  clearSession: () => Promise<unknown>;
  onDeleted: () => void;
  billingLogout: () => Promise<unknown>;
  onCleanupError: (step: 'clearSession' | 'billingLogout', error: unknown) => void;
};

export async function deleteAccountAndClearSession(actions: DeletionActions) {
  const result = await actions.deleteAccount();
  if (!result?.success) throw new Error('Account deletion was not confirmed');
  try {
    await actions.clearSession();
  } catch (error) {
    actions.onCleanupError('clearSession', error);
  }
  actions.clearUser();
  // Server sessions were removed by deleteAccount. Do not wait for another server sign-out.
  Promise.resolve()
    .then(actions.billingLogout)
    .catch((error) => {
      actions.onCleanupError('billingLogout', error);
    });
  actions.onDeleted();
}
