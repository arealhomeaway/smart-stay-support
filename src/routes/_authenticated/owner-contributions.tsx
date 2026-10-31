import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/hooks/useRole";
import { loadContributions } from "@/lib/ao-data";
import { contributionsCsv } from "@/lib/ao-engine";
import { NOT_SET_UP, canViewContributions, filterContributions } from "@/lib/ao-ui";
import { usDate } from "@/lib/ao-format";

export const Route = createFileRoute("/_authenticated/owner-contributions")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === "string" && s.q ? { q: s.q } : {}),
  head: () => ({
    meta: [
      { title: "Homeowner contributions | Resolve" },
      { name: "description", content: "Search and export what homeowners submitted on their plan cards." },
      { property: "og:title", content: "Homeowner contributions | Resolve" },
      { property: "og:description", content: "Every homeowner plan answer, with who submitted it and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="owner_programs">
      <ContributionsPage />
    </RequireCapability>
  ),
});

function ContributionsPage() {
  const role = useRole();
  const search = Route.useSearch();
  const allowed = canViewContributions({ isAdmin: role.isAdmin, isOnboardingDirector: role.isOnboardingDirector, isOpsDirector: role.access.seats.opsDirector });
  const q = useQuery({ queryKey: ["ao-contributions"], queryFn: loadContributions, enabled: allowed, retry: false });
  const [f, setF] = useState({ card: "all", home: "all", from: "", to: "", q: search.q ?? "" });
  const rows = q.data?.available ? q.data.data : [];
  const cards = useMemo(() => [...new Map(rows.map((r) => [r.cardCode, r.card])).entries()].sort(), [rows]);
  const homes = useMemo(() => [...new Set(rows.map((r) => r.home))].sort(), [rows]);
  const shown = filterContributions(rows, f);
  const header = <PageHeader eyebrow="Active Owner" title="Homeowner contributions" description="What homeowners submitted on their plan cards." />;

  if (!allowed) return <div className="space-y-6">{header}<EmptyState title="Admin, the Onboarding Director and Directors can see contributions" /></div>;
  if (q.isLoading) return <LoadingPage />;
  if (q.error) return <div className="space-y-6">{header}<EmptyState title="Could not load contributions" hint={(q.error as Error).message} /></div>;
  if (!q.data?.available) return <div className="space-y-6">{header}<EmptyState title={NOT_SET_UP} hint="Contributions will appear here once the homeowner plan is switched on." /></div>;

  const exportCsv = () => {
    const csv = contributionsCsv(shown.map((r) => ({ card: `${r.cardCode} ${r.card}`, home: r.home, member: r.member, submittedAt: r.submittedAt, values: r.values })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "homeowner-contributions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {header}
      <SectionCard actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={shown.length === 0}><Download className="size-4" /> Export CSV</Button>}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label htmlFor="c-q" className="text-xs">Search</Label><Input id="c-q" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="w-56" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Card</Label>
            <Select value={f.card} onValueChange={(v) => setF({ ...f, card: v })}>
              <SelectTrigger className="w-56" aria-label="Card"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{cards.map(([code, title]) => <SelectItem key={code} value={code}>{code} {title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Home</Label>
            <Select value={f.home} onValueChange={(v) => setF({ ...f, home: v })}>
              <SelectTrigger className="w-48" aria-label="Home"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{homes.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="c-from" className="text-xs">From</Label><Input id="c-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="c-to" className="text-xs">To</Label><Input id="c-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        </div>
        <ul className="mt-4 divide-y">
          {shown.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <p className="font-medium">{r.cardCode} {r.card}</p>
              <p className="text-xs text-muted-foreground">{r.home}, submitted by {r.member} on {usDate(r.submittedAt)}</p>
              <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
                {Object.entries(r.values).map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{String(v)}</dd></Fragment>)}
              </dl>
            </li>
          ))}
          {shown.length === 0 ? <li className="py-4 text-sm text-muted-foreground">No contributions match.</li> : null}
        </ul>
      </SectionCard>
    </div>
  );
}
