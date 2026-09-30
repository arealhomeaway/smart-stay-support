/**
 * Needs Review: the Notion migration staging queue, plus canonical vendors
 * whose records are not finished (dispatch not set up, no market, etc.).
 */
import { ComplianceBadge } from "@/components/vendors/ComplianceBadge";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { decideNotionVendorRow, notionStaging, stageNotionVendors } from "@/lib/vendors.functions";
import { REVIEW_STATE_LABELS, type ReviewState } from "@/lib/vendor-gold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, EmptyState, LoadingRows, SectionBand } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { usDate } from "@/lib/dates";
import { VendorImportPanel } from "@/components/VendorImportPanel";
import { inTransitionalReview, transitionalDaysLeft, useInvalidateVendors, useVendorWorkspace } from "./useVendorWorkspace";
import { supabase } from "@/integrations/supabase/client";

export function VendorNeedsReview({ canManage }: { canManage: boolean }) {
  const ws = useVendorWorkspace();
  const incomplete = (ws.data?.vendors ?? [])
    .filter((v) => v.is_active)
    .map((v) => {
      const hasCov = (ws.data?.coverage ?? []).some((c) => c.org_id === v.id);
      const issues: string[] = [];
      if (v.dispatch_method === "setup_incomplete") issues.push("Needs Dispatch Setup");
      if (v.dispatch_method === "breezeway" && !v.breezeway_person_id) issues.push("Breezeway ID not mapped");
      if (!v.primary_contact_phone && !v.primary_contact_email) issues.push("Missing Contact Info");
      if (!hasCov && !v.markets.length) issues.push("Missing Market");
      if (!hasCov && !v.service_categories.length) issues.push("Missing Service Category");
      if (v.migration_status === "imported_needs_review") issues.push("Imported — verify");
      return { v, issues };
    })
    .filter((x) => x.issues.length);

  const transitional = (ws.data?.vendors ?? []).filter((v) => inTransitionalReview(v) || v.transitional_outcome === "leadership_review");
  const ownerIds = [...new Set(transitional.map((v) => v.program_owner).filter(Boolean))] as string[];
  const owners = useQuery({
    queryKey: ["vendor-program-owner-names", ownerIds],
    enabled: ownerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
      return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown"]));
    },
  });

  const expiring = (ws.data?.vendors ?? []).flatMap((v) =>
    (ws.data?.compliance.get(v.id)?.attention ?? []).map((i) => ({ v, i })),
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <SectionBand
          title="Transitional Review"
          hint="Existing ARHA vendors migrated from Notion. Usable for work until the deadline while their Must Pass checks are completed. Not Approved or Gold."
        />
        {ws.isLoading ? (
          <LoadingRows rows={2} />
        ) : transitional.length === 0 ? (
          <EmptyState title="No vendors in Transitional Review" hint="Imported existing vendors appear here." />
        ) : (
          <ul className="space-y-1.5">
            {transitional
              .sort((a, b) => (a.transitional_deadline ?? "").localeCompare(b.transitional_deadline ?? ""))
              .map((v) => {
                const gs = ws.data?.gateStatus.get(v.id);
                const missing = gs ? gs.total - gs.passed : 0;
                const days = transitionalDaysLeft(v);
                return (
                  <li key={v.id} className="surface-row flex flex-wrap items-center gap-2 py-2.5 pl-4 pr-3 text-sm">
                    <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} className="font-medium hover:underline">
                      {v.display_name}
                    </Link>
                    {v.transitional_outcome === "leadership_review" ? (
                      <StatusBadge tone="escalated">Window ended — leadership review</StatusBadge>
                    ) : (
                      <StatusBadge tone={days !== null && days <= 7 ? "escalated" : "waiting"}>{days} days remaining</StatusBadge>
                    )}
                    <Chip>{missing} Must Pass check{missing === 1 ? "" : "s"} missing</Chip>
                    <span className="text-muted-foreground">
                      Program Owner: {v.program_owner ? (owners.data?.get(v.program_owner) ?? "…") : "Not assigned (Director of Operations)"}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <SectionBand title="Expiring and expired credentials" hint="Insurance and licences within 30 days of expiry, or past it. Vendors stay usable until the day after expiry." />
        {ws.isLoading ? (
          <LoadingRows rows={2} />
        ) : expiring.length === 0 ? (
          <EmptyState title="No credentials expiring" hint="Nothing expires in the next 30 days." />
        ) : (
          <ul className="space-y-1.5">
            {expiring.map(({ v, i }) => (
              <li key={`${v.id}-${i.requirementId}`} className="surface-row flex flex-wrap items-center gap-2 py-2.5 pl-4 pr-3 text-sm">
                <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} className="font-medium hover:underline">
                  {v.display_name}
                </Link>
                <span>{i.label}</span>
                <ComplianceBadge state={i.state} />
                <span className="text-muted-foreground">
                  {i.days < 0 ? `expired ${usDate(i.expiresOn)}` : i.days === 0 ? "expires today" : `expires ${usDate(i.expiresOn)} (${i.days} day${i.days === 1 ? "" : "s"})`}
                </span>
                <Button size="sm" variant="outline" className="ml-auto" asChild>
                  <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} search={{ gate: i.requirementId }}>Open check</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <SectionBand title="Vendor records to finish" hint="Canonical vendors missing something dispatch will need." />
        {ws.isLoading ? (
          <LoadingRows rows={3} />
        ) : incomplete.length === 0 ? (
          <EmptyState title="Nothing to finish" hint="Every active vendor has contact, coverage and dispatch set up." />
        ) : (
          <ul className="space-y-1.5">
            {incomplete.map(({ v, issues }) => (
              <li key={v.id} className="surface-row flex flex-wrap items-center gap-2 py-2.5 pl-4 pr-3 text-sm">
                <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} className="font-medium hover:underline">
                  {v.display_name}
                </Link>
                {issues.map((i) => (
                  <Chip key={i}>{i}</Chip>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
      {canManage ? (
        <>
          <NotionStaging />
          <section className="space-y-2">
            <SectionBand title="Breezeway people import" hint="The existing Breezeway contact migration." />
            <VendorImportPanel />
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Migration staging is managed by Operations leadership.</p>
      )}
    </div>
  );
}

function NotionStaging() {
  const qc = useQueryClient();
  const invalidate = useInvalidateVendors();
  const load = useServerFn(notionStaging);
  const stage = useServerFn(stageNotionVendors);
  const decide = useServerFn(decideNotionVendorRow);
  const [label, setLabel] = useState("Notion vendor export");
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<ReviewState | "all">("all");
  const rows = useQuery({ queryKey: ["notion-staging"], queryFn: () => load() });

  const upload = useMutation({
    mutationFn: async () => stage({ data: { label, csv: await file!.text() } }),
    onSuccess: (r) => {
      toast.success(`Staged ${r.staged} vendor rows for review. Nothing was imported yet.`);
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["notion-staging"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const act = useMutation({
    mutationFn: (v: { rowId: string; action: "import" | "skip" }) => decide({ data: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notion-staging"] });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (rows.data ?? []).filter((r) => r.decision === "pending");
  const shown = pending.filter((r) => filter === "all" || r.review_states.includes(filter));
  const counts = Object.fromEntries(
    (Object.keys(REVIEW_STATE_LABELS) as ReviewState[]).map((s) => [s, pending.filter((r) => r.review_states.includes(s)).length]),
  );

  return (
    <section className="space-y-3">
      <SectionBand
        title="Notion migration staging"
        hint="One-time import. Upload the Notion vendor export as CSV; every row waits here for a person to import or skip it. Duplicates are flagged, never merged."
      />
      <div className="flex flex-wrap items-end gap-2">
        <Input className="h-9 w-60" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Batch label" />
        <Input className="h-9 w-72" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Notion CSV" />
        <Button size="sm" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
          Stage rows
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter("all")}>
          <Chip className={filter === "all" ? "border-primary" : undefined}>All {pending.length}</Chip>
        </button>
        {(Object.keys(REVIEW_STATE_LABELS) as ReviewState[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)}>
            <Chip className={filter === s ? "border-primary" : undefined}>
              {REVIEW_STATE_LABELS[s]} {counts[s]}
            </Chip>
          </button>
        ))}
      </div>
      {rows.isLoading ? (
        <LoadingRows rows={3} />
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing staged" hint="Upload a Notion export to begin the review." />
      ) : (
        <ul className="space-y-1.5">
          {shown.map((r) => (
            <li key={r.id} className="surface-row space-y-1 py-2.5 pl-4 pr-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.company ?? "(no company)"}</span>
                <span className="text-muted-foreground">
                  {[r.contact_person, r.phone, r.email].filter(Boolean).join(" · ") || "no contact"}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ rowId: r.id, action: "import" })}>
                    Import
                  </Button>
                  <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ rowId: r.id, action: "skip" })}>
                    Skip
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.review_states.map((s) => (
                  <StatusBadge key={s} tone={s === "ready" ? "resolved" : s === "needs_dispatch_setup" ? "context" : "waiting"}>
                    {REVIEW_STATE_LABELS[s as ReviewState] ?? s}
                  </StatusBadge>
                ))}
                {r.transitional_eligible && <StatusBadge tone="waiting">Transitional Review on import</StatusBadge>}
                {r.breezeway_match_state && r.breezeway_match_state !== "not_found" && (
                  <Chip>
                    Breezeway: {r.breezeway_match_state === "email" ? `exact email (ID ${r.breezeway_match_person_id})` : r.breezeway_match_state === "unique_name" ? `name only — confirm (ID ${r.breezeway_match_person_id})` : "ambiguous — manual review"}
                  </Chip>
                )}
                <span className="text-xs text-muted-foreground">
                  {r.markets.join(", ") || "no market"} · {r.specialties.join(", ") || "no specialty"}
                  {r.breezeway_hint ? " · Notion says in Breezeway (unverified)" : ""}
                  {Object.keys((r.legacy_fields as object) ?? {}).length
                    ? ` · ${Object.keys(r.legacy_fields as object).length} legacy field(s) kept`
                    : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
