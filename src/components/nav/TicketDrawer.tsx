import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ExternalLink, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const TicketWorkspace = lazy(() =>
  import("@/routes/_authenticated/tickets.$ticketId").then((m) => ({ default: m.TicketWorkspace })),
);

const UUID = /^\/tickets\/([0-9a-f-]{36})\/?$/i;

/** Pure: which ticket a link href opens in the drawer, if any. */
export function drawerTicketId(href: string | null, origin: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    return UUID.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Operations work opens on top of the page the person is already using.
 * Any in-app link to a Ticket (lists, queues, cards, property pages, routine
 * work) opens this drawer instead of leaving the page, so closing it returns
 * them to the same filters, tab and scroll. Modifier-clicks, new tabs and
 * direct URLs still reach the full Ticket page, which carries its own Back.
 */
export function TicketDrawerHost({ children }: { children: ReactNode }) {
  const [ticketId, setTicketId] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("data-full-page")) return;
      const id = drawerTicketId(a.getAttribute("href"), window.location.origin);
      if (!id) return;
      // Already on that full Ticket page: nothing to layer.
      if (UUID.exec(window.location.pathname)?.[1] === id) return;
      e.preventDefault();
      e.stopPropagation();
      setTicketId(id);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Leaving the page (menu, breadcrumb, full page) closes the layer.
  useEffect(() => setTicketId(null), [pathname]);

  const requestClose = useCallback(() => {
    const dirty = Array.from(
      contentRef.current?.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
        "textarea, input[type=text]",
      ) ?? [],
    ).some((el) => el.value.trim().length > 0 && el.defaultValue !== el.value);
    if (dirty && !window.confirm("You have unsaved text in this Ticket. Close without saving it?"))
      return;
    setTicketId(null);
  }, []);

  return (
    <>
      {children}
      <Sheet open={Boolean(ticketId)} onOpenChange={(o) => !o && requestClose()}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(1100px,92vw)] [&>button.absolute]:hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <SheetTitle className="text-base">Ticket</SheetTitle>
            <SheetDescription className="sr-only">
              Work this Ticket without leaving the page you were on.
            </SheetDescription>
            <div className="flex items-center gap-2">
              {ticketId && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/tickets/$ticketId" params={{ ticketId }} data-full-page="">
                    <ExternalLink className="size-4" /> Open full page
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={requestClose} aria-label="Close Ticket">
                <X className="size-4" /> Close
              </Button>
            </div>
          </div>
          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
            {ticketId && (
              <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <TicketWorkspace key={ticketId} ticketId={ticketId} onClose={() => setTicketId(null)} />
              </Suspense>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
