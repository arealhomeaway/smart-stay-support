import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ownerHome, markOwnerAlertsRead } from "@/lib/owner-portal.functions";
import { NotificationList } from "@/components/notifications/NotificationList";

type Alert = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  action_path?: string | null | undefined;
};

/**
 * The homeowner's own alert feed. Staff notifications live in a different
 * table they may never read, so this reads their program alerts instead.
 */
export function OwnerNotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const load = useServerFn(ownerHome);
  const markRead = useServerFn(markOwnerAlertsRead);

  const home = useQuery({
    queryKey: ["owner-home-nav"],
    queryFn: () => load(),
    staleTime: 60_000,
    // Keep the bell current while an owner is already in the portal and staff
    // dispatches a new onboarding task from another session.
    refetchInterval: 15_000,
  });

  const alerts: Alert[] = home.data && home.data.linked ? home.data.alerts : [];
  const unread = alerts.filter((a) => !a.read_at);

  const mark = useMutation({
    mutationFn: (ids: string[]) => markRead({ data: { ids } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["owner-home-nav"] });
      void qc.invalidateQueries({ queryKey: ["owner-home"] });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={
            unread.length ? `${unread.length} unread updates` : "Updates — nothing new"
          }
          className="relative min-h-11 min-w-11 md:min-h-9 md:min-w-9"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread.length > 0 && (
            <span className="numeric absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => mark.mutate(unread.slice(0, 100).map((a) => a.id))}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          <NotificationList
            items={alerts.slice(0, 20)}
            onOpen={(item) => {
              const alert = alerts.find((a) => a.id === item.id);
              if (!item.read_at) mark.mutate([item.id]);
              setOpen(false);
              // Owners only ever land inside their own portal.
              if (alert?.action_path?.startsWith("/owner?")) {
                router.history.push(alert.action_path);
                return;
              }
              void router.navigate({ to: "/owner", search: {}, hash: "owner-decisions" });
            }}
          />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
