/**
 * "Optional ways to participate" — self-directed opportunities.
 *
 * Nothing in this section is assigned, and nobody is waiting on it. Work the
 * ARHA team needs from the homeowner lives in "Needs your attention" instead.
 *
 * These are a fixed, deterministic set of opportunities chosen from the
 * homeowner's stage. Nothing here is generated, and no time figures are
 * offered: ARHA presents the opportunity, the homeowner logs whatever time
 * they actually spend. No tax claims.
 */
import { Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import {
  buildParticipationPrompts,
  PARTICIPATION_PROMPT_NOTE,
} from "@/lib/owner-participation-prompts";

/**
 * What the homeowner should capture for this kind of activity, so the entry
 * stands on its own later. Descriptive only — never an amount of time.
 */
const EVIDENCE_HINT: Record<string, string> = {
  "mood-board": "Screenshots, saved listings or photos of the pieces you liked.",
  guidebook: "Your written list of places, or a photo of your notes.",
  "guidebook-refresh": "The updated list, or a photo of anywhere new you visited.",
  "house-notes": "The notes or instructions you wrote, or photos of what they describe.",
  "house-notes-refresh": "Your rewritten notes, welcome message or instructions.",
  supplies: "Photos of what is missing, plus any receipts if you bought supplies.",
  "supplies-ongoing": "Photos of the wear or shortage you found, plus any receipts.",
  "amenity-ideas": "Your list of ideas, product links, or photos of what inspired them.",
  "market-inspiration": "Screenshots of the listings you studied and what you noted.",
  planning: "Your notes on pricing, blocked dates or the upgrades you considered.",
};

export function WaysToParticipate({
  phase,
  onLogHours,
  blockedReason = null,
}: {
  phase: string | null | undefined;
  /** Starts a self-recorded entry for this opportunity. */
  onLogHours?: (activity: string) => void;
  /** Shown instead of the buttons when hours cannot be recorded yet. */
  blockedReason?: string | null;
}) {
  const prompts = buildParticipationPrompts({ phase });
  if (prompts.length === 0) return null;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Optional ways to participate
        </span>
      }
      description="Optional opportunities you can take on yourself — nothing here is assigned and nobody is waiting on it. Pick whatever fits your week, do it, then record it with your files or photos so it counts toward your 100-hour benchmark."
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
                    Record this and attach files
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
