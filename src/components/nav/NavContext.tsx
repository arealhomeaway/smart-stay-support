/**
 * The shared navigation-context controls.
 *
 * Workspaces call `useWorkspaceOrigin` and hand `originSearch` to every record
 * link they render. Records call `useRecordOrigin` and render `<RecordHeaderNav />`.
 * That is the whole contract — no page invents its own Back behaviour.
 */
import { Link, useRouter, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  queuePosition,
  rememberOrigin,
  rememberScroll,
  resolveOrigin,
  type NaturalParent,
  type OriginSnapshot,
  type QueueItem,
} from "@/lib/nav-context";

/**
 * Register the current page as a workspace an employee can be returned to.
 * The token is derived from the live URL, so tabs, filters, search and sort
 * that live in the URL are part of the remembered state for free.
 */
export function useWorkspaceOrigin(label: string, queue?: QueueItem[]) {
  const router = useRouter();
  const location = router.state.location;
  const href = location.pathname + (location.searchStr ? location.searchStr : "");
  // The queue identity only changes when the visible list changes.
  const queueKey = queue ? queue.map((q) => q.id).join(",") : "";

  const token = useMemo(
    () => rememberOrigin(queue ? { label, href, queue } : { label, href }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, href, queueKey],
  );

  // Remember where they were reading, and put them back there on return.
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (restored.current !== token) {
      restored.current = token;
      const snap = resolveOrigin(token, "ticket");
      if (snap.scrollY && snap.href === href) {
        // Wait for the list to paint before restoring the reading position.
        const id = window.setTimeout(() => window.scrollTo({ top: snap.scrollY ?? 0 }), 60);
        return () => window.clearTimeout(id);
      }
    }
    return;
  }, [token, href]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const onScroll = () => {
      window.clearTimeout(frame);
      frame = window.setTimeout(() => rememberScroll(token, window.scrollY), 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [token]);

  return { token, originSearch: { from: token } as const };
}

/** Read the origin a record was opened from, falling back to its parent collection. */
export function useRecordOrigin(fallback: NaturalParent) {
  const search = useSearch({ strict: false }) as { from?: string };
  const token = search?.from;
  const origin = resolveOrigin(token, fallback);
  return { origin, token };
}

export function useGoBack(origin: OriginSnapshot) {
  const router = useRouter();
  return useCallback(() => {
    router.history.push(origin.href);
  }, [router, origin.href]);
}

/** "← Back to My work" — the destination is always named. */
export function BackControl({
  origin,
  className,
}: {
  origin: OriginSnapshot;
  className?: string;
}) {
  const back = useGoBack(origin);
  return (
    <button
      type="button"
      onClick={back}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-md pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-9",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to {origin.label}
    </button>
  );
}

/** Durable breadcrumb: "My work / Ticket #525". */
export function RecordBreadcrumb({ origin, current }: { origin: OriginSnapshot; current: string }) {
  const back = useGoBack(origin);
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <button type="button" onClick={back} className="hover:text-foreground hover:underline">
        {origin.label}
      </button>
      <span className="px-1.5 text-muted-foreground/60">/</span>
      <span className="text-foreground">{current}</span>
    </nav>
  );
}

/**
 * The standard record header strip: origin-aware Back, breadcrumb, and
 * Previous / Next when the employee is working a queue.
 */
export function RecordHeaderNav({
  origin,
  token,
  current,
  recordId,
  to,
  paramKey,
}: {
  origin: OriginSnapshot;
  token?: string | undefined;
  current: string;
  recordId: string;
  /** Route to use for queue neighbours, e.g. "/tickets/$ticketId". */
  to: string;
  paramKey: string;
}) {
  const position = queuePosition(origin, recordId);
  const linkSearch = token ? { from: token } : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 space-y-0.5">
        <BackControl origin={origin} />
        <RecordBreadcrumb origin={origin} current={current} />
      </div>
      {position && position.total > 1 && (
        <div className="flex items-center gap-1">
          <span className="numeric mr-1 text-xs text-muted-foreground">
            {position.index + 1} of {position.total}
          </span>
          <QueueStep
            to={to}
            paramKey={paramKey}
            item={position.previous}
            search={linkSearch}
            label="Previous"
            icon={<ChevronLeft className="size-4" />}
          />
          <QueueStep
            to={to}
            paramKey={paramKey}
            item={position.next}
            search={linkSearch}
            label="Next"
            icon={<ChevronRight className="size-4" />}
          />
        </div>
      )}
    </div>
  );
}

function QueueStep({
  to,
  paramKey,
  item,
  search,
  label,
  icon,
}: {
  to: string;
  paramKey: string;
  item: QueueItem | null;
  search?: Record<string, string> | undefined;
  label: string;
  icon: React.ReactNode;
}) {
  if (!item) {
    return (
      <Button size="sm" variant="ghost" disabled aria-label={`${label} — none`}>
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link
        to={to}
        params={{ [paramKey]: item.id }}
        search={search as never}
        title={item.label}
        aria-label={`${label}: ${item.label}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </Link>
    </Button>
  );
}

/**
 * The queue rail: on wide screens the list the employee came from stays beside
 * the record, so a queue can be worked without rebuilding the page.
 */
export function QueueRail({
  origin,
  token,
  currentId,
  to,
  paramKey,
}: {
  origin: OriginSnapshot;
  token?: string | undefined;
  currentId: string;
  to: string;
  paramKey: string;
}) {
  const position = queuePosition(origin, currentId);
  if (!position || position.total < 2) return null;
  return (
    <aside
      className="surface sticky top-20 hidden max-h-[calc(100vh-7rem)] w-64 shrink-0 overflow-y-auto xl:block"
      aria-label={`${origin.label} queue`}
    >
      <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {origin.label}
      </p>
      <ul className="p-1">
        {position.queue.map((item) => {
          const active = item.id === currentId;
          return (
            <li key={item.id}>
              <Link
                to={to}
                params={{ [paramKey]: item.id }}
                search={(token ? { from: token } : undefined) as never}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors",
                  active ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60",
                )}
                aria-current={active ? "true" : undefined}
              >
                <span className="block truncate">{item.label}</span>
                {item.sub && <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/**
 * Register the page the employee is on as a plain "somewhere to come back to",
 * without a queue. Used by the shell so short detours — Log work above all —
 * always know the named place they were launched from.
 */
export function useAmbientOrigin(label: string) {
  const router = useRouter();
  const location = router.state.location;
  const href = location.pathname + (location.searchStr ? location.searchStr : "");
  return useMemo(() => rememberOrigin({ label, href }), [label, href]);
}
