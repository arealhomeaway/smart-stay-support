import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { LaunchStateGate } from "@/components/LaunchStateGate";
import { useRole } from "@/hooks/useRole";
import { IMPORT_HOLD_LABELS, type ImportHold } from "@/lib/import-hold";
import { formatPropertyLabel } from "@/lib/property-label";

export const Route = createFileRoute("/_authenticated/imported-tickets")({
  component: () => (
    <SupervisorOnly>
      {/* Hidden behind its switch, not deleted (register H9). Databases, Tickets holds these lists now. */}
      <LaunchStateGate
        flag="imported_tickets_page"
        title="Imported tickets are in Databases"
        description="Open Databases, then Tickets: Older open, Closed history and Needs a home."
      >
        <ImportedTicketsPage />
      </LaunchStateGate>
    </SupervisorOnly>
  ),
  head: () => ({
    meta: [
      { title: "Imported tickets to review | Resolve" },
      { name: "description", content: "Backlog review and Needs a home lists for tickets imported from Notion." },
      { property: "og:title", content: "Imported tickets to review | Resolve" },
      { property: "og:description", content: "Review imported Notion tickets before they join the queues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { id: string; ref: number; title: string; status: string; reported_at: string; property_id: string | null; import_hold: ImportHold; external_url: string | null };
type Home = { id: string; name: string; nickname: string | null; address_line1: string | null; unit: string | null; city: string | null; state: string | null; postal_code: string | null; ownerrez_property_id: string | null };

function ImportedTicketsPage() {
  const [tab, setTab] = useState<ImportHold>("backlog_review");
  const { readOnly } = useRole();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["imported-held-tickets"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("tickets") as unknown as {
        select: (s: string) => { not: (c: string, o: string, v: null) => { eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Row[] | null; error: { message: string } | null }> } } };
      })
        .select("id, ref, title, status, reported_at, property_id, import_hold, external_url")
        .not("import_hold", "is", null)
        .eq("external_source", "notion")
        .order("reported_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    retry: false,
  });
  const homes = useQuery({
    queryKey: ["imported-held-homes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id")
        .eq("active", true).eq("is_demo", false).is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Home[];
    },
  });

  async function moveOut(row: Row, propertyId?: string) {
    const patch: Record<string, unknown> = { import_hold: null };
    if (propertyId) patch["property_id"] = propertyId;
    const { error } = await supabase.from("tickets").update(patch as never).eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Ticket #${row.ref} moved to the queues`);
      qc.invalidateQueries({ queryKey: ["imported-held-tickets"] });
    }
  }

  const rows = (list.data ?? []).filter((r) => r.import_hold === tab);
  const counts = { backlog_review: 0, needs_home: 0 } as Record<ImportHold, number>;
  for (const r of list.data ?? []) counts[r.import_hold]++;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Imported tickets to review"
        description="Tickets imported from Notion that stay out of PC queues, My Work and Team Queue until someone moves them out."
      />
      <div className="flex gap-2">
        {(Object.keys(IMPORT_HOLD_LABELS) as ImportHold[]).map((k) => (
          <Button key={k} variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>
            {IMPORT_HOLD_LABELS[k]} ({counts[k]})
          </Button>
        ))}
      </div>
      <SectionCard
        title={IMPORT_HOLD_LABELS[tab]}
        description={tab === "backlog_review"
          ? "Open tickets created in 2025. Move a ticket out when it still needs work."
          : "Tickets with no matching home. Choose the home, then move it to the queues."}
      >
        {list.isError ? (
          <EmptyState title="Not available yet" hint="These lists appear once the Notion import is set up." />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing here" hint="No imported tickets are waiting on this list." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <HeldRow key={r.id} row={r} homes={homes.data ?? []} readOnly={readOnly} onMove={moveOut} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function HeldRow({ row, homes, readOnly, onMove }: { row: Row; homes: Home[]; readOnly: boolean; onMove: (r: Row, p?: string) => void }) {
  const [home, setHome] = useState("");
  const needsHome = row.import_hold === "needs_home";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <Link to="/tickets/$ticketId" params={{ ticketId: row.id }} className="font-medium hover:underline">
          #{row.ref} {row.title}
        </Link>
        <p className="text-xs text-muted-foreground">Created {new Date(row.reported_at).toLocaleDateString()}</p>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          {needsHome && (
            <select
              aria-label="Home"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={home}
              onChange={(e) => setHome(e.target.value)}
            >
              <option value="">Choose a home</option>
              {homes.map((h) => (
                <option key={h.id} value={h.id}>{formatPropertyLabel(h).primary}</option>
              ))}
            </select>
          )}
          <Button size="sm" disabled={needsHome && !home} onClick={() => onMove(row, needsHome ? home : undefined)}>
            Move to queues
          </Button>
        </div>
      )}
    </li>
  );
}
