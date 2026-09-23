import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireCapability } from "@/components/RequireCapability";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui/page";
import { usDateTime } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/help-tickets")({
  head: () => ({
    meta: [
      { title: "Help tickets — Resolve" },
      { name: "description", content: "Register of Help & Feedback submissions about the Resolve application." },
      { property: "og:title", content: "Help tickets — Resolve" },
      { property: "og:description", content: "Issues and suggestions submitted from every Resolve page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="audit_history" title="Help tickets are for leadership">
      <HelpTicketsPage />
    </RequireCapability>
  ),
});

const STATUSES = ["new", "reviewing", "planned", "resolved", "closed"] as const;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
type Att = { path: string; name: string };

function HelpTicketsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["help-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_tickets")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
  const [status, setStatus] = useState<"open" | "new" | "done" | "all">("open");
  const [kind, setKind] = useState<"all" | "issue" | "suggestion">("all");
  const [portal, setPortal] = useState("all");
  const [q, setQ] = useState("");

  const portals = useMemo(() => [...new Set((data ?? []).map((r) => r.portal).filter(Boolean))] as string[], [data]);
  const rows = (data ?? []).filter((r) => {
    if (status === "new" && r.status !== "new") return false;
    if (status === "open" && ["resolved", "closed"].includes(r.status)) return false;
    if (status === "done" && !["resolved", "closed"].includes(r.status)) return false;
    if (kind !== "all" && r.kind !== kind) return false;
    if (portal !== "all" && r.portal !== portal) return false;
    const needle = q.trim().toLowerCase();
    if (needle) {
      const hay = [r.page_title, r.route, r.submitter_name, r.submitter_email, r.description, r.property_label]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  async function setRowStatus(id: string, s: string) {
    const { error } = await supabase.from("help_tickets").update({ status: s, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Could not update status."); return; }
    void qc.invalidateQueries({ queryKey: ["help-tickets"] });
  }
  async function openFile(a: Att) {
    const { data } = await supabase.storage.from("help-feedback").createSignedUrl(a.path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  const sel = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="space-y-6">
      <PageHeader title="Help tickets" description="Issues and suggestions about Resolve, sent from the ? button on every page." />
      <RecipientSetting />
      <SectionCard title="Submissions">
        <div className="mb-4 flex flex-wrap gap-2">
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
            <option value="open">Open</option>
            <option value="new">New</option>
            <option value="done">Resolved / Closed</option>
            <option value="all">All statuses</option>
          </select>
          <select className={sel} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type">
            <option value="all">Issues & suggestions</option>
            <option value="issue">Issues</option>
            <option value="suggestion">Suggestions</option>
          </select>
          <select className={sel} value={portal} onChange={(e) => setPortal(e.target.value)} aria-label="Portal">
            <option value="all">All portals</option>
            {portals.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <Input className="h-9 max-w-xs" placeholder="Search page, person, text…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <EmptyState title="No help tickets" hint="Nothing matches these filters." />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="space-y-1.5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">#{r.ticket_number}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.kind === "issue" ? "Issue" : "Suggestion"}</span>
                  <span className="text-muted-foreground">{r.portal} · {r.page_title}</span>
                  <select
                    className={`${sel} ml-auto h-8`}
                    value={r.status}
                    onChange={(e) => void setRowStatus(r.id, e.target.value)}
                    aria-label={`Status for ticket ${r.ticket_number}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{cap(s)}</option>
                    ))}
                  </select>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {r.submitter_name} ({r.user_role}) · {usDateTime(r.submitted_at)}
                  {r.property_label ? ` · ${r.property_label}` : ""} ·{" "}
                  <a className="underline" href={r.route ?? "#"}>{r.route}</a>
                </p>
                {((r.attachments as Att[]) ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(r.attachments as Att[]).map((a) => (
                      <Button key={a.path} size="sm" variant="outline" onClick={() => void openFile(a)}>{a.name}</Button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function RecipientSetting() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["help-feedback-recipient"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "help_feedback_recipient").maybeSingle();
      return ((data?.value as { email?: string } | null)?.email ?? "") as string;
    },
  });
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? data ?? "";
  async function save() {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim())) { toast.error("Enter a valid email address."); return; }
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "help_feedback_recipient", value: { email: value.trim() }, updated_at: new Date().toISOString() });
    if (error) { toast.error("Only administrators can change this."); return; }
    toast.success("Notification email saved.");
    setDraft(null);
    void qc.invalidateQueries({ queryKey: ["help-feedback-recipient"] });
  }
  return (
    <SectionCard title="Notification email">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-9 max-w-sm" type="email" value={value} onChange={(e) => setDraft(e.target.value)} aria-label="Notification email" />
        <Button size="sm" onClick={() => void save()} disabled={draft === null}>Save</Button>
        <span className="text-xs text-muted-foreground">Every new help ticket is emailed here.</span>
      </div>
    </SectionCard>
  );
}
