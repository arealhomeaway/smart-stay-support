/**
 * One home on the Properties list, laid out as the PropertiesList board:
 * photo with the stage and open tickets chips over its top edge, then the
 * address, City, State, the facts line, the chips row and the ticket line.
 *
 * Pure presentation: the page passes the title (usually a link) and the
 * Admin pick box.
 */
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/status";
import { LabelChip } from "@/components/property/PropertyLabels";
import { HomePhoto } from "@/components/property/HomePhoto";
import { carriedOverChip, openTicketsChip, ticketCountLine } from "@/lib/property-card";

export function PropertyListCard({
  address,
  title,
  photoUrl,
  stage,
  onboarding,
  place,
  facts,
  activeOwner,
  labels,
  carried,
  openTickets,
  totalTickets,
  picker,
}: {
  address: string;
  /** The address as a link; defaults to the plain address. */
  title?: ReactNode;
  photoUrl: string | null;
  stage: string;
  onboarding: boolean;
  place: string;
  facts: string;
  activeOwner: boolean;
  labels: { id: string; name: string }[];
  carried: number;
  openTickets: number;
  totalTickets: number;
  picker?: ReactNode;
}) {
  const openChip = openTicketsChip(openTickets);
  const carriedChip = carriedOverChip(carried);
  const countLine = ticketCountLine(openTickets, totalTickets);
  const hasChips = activeOwner || labels.length > 0 || Boolean(carriedChip);
  return (
    <article data-card="property" className="surface flex flex-col overflow-hidden shadow-card">
      <div className="relative h-44 w-full shrink-0">
        <HomePhoto url={photoUrl} alt={address} className="h-full w-full" />
        <div data-part="photo-chips" className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2.5">
          {picker}
          <span className="rounded-full bg-card shadow-sm">
            <StatusBadge tone={onboarding ? "waiting" : "resolved"}>{stage}</StatusBadge>
          </span>
          {openChip ? (
            <span className="rounded-full bg-card shadow-sm">
              <StatusBadge tone="escalated">{openChip}</StatusBadge>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p data-part="address" className="text-base font-semibold leading-snug">
          {title ?? address}
        </p>
        {place ? (
          <p data-part="place" className="text-sm text-muted-foreground">
            {place}
          </p>
        ) : null}
        {facts ? (
          <p data-part="facts" className="text-sm text-muted-foreground">
            {facts}
          </p>
        ) : null}
        {hasChips ? (
          <div data-part="chips" className="mt-1 flex flex-wrap gap-1.5">
            {activeOwner ? <StatusBadge tone="context">Active Owner</StatusBadge> : null}
            {labels.map((l) => (
              <LabelChip key={l.id} name={l.name} />
            ))}
            {carriedChip ? <StatusBadge tone="waiting">{carriedChip}</StatusBadge> : null}
          </div>
        ) : null}
        {countLine ? (
          <p data-part="tickets" className="mt-auto pt-2 text-sm text-muted-foreground">
            {countLine}
          </p>
        ) : null}
      </div>
    </article>
  );
}
