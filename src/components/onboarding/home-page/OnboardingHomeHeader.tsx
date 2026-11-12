/**
 * Property page Part 1 (1.1): the header shown on every tab of one home's Onboarding view.
 * Photo and name row, three tags plus "+N more", one quiet facts line, the owner row with a
 * button per contact method (the preferred one highlighted), and the buttons row.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { EmailComposer } from "@/components/EmailComposer";
import { OwnerLinkPanel } from "@/components/OwnerLinkPanel";
import { FollowHomeButton } from "@/components/onboarding/OnboardingActivityFeed";
import { HomeContextHeader } from "@/components/property/HomeContextHeader";
import { ShellInlineTrail } from "@/components/nav/ShellNav";
import { readPropertyOwnerFn } from "@/lib/owner-link.functions";
import { ownerContactButtons } from "@/lib/onboarding-home-page";
import { cn } from "@/lib/utils";

export function OnboardingHomeHeader(p: {
  propertyId: string;
  name: string;
  place: string;
  photo: string | null;
  status: string | null;
  activeOwner: boolean;
  health: { behind: boolean; label: string };
  more: string[];
  facts: string;
  /** Admin and Director of Onboarding: "Add owner" when no owner is on file. */
  canAddOwner: boolean;
  onAskOwner: () => void;
  /** The Needs attention strip (1.2), shown between the buttons and the tabs. */
  attention?: ReactNode;
}) {
  const [showMore, setShowMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const read = useServerFn(readPropertyOwnerFn);
  const ownerQ = useQuery({ queryKey: ["property-owner", p.propertyId], queryFn: () => read({ data: { propertyId: p.propertyId } }) });
  const owner = ownerQ.data?.owner ?? null;
  const names = [owner?.name, owner?.coOwnerName].filter((x): x is string => Boolean(x && x.trim()));
  const buttons = owner
    ? ownerContactButtons({ name: owner.name, phone: owner.phone, email: owner.email, telegram: owner.telegram, preferred: owner.preferredMethod })
    : [];
  const tag = "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-medium";
  return (
    <header className="space-y-3" aria-label="This home">
      {/* 1) Photo and name row; the breadcrumb sits above the name. */}
      <div className="flex items-start gap-3">
        {p.photo ? (
          <div className="h-[84px] w-[112px] shrink-0 overflow-hidden rounded-lg bg-sunken">
            <PropertyPhoto url={p.photo} name={p.name} rounded="rounded-none" className="size-full object-cover" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShellInlineTrail />
            <HomeContextHeader propertyId={p.propertyId} current="onboarding" toggleOnly />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="min-w-0 font-display text-2xl leading-tight sm:text-3xl">{p.name}</h1>
            {p.place ? <span className="text-sm text-muted-foreground">{p.place}</span> : null}
          </div>
        </div>
      </div>

      {/* 2) Tags row. */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Tags">
        {p.status ? <span className={cn(tag, "bg-role-you-bg text-role-you-fg")}>{p.status}</span> : null}
        <span className={cn(tag, p.activeOwner ? "bg-role-homeowner-bg text-role-homeowner-fg" : "bg-role-director-bg text-role-director-fg")}>
          {p.activeOwner ? "Active Owner" : "Standard"}
        </span>
        <span className={cn(tag, p.health.behind ? "bg-state-blocked/15 text-late" : "bg-role-you-bg text-role-you-fg")}>{p.health.label}</span>
        {showMore ? p.more.map((m) => <span key={m} className={cn(tag, "bg-muted text-foreground")}>{m}</span>) : null}
        {p.more.length > 0 ? (
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className={cn(tag, "min-h-11 border border-dashed border-border px-3 text-muted-foreground hover:bg-muted sm:min-h-8")}
          >
            {showMore ? "Less" : `+${p.more.length} more`}
          </button>
        ) : null}
      </div>

      {/* 3) Facts line. */}
      <p className="numeric text-sm text-muted-foreground">{p.facts}</p>

      {/* 4) Owner row. */}
      <section className="space-y-2 rounded-lg bg-muted/50 px-3 py-2.5" aria-label="Owner">
        {ownerQ.isPending ? (
          <p className="text-sm text-muted-foreground">Loading the owner…</p>
        ) : owner ? (
          <>
            <p className="text-sm">
              <span className="text-muted-foreground">Owner </span>
              <span className="font-medium">{names.join(" and ") || "Name not on file"}</span>
            </p>
            {buttons.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {buttons.map((b) => (
                  <a
                    key={b.method}
                    href={b.href}
                    target={b.method === "telegram" ? "_blank" : undefined}
                    rel={b.method === "telegram" ? "noopener noreferrer" : undefined}
                    className={cn(
                      "relative inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted",
                      b.preferred ? "border-2 border-role-you-bar bg-role-you-bg text-role-you-fg" : "border-border",
                    )}
                  >
                    <span className="truncate">{b.label}</span>
                    {b.preferred ? (
                      <span className="shrink-0 rounded-full bg-role-you-bar px-1.5 py-0.5 text-[10px] font-semibold text-stage-selected-fg">Preferred</span>
                    ) : null}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No phone or email on file.</p>
            )}
            <p className="text-xs text-muted-foreground">Text and Call open Grasshopper. Email opens Outlook.</p>
          </>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">No owner on file</span>
            {p.canAddOwner ? (
              <>
                <span aria-hidden="true">·</span>
                <Button variant="link" className="h-11 px-0" onClick={() => setAdding(true)}>
                  Add owner
                </Button>
                <OwnerLinkPanel propertyId={p.propertyId} hasOwner={false} open={adding} onOpenChange={setAdding} hideTrigger />
              </>
            ) : null}
          </p>
        )}
      </section>

      {/* 5) Buttons row, left aligned. */}
      <div className="flex flex-wrap items-center gap-2">
        {p.activeOwner ? (
          <Button className="min-h-11 w-full sm:w-auto" onClick={p.onAskOwner}>
            Ask the owner
          </Button>
        ) : (
          <div className="w-full sm:w-auto [&_button]:min-h-11 [&_button]:w-full sm:[&_button]:w-auto">
            <EmailComposer context="property" recordId={p.propertyId} label="Email owner" variant="primary" />
          </div>
        )}
        <FollowHomeButton propertyId={p.propertyId} myHomes />
      </div>

      {p.attention}
    </header>
  );
}
