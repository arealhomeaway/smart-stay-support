import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { useOpenNotification } from "@/components/notifications/useOpenNotification";
import { useStaffNotifications } from "@/hooks/useStaffNotifications";
import { KIND_LABELS, MARK_ALL_CONFIRM_OVER } from "@/lib/notification-feed";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · Resolve" },
      { name: "description", content: "Every update waiting on you in Resolve, grouped by day." },
      { property: "og:title", content: "Notifications · Resolve" },
      { property: "og:description", content: "Every update waiting on you in Resolve, grouped by day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [kind, setKind] = useState("");
  const [home, setHome] = useState("");
  const n = useStaffNotifications({ unreadOnly, kind: kind || null, home: home.trim() || null });
  const openEntry = useOpenNotification(n.approvalTargets, n.markRead);

  async function markAll() {
    if (n.unreadCount > MARK_ALL_CONFIRM_OVER && !window.confirm(`Mark all ${n.unreadCount} notifications as read?`)) return;
    try {
      await n.markAllRead();
    } catch {
      toast.error("Could not mark notifications read. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader
        title="Notifications"
        description={n.unreadCount ? `${n.unreadCount} unread` : "You're all caught up."}
        actions={
          n.unreadCount > 0 ? (
            <Button size="sm" variant="outline" onClick={markAll}>
              Mark all read
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly((v) => !v)} aria-pressed={unreadOnly}>
          Unread only
        </Button>
        <select
          aria-label="Kind"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">All kinds</option>
          {Object.entries(KIND_LABELS)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
        </select>
        <Input aria-label="Home" placeholder="Home address" className="h-9 w-56" value={home} onChange={(e) => setHome(e.target.value)} />
      </div>
      <div className="rounded-lg border">
        {n.isLoading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</p>
        ) : (
          <NotificationFeed
            rows={n.rows}
            onOpen={(e) => openEntry(e)}
            onMarkRead={(ids) => void n.markRead(ids)}
            hasMore={n.hasMore}
            loadingMore={n.loadingMore}
            onLoadMore={n.loadMore}
          />
        )}
      </div>
    </div>
  );
}
