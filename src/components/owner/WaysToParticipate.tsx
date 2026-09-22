/**
 * "Ways to participate this week" — stage-aware suggestions.
 *
 * Deliberately no time figures: ARHA offers the opportunity, the homeowner
 * logs whatever time they actually spend. No tax claims are made here.
 */
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import {
  buildParticipationPrompts,
  PARTICIPATION_PROMPT_NOTE,
} from "@/lib/owner-participation-prompts";

/** Suggestions that point straight at something already waiting on the owner. */
const LINKED_PROMPTS = new Set(["pending-actions", "mood-board", "access"]);

export function WaysToParticipate({
  phase,
  pendingOnboardingActions = 0,
  openReviews = 0,
}: {
  phase: string | null | undefined;
  pendingOnboardingActions?: number;
  openReviews?: number;
}) {
  const prompts = buildParticipationPrompts({ phase, pendingOnboardingActions, openReviews });
  if (prompts.length === 0) return null;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Ways to participate this week
        </span>
      }
      description="Ideas for taking part in running your home. Pick whatever fits your week."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {prompts.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">{p.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">{p.relevance}</p>
            {LINKED_PROMPTS.has(p.id) && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 px-0"
                onClick={() =>
                  document
                    .getElementById("owner-decisions")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Go to what is waiting on you
              </Button>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {PARTICIPATION_PROMPT_NOTE}
      </p>
    </SectionCard>
  );
}
