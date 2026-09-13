import { useRef } from 'react';

/** Keep a reactive query visible during argument refreshes, scoped to its owner. */
export function useRetainedQueryResult<T>(result: T | undefined, scope: string) {
  const previous = useRef<{ scope: string; result: T | undefined }>({ scope, result });
  if (previous.current.scope !== scope || result !== undefined) {
    previous.current = { scope, result };
  }
  return result === undefined ? previous.current.result : result;
}
