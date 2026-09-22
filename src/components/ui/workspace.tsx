/**
 * Resolve interaction primitives.
 *
 * Three shapes, used everywhere, so an employee always knows how much of
 * Resolve is about to move:
 *
 *  - QuickPeek      — a light look at a record without leaving the queue.
 *  - FocusedAction  — one decision, centred, nothing else competing for
 *                     attention. Full screen on a phone.
 *  - TaskWorkspace  — real work on one record: a wide panel with a fixed
 *                     header, a scrolling body and a sticky action bar.
 *                     Full screen on a phone.
 *
 * These are presentation only. They hold no workflow rules and never decide
 * what an employee may do — the surfaces that use them still own that.
 */
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/* ------------------------------------------------------------------ peek */

export function QuickPeek({
  trigger,
  title,
  subtitle,
  children,
  action,
  align = "start",
}: {
  trigger: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** The one way onward — "Open ticket", "Open home". */
  action?: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children ? <div className="space-y-2 px-4 py-3 text-sm">{children}</div> : null}
        {action ? <div className="border-t px-4 py-2">{action}</div> : null}
      </PopoverContent>
    </Popover>
  );
}

/** A label/value line for the inside of a QuickPeek. */
export function PeekRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- action */

export function FocusedAction({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0 sm:max-w-lg",
          // On a phone the decision owns the screen.
          "max-h-[100dvh] h-[100dvh] w-screen max-w-none rounded-none",
          "sm:h-auto sm:max-h-[85vh] sm:w-full sm:rounded-lg",
        )}
      >
        <div className="border-b px-5 py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="mt-1 text-sm">{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </div>
        <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto px-5 py-4 sm:max-h-[60vh]">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------- workspace */

export function TaskWorkspace({
  open,
  onOpenChange,
  title,
  subtitle,
  headerExtra,
  footer,
  children,
  /** "wide" is the default working panel; "full" is for dense records. */
  width = "wide",
  /**
   * "side" slides in from the right; "center" is a centred pop-up, which reads
   * better for step-by-step work because the content is in front of you rather
   * than in a column at the edge of the screen.
   */
  placement = "side",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: "wide" | "full";
  placement?: "side" | "center";
}) {
  const body = (
    <>
      <div className="flex shrink-0 items-start gap-3 border-b px-5 py-4 pr-12">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{title}</div>
          {subtitle ? <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div> : null}
          {headerExtra ? <div className="mt-2">{headerExtra}</div> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">
          {footer}
        </div>
      ) : null}
    </>
  );

  if (placement === "center") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0",
            width === "full"
              ? "sm:max-w-[min(96vw,72rem)]"
              : "sm:max-w-[min(94vw,56rem)] lg:max-w-[min(90vw,60rem)]",
          )}
        >
          <DialogTitle className="sr-only">
            {typeof title === "string" ? title : "Task"}
          </DialogTitle>
          <DialogDescription className="sr-only">Work on this step.</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 p-0",
          // Phone: full screen. Desktop: a genuine working panel, not a strip.
          width === "full"
            ? "sm:max-w-[min(100vw,72rem)]"
            : "sm:max-w-[min(100vw,56rem)] lg:max-w-[min(90vw,62rem)]",
        )}
      >
        {body}
      </SheetContent>
    </Sheet>
  );
}


/** A plain close button for surfaces that render their own chrome. */
export function WorkspaceCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="gap-1">
      <X className="h-4 w-4" /> Close
    </Button>
  );
}
