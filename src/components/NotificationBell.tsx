import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { useOpenNotification } from "@/components/notifications/useOpenNotification";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";
import { MARK_ALL_CONFIRM_OVER } from "@/lib/notification-feed";

/**
 * The one place Resolve tells a teammate that something is waiting on them.
 * Only actionable events land here: assignment, handoff, approval, reopen.
 */
export function NotificationBell({
  placement = "header",
}: { placement?: "header" | "sidebar" } = {}) {
  const [open, setOpen] = useState(false);
  const n = useStaffNotifications({}, open);
  const openEntry = useOpenNotification(n.approvalTargets, n.markRead);
  const unread = n.unreadCount;
  const badge = unread > 99 ? "99+" : String(unread);
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  async function markAll() {
    if (unread > MARK_ALL_CONFIRM_OVER && !window.confirm(`Mark all ${unread} notifications as read?`)) return;
    try {
      await n.markAllRead();
    } catch {
      toast.error("Could not mark notifications read. Please try again.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {placement === "sidebar" ? (
          <button
            type="button"
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            aria-label={label}
          >
            <Bell className="size-4 shrink-0" aria-hidden="true" />
            <span className="group-data-[collapsible=icon]:hidden">Notifications</span>
            {unread > 0 && (
              <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-semibold leading-5 text-white group-data-[collapsible=icon]:hidden">
                {badge}
              </span>
            )}
          </button>
        ) : (
          <Button size="icon" variant="ghost" className="relative min-h-11 min-w-11" aria-label={label}>
            <Bell className="size-4" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
                {badge}
              </span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={placement === "sidebar" ? "start" : "end"}
        side={placement === "sidebar" ? "right" : "bottom"}
        className="w-[24rem] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">
            Notifications{unread > 0 ? <span className="ml-1 font-normal text-muted-foreground">({unread} unread)</span> : null}
          </p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="min-h-11 text-xs" onClick={markAll}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto overscroll-contain">
          <NotificationFeed
            rows={n.rows}
            onOpen={(e) => openEntry(e, () => setOpen(false))}
            onMarkRead={(ids) => void n.markRead(ids)}
            hasMore={n.hasMore}
            loadingMore={n.loadingMore}
            onLoadMore={n.loadMore}
          />
        </div>
        <div className="border-t px-4 py-2 text-right">
          <Link to="/notifications" className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
            See all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
