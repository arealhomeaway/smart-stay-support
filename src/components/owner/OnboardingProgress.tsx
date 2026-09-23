/**
 * "Getting your home ready" — a small informational status per home.
 *
 * One line per home (phase, target launch, overall progress). The high-level
 * areas only appear when the homeowner expands a home. Counts only: no task
 * titles, assignees, vendors or costs ever appear here.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { usCalendarDate } from "@/lib/dates";
import { ownerOnboardingActions } from "@/lib/owner-onboarding.functions";
import type { OwnerOnboardingHome } from "@/lib/owner-onboarding.server";

export const PARTICIPATION_PROCESS_NOTE =
  "Your participation can help move certain parts of your property's setup forward. ARHA will continue managing the onboarding process and applying the same property-readiness standards regardless of which Opportunities you choose to participate in.";

function HomeRow({ home, phase }: { home: OwnerOnboardingHome; phase: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{home.name}</span>
          <span className="block text-xs text-muted-foreground">
            {phase ?? "In setup"}
            {home.targetGoLive ? ` · Target launch ${usCalendarDate(home.targetGoLive)}` : ""}
          </span>
        </span>
        <span className="flex w-40 items-center gap-2">
          <Progress value={home.percent} className="h-1.5" aria-label={`${home.name} overall progress`} />
          <span className="numeric w-9 text-right text-xs text-muted-foreground">{home.percent}%</span>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="grid gap-2 border-t border-border px-3 py-3 sm:grid-cols-2">
          {home.tracks.map((track) => (
            <li key={track.key} className="flex items-center justify-between gap-2 text-xs">
              <span>{track.label}</span>
              <span className="numeric text-muted-foreground">{track.percent}%</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OnboardingProgress({
  readOnly,
  programId,
  homeId,
  phaseFor,
}: {
  readOnly: boolean;
  programId: string | null;
  homeId: string | null;
  phaseFor: (propertyId: string) => string | null;
}) {
  const load = useServerFn(ownerOnboardingActions);
  const q = useQuery({
    queryKey: ["owner-onboarding", programId, readOnly],
    queryFn: () => load({ data: { programId, preview: readOnly } }),
  });
  const homes = (q.data?.homes ?? []).filter((h) => !homeId || h.propertyId === homeId);
  if (homes.length === 0) return null;

  return (
    <SectionCard
      title="Getting your home ready"
      description="Where setup stands today. Open a home to see its main areas."
    >
      <ul className="space-y-2">
        {homes.map((home) => (
          <HomeRow key={home.propertyId} home={home} phase={phaseFor(home.propertyId)} />
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{PARTICIPATION_PROCESS_NOTE}</p>
    </SectionCard>
  );
}
