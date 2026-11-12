/**
 * The side panel every homeowner item opens in (full screen on a phone):
 * status, title, home, sent and answer-by dates, then the item's own sections.
 * Presentation only; each source keeps its own actions.
 */
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { shortDate } from "@/lib/owner-opportunity-board";

export function OwnerSidePanel({
  open,
  onOpenChange,
  status,
  title,
  home,
  sentAt,
  answerBy,
  cover,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  status: string;
  title: string;
  home?: string | null;
  sentAt?: string | null;
  answerBy?: string | null;
  cover?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const meta = [home, sentAt ? `Sent ${shortDate(sentAt)}` : null, answerBy ? `Answer by ${shortDate(answerBy)}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-none flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {cover ? <img src={cover} alt="" width={1024} height={640} className="h-36 w-full object-cover" /> : null}
        <SheetHeader className="space-y-1 border-b border-border px-5 pb-4 pt-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{status}</p>
          <SheetTitle className="pr-8 text-left text-lg leading-snug">{title}</SheetTitle>
          {meta ? <SheetDescription className="numeric text-left">{meta}</SheetDescription> : null}
        </SheetHeader>
        <div className="flex-1 space-y-5 px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

/** One labelled section inside the panel. */
export function PanelSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2" aria-label={label}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </section>
  );
}
