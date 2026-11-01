import { useEffect, useRef } from "react";
import { usDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  entrySummary,
  groupFeed,
  splitBody,
  type FeedEntry,
  type FeedRow,
} from "@/lib/notification-feed";

/**
 * Day-grouped notification list shared by the bell and the Notifications
 * page. Repeats of the same kind on the same item show as one line.
 */
export function NotificationFeed({
  rows,
  onOpen,
  onMarkRead,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: FeedRow[];
  onOpen: (entry: FeedEntry) => void;
  onMarkRead: (ids: string[]) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting) && !loadingMore) onLoadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (rows.length === 0 && !hasMore) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>;
  }
  const groups = groupFeed(rows);
  return (
    <div>
      {groups.map((g) => (
        <section key={g.bucket} aria-label={g.bucket}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.bucket}</h3>
            {g.unreadIds.length > 0 && (
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onMarkRead(g.unreadIds)}>
                Mark read
              </Button>
            )}
          </div>
          <ul className="divide-y">
            {g.entries.map((entry) => {
              const unread = entry.unreadIds.length > 0;
              const urgent = entry.rows.some((r) => r.priority === "urgent");
              const { item, property } = splitBody(entry.lead.body);
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${unread ? "bg-accent/30" : ""}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${!unread ? "bg-transparent" : urgent ? "bg-destructive" : "bg-primary"}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{entry.lead.title}</span>
                      {entry.count > 1 ? (
                        <span className="block line-clamp-2 text-xs text-foreground/80">{entrySummary(entry)}</span>
                      ) : (
                        <>
                          {item ? <span className="block line-clamp-2 text-xs text-foreground/80">{item}</span> : null}
                          {property ? <span className="block text-xs text-muted-foreground">{property}</span> : null}
                        </>
                      )}
                      <span className="numeric mt-1 block text-[0.7rem] text-muted-foreground">
                        {usDateTime(entry.lead.created_at)}
                        {unread ? " · Unread" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {hasMore && (
        <div ref={sentinel} className="px-4 py-3 text-center">
          <Button size="sm" variant="ghost" className="text-xs" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
