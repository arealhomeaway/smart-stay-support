import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/ui/page";
import { useDemo } from "@/components/DemoProvider";
import { OwnerCompletionsReview } from "@/components/onboarding/OwnerCompletionsReview";

export const Route = createFileRoute("/_authenticated/onboarding/owner-completions")({
  head: () => ({
    meta: [
      { title: "Owner completions to review — Resolve" },
      { name: "description", content: "Review owner-completed Opportunities, evidence and feedback without opening every record." },
      { property: "og:title", content: "Owner completions to review — Resolve" },
      { property: "og:description", content: "Staff follow-through on owner-completed onboarding work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { demoMode, demoReady } = useDemo();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Onboarding"
        title="Owner completions to review"
        description="Owner-completed Opportunities with evidence, latest feedback and your team's review status. Routed to each home's Primary PM with Onboarding Director oversight."
      />
      <SectionCard>{demoReady ? <OwnerCompletionsReview demoMode={demoMode} /> : null}</SectionCard>
    </div>
  );
}
