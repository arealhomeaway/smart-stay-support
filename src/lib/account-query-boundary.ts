import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncPreviewAccount } from "./preview-account-boundary";

// Survives layout unmounts (for example, while the sign-in page is open),
// without retaining QueryClients after their application instance is gone.
const cacheIdentities = new WeakMap<QueryClient, string | null>();

/** Clear private in-memory state before a different account's route is loaded. */
export function watchAccountIdentity(
  auth: Pick<SupabaseClient["auth"], "onAuthStateChange">,
  queries: QueryClient,
  initialUserId: string,
  onChange: (userId: string | null) => void,
  revalidate: () => void,
) {
  syncPreviewAccount(initialUserId);
  if (cacheIdentities.get(queries) !== initialUserId) queries.clear();
  cacheIdentities.set(queries, initialUserId);
  let currentId: string | null = initialUserId;
  let refresh: ReturnType<typeof setTimeout> | undefined;
  const { data } = auth.onAuthStateChange((_event, session) => {
    const nextId = session?.user.id ?? null;
    if (nextId === currentId) {
      onChange(nextId);
      return;
    }
    currentId = nextId;
    syncPreviewAccount(nextId);
    cacheIdentities.set(queries, nextId);
    // clear() also destroys pending queries, preventing late results from
    // repopulating the prior account's cache. It cannot undo server mutations.
    queries.clear();
    onChange(nextId);
    if (refresh !== undefined) clearTimeout(refresh);
    // Leave the auth callback before the route calls getUser again.
    refresh = setTimeout(revalidate, 0);
  });
  return () => {
    data.subscription.unsubscribe();
    if (refresh !== undefined) clearTimeout(refresh);
  };
}
