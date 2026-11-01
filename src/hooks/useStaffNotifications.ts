import { useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { allowsInApp, readPreferences } from "@/lib/notification-preferences";
import { markAllUnread, readUnreadKinds } from "@/lib/notification-feed-data";
import { PAGE_SIZE, type ApprovalTarget, type FeedRow } from "@/lib/notification-feed";

export type FeedFilters = { unreadOnly?: boolean; kind?: string | null; home?: string | null };

const COLUMNS = "id, kind, title, body, link_path, priority, read_at, created_at, entity_type, entity_id";

/**
 * Staff notifications for the signed-in person. Row access is the database's
 * own recipient rule; this hook only reads, pages and marks read.
 */
export function useStaffNotifications(filters: FeedFilters = {}, enabled = true) {
  const { demoMode } = useDemo();
  const queryClient = useQueryClient();

  const { data: prefRow } = useQuery({
    queryKey: ["my-notification-preferences"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("user_notification_preferences").select("*").maybeSingle();
      return (data ?? null) as Record<string, unknown> | null;
    },
  });
  const prefs = useMemo(() => readPreferences(prefRow), [prefRow]);

  // True unread count: every unread row, not just the loaded page.
  const unreadQuery = useQuery({
    queryKey: ["staff-notifications", "unread", demoMode],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: () => readUnreadKinds(supabase as never, demoMode),
  });
  const unreadCount = useMemo(
    () => (unreadQuery.data ?? []).filter((k) => allowsInApp(prefs, k)).length,
    [unreadQuery.data, prefs],
  );

  const feed = useInfiniteQuery({
    queryKey: ["staff-notifications", "feed", demoMode, filters],
    enabled,
    initialPageParam: 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("staff_notifications")
        .select(COLUMNS)
        .eq("is_demo", demoMode)
        .is("retracted_at", null);
      if (filters.unreadOnly) q = q.is("read_at", null);
      if (filters.kind) q = q.eq("kind", filters.kind);
      if (filters.home) q = q.ilike("body", `%${filters.home.replace(/[%_]/g, "")}%`);
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as FeedRow[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE),
  });

  const rows = useMemo(
    () => (feed.data?.pages.flat() ?? []).filter((r) => allowsInApp(prefs, r.kind)),
    [feed.data, prefs],
  );

  // Approval notifications point at an approval record; read where it leads.
  const approvalIds = useMemo(
    () =>
      [...new Set(rows.filter((r) => r.kind === "approval_required" && r.entity_id).map((r) => r.entity_id!))].sort(),
    [rows],
  );
  const approvals = useQuery({
    queryKey: ["staff-notifications", "approval-targets", approvalIds],
    enabled: approvalIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("approvals")
        .select("id, kind, entity_id, property_id")
        .in("id", approvalIds);
      const map: Record<string, ApprovalTarget> = {};
      for (const a of data ?? []) map[a.id] = a as ApprovalTarget;
      return map;
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
  }

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    await supabase
      .from("staff_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .is("read_at", null);
    refresh();
  }

  /** One set-based update: every unread notification for this person. */
  async function markAllRead(): Promise<number> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Please sign in again.");
    const count = await markAllUnread(supabase as never, auth.user.id, demoMode);
    refresh();
    return count ?? 0;
  }

  return {
    rows,
    unreadCount,
    approvalTargets: approvals.data ?? {},
    isLoading: feed.isLoading,
    hasMore: !!feed.hasNextPage,
    loadingMore: feed.isFetchingNextPage,
    loadMore: () => void feed.fetchNextPage(),
    markRead,
    markAllRead,
  };
}
