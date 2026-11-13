/**
 * Property page Part 1 (1.1, as fixed): the header shown on every tab of one home's Onboarding
 * view. Photo and name row, three tags plus "+N more", one quiet facts line, the one-line owner
 * row (people, the legal owner in gray, the preferred button and "Call or email"), and the
 * buttons row. Needs attention lives on Overview, not here.
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
import { ownerRow, type ContactButton } from "@/lib/onboarding-home-page";
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
  /** Part 2 (2.2): the Chat button with its unread count, after Ask the owner. */
  chat?: ReactNode;
  /** Part 3 (3.6): each tag is a real field; tapping it opens that field in Home details. */
  onTag?: (section: "project" | "owner" | "dates") => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const [showWays, setShowWays] = useState(false);
  const [adding, setAdding] = useState(false);
  const read = useServerFn(readPropertyOwnerFn);
  const ownerQ = useQuery({ queryKey: ["property-owner", p.propertyId], queryFn: () => read({ data: { propertyId: p.propertyId } }) });
  const owner = ownerQ.data?.owner ?? null;
  const row = owner
    ? ownerRow({
        people: owner.people ?? [],
        legal: owner.name,
        phone: owner.phone,
        email: owner.email,
        telegram: owner.telegram,
        preferred: owner.preferredMethod,
      })
    : null;
  const tag = "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-medium";
  return (
    <header className="space-y-3" aria-label="This home">
      {/* 1) Photo and name row; the breadcrumb sits above the name. */}
      <div className="flex items-start gap-3">
        {p.photo ? (
          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-sunken md:h-[84px] md:w-[112px]">
            <PropertyPhoto url={p.photo} name={p.name} rounded="rounded-none" className="size-full object-cover" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShellInlineTrail />
            <HomeContextHeader propertyId={p.propertyId} current="onboarding" toggleOnly />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="min-w-0 font-display text-xl leading-tight md:text-3xl">{p.name}</h1>
            {p.place ? <span className="hidden text-sm text-muted-foreground md:inline">{p.place}</span> : null}
          </div>
        </div>
      </div>

      {/* 2) Tags row. */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Tags">
        {p.status ? <FieldTag className={cn(tag, "bg-role-you-bg text-role-you-fg")} field="Status" onOpen={p.onTag && (() => p.onTag!("project"))}>{p.status}</FieldTag> : null}
        <FieldTag className={cn(tag, p.activeOwner ? "bg-role-homeowner-bg text-role-homeowner-fg" : "bg-role-director-bg text-role-director-fg")} field="Program" onOpen={p.onTag && (() => p.onTag!("owner"))}>
          {p.activeOwner ? "Active Owner" : "Standard"}
        </FieldTag>
        <FieldTag className={cn(tag, p.health.behind ? "bg-state-blocked/15 text-late" : "bg-role-you-bg text-role-you-fg")} field="Schedule" onOpen={p.onTag && (() => p.onTag!("dates"))}>{p.health.label}</FieldTag>
        {showMore ? p.more.map((m) => <FieldTag key={m} className={cn(tag, "bg-muted text-foreground")} field={m} onOpen={p.onTag && (() => p.onTag!("project"))}>{m}</FieldTag>) : null}
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
      <p className="numeric hidden text-sm text-muted-foreground md:block">{p.facts}</p>

      {/* 4) Owner row, one line. */}
      <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/50 px-3 py-2" aria-label="Owner">
        {ownerQ.isPending ? (
          <p className="text-sm text-muted-foreground">Loading the owner…</p>
        ) : owner && row ? (
          <>
            <p className="min-w-0 text-sm">
              <span className="text-muted-foreground">Owner </span>
              <span className="font-medium">{row.names || "Name not on file"}</span>
              {row.legal ? <span className="text-muted-foreground"> · {row.legal}</span> : null}
            </p>
            {row.primary ? (
              <div className="flex flex-wrap items-center gap-2">
                <ContactLink b={row.primary} />
                {row.others.length > 0 ? (
                  <button
                    type="button"
                    aria-expanded={showWays}
                    onClick={() => setShowWays((v) => !v)}
                    className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                  >
                    {showWays ? "Less" : "Call or email"}
                  </button>
                ) : null}
                {showWays ? row.others.map((b) => <ContactLink key={b.method} b={b} />) : null}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No phone or email on file.</span>
            )}
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
        {/* Part 3 (3.7): on a phone Chat floats at the bottom instead. */}
        <div className="hidden md:contents">{p.chat}</div>
        <FollowHomeButton propertyId={p.propertyId} myHomes />
      </div>
    </header>
  );
}

function ContactLink({ b }: { b: ContactButton }) {
  return (
    <a
      href={b.href}
      title={b.detail ?? undefined}
      target={b.method === "telegram" ? "_blank" : undefined}
      rel={b.method === "telegram" ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted",
        b.preferred ? "border-2 border-role-you-bar bg-role-you-bg text-role-you-fg" : "border-border",
      )}
    >
      {b.label}
    </a>
  );
}

/** Part 3 (3.6): a header tag reads a real field; with onOpen it opens that field. */
function FieldTag({ className, field, onOpen, children }: { className: string; field: string; onOpen?: (() => void) | undefined; children: ReactNode }) {
  if (!onOpen) return <span className={className}>{children}</span>;
  return (
    <button type="button" onClick={onOpen} aria-label={`${field}: open in Home details`} className={cn(className, "min-h-11 hover:opacity-90 sm:min-h-8")}>
      {children}
    </button>
  );
}
