/**
 * Shared notification bell list. Staff and homeowners read different records
 * (each only their own), but every bell answers the same three questions the
 * same way: what happened, which property, what item — with a timestamp.
 */
import { usDateTime } from "@/lib/dates";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  urgent?: boolean;
};

/** Stored bodies read "Item · Property"; show them as two clear lines. */
function splitBody(body: string): { item: string; property: string | null } {
  const i = body.lastIndexOf(" · ");
  if (i <= 0) return { item: body, property: null };
  return { item: body.slice(0, i), property: body.slice(i + 3) };
}

export function NotificationList({
  items,
  onOpen,
}: {
  items: NotificationItem[];
  onOpen: (item: NotificationItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
    );
  }
  return (
    <ul className="divide-y">
      {items.map((n) => {
        const { item, property } = splitBody(n.body);
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onOpen(n)}
              className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                n.read_at ? "" : "bg-accent/30"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  n.read_at ? "bg-transparent" : n.urgent ? "bg-destructive" : "bg-primary"
                }`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{n.title}</span>
                {item ? (
                  <span className="block line-clamp-2 text-xs text-foreground/80">{item}</span>
                ) : null}
                {property ? (
                  <span className="block text-xs text-muted-foreground">{property}</span>
                ) : null}
                <span className="numeric mt-1 block text-[0.7rem] text-muted-foreground">
                  {usDateTime(n.created_at)}
                  {n.read_at ? "" : " · Unread"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
