/**
 * "Ways to participate this week" — stage-aware suggestions.
 *
 * These are a fixed, deterministic set of suggestions chosen from the
 * homeowner's stage and what is already waiting on them. Nothing here is
 * generated, and no time figures are offered: ARHA presents the opportunity,
 * the homeowner logs whatever time they actually spend. No tax claims.
 *
 * Each suggestion can be worked from here: record what was done, attach a
 * photo or receipt as evidence, or jump to the item that is waiting.
 */
import { Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import {
  buildParticipationPrompts,
  PARTICIPATION_PROMPT_NOTE,
} from "@/lib/owner-participation-prompts";

/** Suggestions that point straight at something already waiting on the owner. */
const LINKED_PROMPTS = new Set(["pending-actions", "mood-board", "access", "work-review"]);

/**
 * What the homeowner should capture for this kind of activity, so the entry
 * stands on its own later. Descriptive only — never an amount of time.
 */
const EVIDENCE_HINT: Record<string, string> = {
  "pending-actions": "Your decision and any note you sent back to the team.",
  "mood-board": "A screenshot of what you approved, or the changes you asked for.",
  guidebook: "Your written list of places, or a photo of your notes.",
  "guidebook-refresh": "The updated list, or a photo of anywhere new you visited.",
  supplies: "Photos of what is missing, plus any receipts if you bought supplies.",
  "supplies-ongoing": "Photos of the wear or shortage you found, plus any receipts.",
  access: "A photo of the lock or router setup, or the instructions you wrote.",
  "work-review": "Your notes or questions about the work you reviewed.",
  planning: "Your notes on pricing, blocked dates or the upgrades you considered.",
};

export function WaysToParticipate({
  phase,
  pendingOnboardingActions = 0,
  openReviews = 0,
  onLogHours,
  blockedReason = null,
  onGoToWaiting,
}: {
  phase: string | null | undefined;
  pendingOnboardingActions?: number;
  openReviews?: number;
  /** Starts a self-recorded entry for this suggestion. */
  onLogHours?: (activity: string) => void;
  /** Shown instead of the buttons when hours cannot be recorded yet. */
  blockedReason?: string | null;
  onGoToWaiting?: () => void;
}) {
  const prompts = buildParticipationPrompts({ phase, pendingOnboardingActions, openReviews });
  if (prompts.length === 0) return null;

  const goToWaiting =
    onGoToWaiting ??
    (() =>
      document
        .getElementById("owner-decisions")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }));

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Ways to participate this week
        </span>
      }
      description="Ideas for taking part in running your home. Pick whatever fits your week, do it, then record it here with a photo or receipt."
    >
      {blockedReason ? (
        <p className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {blockedReason}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {prompts.map((p) => {
          const evidence = EVIDENCE_HINT[p.id];
          return (
            <div key={p.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">{p.relevance}</p>
              {evidence ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Camera className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-medium">Worth attaching:</span> {evidence}
                  </span>
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 pt-1">
                {onLogHours && !blockedReason ? (
                  <Button size="sm" onClick={() => onLogHours(p.title)}>
                    Record this and attach evidence
                  </Button>
                ) : null}
                {LINKED_PROMPTS.has(p.id) ? (
                  <Button size="sm" variant="outline" onClick={goToWaiting}>
                    Go to what is waiting on you
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {PARTICIPATION_PROMPT_NOTE}
      </p>
    </SectionCard>
  );
}
