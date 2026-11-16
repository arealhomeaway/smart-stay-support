import { Compass, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { useRole } from "@/hooks/useRole";
import { GUIDED_TOURS, sectionsFor } from "@/lib/guided-tours";
import { useGuidedTour } from "@/components/tours/GuidedTour";

/** Help page: replay your team's tour, or one part of it. */
export function GuidedToursCard() {
  const { teams, start } = useGuidedTour();
  const { roles, seats } = useRole();
  if (teams.length === 0) return null;
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Compass className="size-4" aria-hidden="true" /> Guided tours
        </span>
      }
      description="Walk the real screens step by step. Replay the whole tour or one part."
    >
      <div className={`grid gap-6 ${teams.length > 1 ? "lg:grid-cols-2" : ""}`} data-testid="guided-tours-card">
        {teams.map((team) => {
          const sections = sectionsFor(team, { roles, seats });
          const total = sections.reduce((n, s) => n + s.steps.length, 0);
          return (
            <div key={team} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{GUIDED_TOURS[team].label}</p>
                  <p className="text-sm text-muted-foreground">
                    {sections.length} parts, {total} steps
                  </p>
                </div>
                <Button className="min-h-11" onClick={() => start(team)}>
                  <Play className="size-4" aria-hidden="true" /> Start the tour
                </Button>
              </div>
              <ol className="divide-y divide-border rounded-md border border-border">
                {sections.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="min-w-0 text-sm">
                      <span className="numeric mr-2 text-muted-foreground">{i + 1}.</span>
                      {s.title}
                      <span className="ml-2 text-xs text-muted-foreground">{s.steps.length} steps</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 shrink-0"
                      aria-label={`Replay ${s.title}`}
                      onClick={() => start(team, s.id)}
                    >
                      Replay
                    </Button>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
