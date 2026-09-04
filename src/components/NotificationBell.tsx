import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDemo } from "@/components/DemoProvider";

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

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * The one place Resolve tells a teammate that something is waiting on them.
 * Only actionable events land here — assignment, handoff, approval, reopen.
 */
export function NotificationBell({ placement = "header" }: { placement?: "header" | "sidebar" } = {}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { demoMode } = useDemo();

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


  const rows = useMemo(() => data ?? [], [data]);
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
      <PopoverContent align={placement === "sidebar" ? "start" : "end"} side={placement === "sidebar" ? "right" : "bottom"} className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Waiting on you</p>
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
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nothing needs you right now.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((row) => {
                const content = (
                  <div className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        row.read_at
                          ? "bg-transparent"
                          : row.priority === "urgent"
                            ? "bg-destructive"
                            : "bg-primary"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{row.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {timeAgo(row.created_at)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={row.id} className="px-4 py-3 hover:bg-muted/50">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        setOpen(false);
                        void markRead([row.id]);
                        if (row.link_path) {
                          void router.navigate({ to: row.link_path as never });
                        }
                      }}
                    >
                      {content}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
