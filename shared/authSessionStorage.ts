type TokenStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

/** Match Convex Auth's namespace, and fence stale writes when its provider resets. */
export function createAuthSessionStorage(base: TokenStorage, namespace: string) {
  const suffix = namespace.replace(/[^a-zA-Z0-9]/g, '');
  const keys = ['__convexAuthJWT', '__convexAuthRefreshToken', '__convexAuthOAuthVerifier'].map(
    (key) => `${key}_${suffix}`
  );
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const blocked = new Set<string>();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }
  return {
    storage(): TokenStorage {
      const session = generation;
      return {
        getItem: (key) =>
          enqueue(async () => {
            if (session !== generation || blocked.has(key)) return null;
            const value = await base.getItem(key);
            return session === generation && !blocked.has(key) ? value : null;
          }),
        setItem: (key, value) =>
          enqueue(async () => {
            if (session !== generation) return;
            await base.setItem(key, value);
            blocked.delete(key);
          }),
        removeItem: (key) =>
          enqueue(async () => {
            if (session === generation) await base.removeItem(key);
          }),
      };
    },
    async reset() {
      generation++;
      keys.forEach((key) => blocked.add(key));
      // Serialized after any in-flight write; old providers cannot restore or erase a new login.
      await enqueue(async () => {
        const results = await Promise.allSettled(keys.map((key) => base.removeItem(key)));
        const failed = results.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
      });
    },
  };
}
