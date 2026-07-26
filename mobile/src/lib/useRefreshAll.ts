import { useCallback, useRef, useState } from "react";

/** The slice of a react-query result this hook needs. */
interface Refetchable {
  refetch: () => Promise<unknown>;
}

/**
 * Pull-to-refresh across every query a screen renders.
 *
 * Screens usually read from several queries at once, so refetching just one
 * leaves the rest of the page stale while the spinner suggests otherwise. This
 * refetches all of them together.
 *
 * Undefined entries are allowed so callers can pass conditionally-enabled
 * queries without juggling the argument list.
 */
export function useRefreshAll(...queries: (Refetchable | undefined)[]) {
  // Tracked separately from each query's isRefetching: a query disabled by a
  // missing param never reports refetching, which would end the gesture at once.
  const [refreshing, setRefreshing] = useState(false);

  // Query objects are recreated every render, so a dependency array would rebuild
  // onRefresh constantly. A ref keeps the callback stable while still reading the
  // current queries — including ones that were undefined on first render.
  const latest = useRef(queries);
  latest.current = queries;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // allSettled, not all: one failing endpoint must not leave the spinner stuck.
    void Promise.allSettled(latest.current.map((q) => q?.refetch())).finally(() =>
      setRefreshing(false),
    );
  }, []);

  return { refreshing, onRefresh };
}
