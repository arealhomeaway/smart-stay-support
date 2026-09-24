import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDemo } from "@/components/DemoProvider";
import { allowsInApp, readPreferences } from "@/lib/notification-preferences";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useRole } from "@/hooks/useRole";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link_path: string | null;
  priority: string;
  read_at: string | null;
  created_at: string;
};

/**
 * The one place Resolve tells a teammate that something is waiting on them.
 * Only actionable events land here — assignment, handoff, approval, reopen.
 */
export function NotificationBell({
  placement = "header",
}: { placement?: "header" | "sidebar" } = {}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { demoMode } = useDemo();
  const { canOpen } = useRole();

  const { data } = useQuery({
    queryKey: ["staff-notifications", demoMode],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_notifications")
        .select("id, kind, title, body, link_path, priority, read_at, created_at")
        .eq("is_demo", demoMode)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Each person chooses which kinds of update they want shown here.
  const { data: prefRow } = useQuery({
    queryKey: ["my-notification-preferences"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .maybeSingle();
      return (data ?? null) as Record<string, unknown> | null;
    },
  });
  const prefs = useMemo(() => readPreferences(prefRow), [prefRow]);

  const rows = useMemo(() => (data ?? []).filter((r) => allowsInApp(prefs, r.kind)), [data, prefs]);
  const unread = rows.filter((r) => !r.read_at);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    await supabase
      .from("staff_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {placement === "sidebar" ? (
          <button
            type="button"
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            aria-label={
              unread.length ? `Notifications — ${unread.length} waiting on you` : "Notifications"
            }
          >
            <Bell className="size-4 shrink-0" aria-hidden="true" />
            <span className="group-data-[collapsible=icon]:hidden">Notifications</span>
            {unread.length > 0 && (
              <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold leading-5 text-white group-data-[collapsible=icon]:hidden">
                {unread.length > 9 ? "9+" : unread.length}
              </span>
            )}
          </button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="relative min-h-11 min-w-11 md:min-h-9 md:min-w-9"
            aria-label={
              unread.length ? `Notifications — ${unread.length} waiting on you` : "Notifications"
            }
          >
            <Bell className="size-4" aria-hidden="true" />
            {unread.length > 0 && (
              <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
                {unread.length > 9 ? "9+" : unread.length}
              </span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={placement === "sidebar" ? "start" : "end"}
        side={placement === "sidebar" ? "right" : "bottom"}
        className="w-[22rem] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => markRead(unread.map((r) => r.id))}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          <NotificationList
            items={rows.map((r) => ({ ...r, urgent: r.priority === "urgent" }))}
            onOpen={(row) => {
              setOpen(false);
              if (!row.read_at) void markRead([row.id]);
              const link = rows.find((r) => r.id === row.id)?.link_path;
              // Only open internal destinations this person may still open;
              // the route guard re-checks on arrival as well.
              if (link && link.startsWith("/") && !link.startsWith("//") && canOpen(link)) {
                void router.navigate({ href: link } as never);
              }
            }}
          />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
