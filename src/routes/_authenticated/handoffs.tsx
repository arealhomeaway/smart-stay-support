import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RequireCapability } from "@/components/RequireCapability";
import { useDemo } from "@/components/DemoProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, EmptyState, PageHeader, SectionCard } from "@/components/ui/page";
import { readHandoffsOverview } from "@/lib/handoffs-overview.functions";
import { HANDOFFS_COPY, type HandoffOverviewRow } from "@/lib/handoffs-overview";
import { usDate } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/handoffs")({
  head: () => ({
    meta: [
      { title: "Handoffs | Resolve" },
      { name: "description", content: "Every home in onboarding and where its handoff stands, read only." },
      { property: "og:title", content: "Handoffs | Resolve" },
      { property: "og:description", content: "Every home in onboarding and where its handoff stands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="handoffs_view" title="Handoffs">
      <HandoffsPage />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">{HANDOFFS_COPY.failed}</p>,
});

function HandoffsPage() {
  const read = useServerFn(readHandoffsOverview);
  const { demoMode } = useDemo();
  const q = useQuery({ queryKey: ["handoffs-overview"], queryFn: () => read() });
  const rows = (q.data?.rows ?? []).filter((r) => r.demo === Boolean(demoMode));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Homes and owners" title={HANDOFFS_COPY.title} description={HANDOFFS_COPY.description} />
      {q.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">{HANDOFFS_COPY.failed}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={HANDOFFS_COPY.empty} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2" data-testid="handoffs-list">
          {rows.map((r) => (
            <HandoffCard key={r.projectId} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HandoffCard({ r }: { r: HandoffOverviewRow }) {
  return (
    <li data-testid="handoff-card">
      <SectionCard
        title={r.home}
        description={r.place || undefined}
        actions={<Chip>{r.status}</Chip>}
        bodyClassName="space-y-3 text-sm"
      >
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{HANDOFFS_COPY.committed}</dt>
            <dd className="font-medium">{r.committedOn ? usDate(r.committedOn) : HANDOFFS_COPY.notSet}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ready for Operations</dt>
            <dd>{r.readyAt && r.readyBy ? HANDOFFS_COPY.readyBy(r.readyBy, usDate(r.readyAt)) : HANDOFFS_COPY.notReady}</dd>
          </div>
        </dl>
        <ItemList
          label={r.openItems.length ? HANDOFFS_COPY.openItems(r.openItems.length) : HANDOFFS_COPY.noOpenItems}
          items={r.openItems.map((i) => ({ key: i.id, text: i.name, note: i.category }))}
        />
        <ItemList
          label={r.carryOvers.length ? HANDOFFS_COPY.carryOvers(r.carryOvers.length) : HANDOFFS_COPY.noCarryOvers}
          items={r.carryOvers.map((c) => ({ key: c.id, text: c.title, note: `Due ${usDate(c.dueOn)}` }))}
        />
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/property/$propertyId" params={{ propertyId: r.propertyId }}>
            {HANDOFFS_COPY.openHome}
          </Link>
        </Button>
      </SectionCard>
    </li>
  );
}

function ItemList({ label, items }: { label: string; items: { key: string; text: string; note: string }[] }) {
  if (!items.length) return <p className="text-muted-foreground">{label}</p>;
  return (
    <details className="rounded-md border border-border">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-medium">{label}</summary>
      <ul className="divide-y divide-border border-t border-border">
        {items.map((i) => (
          <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="min-w-0">{i.text}</span>
            <span className="text-xs text-muted-foreground">{i.note}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
