import { OwnerCompletionsReview, needsAttention, useOwnerCompletions } from "@/components/onboarding/OwnerCompletionsReview";

/** Owner completions on one home, with review status and latest feedback. Hidden when there are none. */
export function PropertyOwnerCompletions({ propertyId, isDemo }: { propertyId: string; isDemo: boolean }) {
  const q = useOwnerCompletions(isDemo, propertyId);
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  return (
    <section className="surface space-y-3 p-4">
      <p className="font-medium">Owner completions to review ({rows.filter(needsAttention).length})</p>
      <OwnerCompletionsReview demoMode={isDemo} propertyId={propertyId} />
    </section>
  );
}
