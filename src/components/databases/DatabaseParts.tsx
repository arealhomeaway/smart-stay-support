import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MODE_CHIP, type DatabaseMode, type DbLink } from "@/lib/databases";

const CHIP_TONE: Record<Exclude<DatabaseMode, "hidden">, string> = {
  edit: "bg-primary/10 text-primary",
  view: "bg-muted text-foreground/80",
  ops_finance: "bg-destructive/10 text-destructive",
};

export function ModeChip({ mode, size = "sm" }: { mode: Exclude<DatabaseMode, "hidden">; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        size === "md" ? "px-3 py-1.5 text-[13px]" : "px-2.5 py-1 text-xs",
        CHIP_TONE[mode],
      )}
    >
      {MODE_CHIP[mode]}
    </span>
  );
}

const LINK_STYLE = {
  outline:
    "inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-background px-4 text-sm font-semibold text-primary hover:bg-primary/5",
  solid:
    "inline-flex min-h-12 items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90",
} as const;

/** A link to where a record is worked. One typed link per kind of page. */
export function DbLinkButton({ link, children, tone = "outline" }: { link: DbLink; children: ReactNode; tone?: keyof typeof LINK_STYLE }) {
  const className = LINK_STYLE[tone];
  switch (link.kind) {
    case "property":
      return (
        <Link to="/property/$propertyId" params={{ propertyId: link.id }} search={link.tab ? { tab: link.tab } : {}} className={className}>
          {children}
        </Link>
      );
    case "onboarding":
      return (
        <Link to="/onboarding/$propertyId" params={{ propertyId: link.id }} search={{}} className={className}>
          {children}
        </Link>
      );
    case "ticket":
      return (
        <Link to="/tickets/$ticketId" params={{ ticketId: link.id }} search={{}} className={className}>
          {children}
        </Link>
      );
    case "booking":
      return (
        <Link to="/direct-bookings/$requestId" params={{ requestId: link.id }} className={className}>
          {children}
        </Link>
      );
    case "page":
      return (
        <Link to={link.to} search={{}} className={className}>
          {children}
        </Link>
      );
  }
}

export function BackToDatabases() {
  return (
    <Link to="/databases" className={cn(LINK_STYLE.outline, "self-start")}>
      Back to Databases
    </Link>
  );
}
