import { useRef } from 'react';

export function retainQueryResult<T>(
  previous: { scope: string; result: T | undefined },
  result: T | undefined,
  scope: string
) {
  return previous.scope !== scope || result !== undefined ? { scope, result } : previous;
}

/** Keep a reactive query visible during argument refreshes, scoped to its owner. */
export function useRetainedQueryResult<T>(result: T | undefined, scope: string) {
  const previous = useRef<{ scope: string; result: T | undefined }>({ scope, result });
  previous.current = retainQueryResult(previous.current, result, scope);
  return previous.current.result;
}
