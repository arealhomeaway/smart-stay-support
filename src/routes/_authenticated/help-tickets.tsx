import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireCapability } from "@/components/RequireCapability";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui/page";
import { usDateTime } from "@/lib/dates";
import {
  HELP_STATUSES,
  HELP_STATUS_LABEL,
  getHelpTicketRecipient,
  updateHelpTicket,
} from "@/lib/help-ticket-response.functions";

export const Route = createFileRoute("/_authenticated/help-tickets")({
  validateSearch: z.object({ ticket: z.number().int().optional() }),
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

type Att = { path: string; name: string };
type Filter = "open" | "all" | (typeof HELP_STATUSES)[number];
const OPEN = ["new", "reviewing", "planned", "in_progress"];
const label = (s: string) => HELP_STATUS_LABEL[s] ?? s;
const sel = "h-9 rounded-md border bg-background px-2 text-sm";

function useTickets() {
  return useQuery({
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
}

function HelpTicketsPage() {
  const { ticket } = Route.useSearch();
  const { data, isLoading } = useTickets();
  const current = ticket != null ? data?.find((r) => r.ticket_number === ticket) : undefined;
  if (ticket != null) {
    if (isLoading) return <Skeleton className="h-96" />;
    if (!current)
      return (
        <EmptyState title="Help ticket not found" hint="It may have been removed or you may not have access." />
      );
    return <TicketDetail t={current} />;
  }
  return <TicketList rows={data ?? []} isLoading={isLoading} />;
}

function TicketList({ rows: all, isLoading }: { rows: any[]; isLoading: boolean }) {
  const [status, setStatus] = useState<Filter>("open");
  const [kind, setKind] = useState<"all" | "issue" | "suggestion">("all");
  const [portal, setPortal] = useState("all");
  const [q, setQ] = useState("");
  const portals = useMemo(() => [...new Set(all.map((r) => r.portal).filter(Boolean))] as string[], [all]);
  const rows = all.filter((r) => {
    if (status === "open" && !OPEN.includes(r.status)) return false;
    if (status !== "open" && status !== "all" && r.status !== status) return false;
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

  return (
    <div className="space-y-6">
      <PageHeader title="Help tickets" description="Issues and suggestions about Resolve, sent from the ? button on every page." />
      <RecipientSetting />
      <SectionCard title="Submissions">
        <div className="mb-4 flex flex-wrap gap-2">
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value as Filter)} aria-label="Status">
            <option value="open">Open</option>
            {HELP_STATUSES.map((s) => (
              <option key={s} value={s}>{label(s)}</option>
            ))}
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
              <li key={r.id}>
                <Link
                  to="/help-tickets"
                  search={{ ticket: r.ticket_number }}
                  className="block space-y-1 py-3 hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">#{r.ticket_number}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.kind === "issue" ? "Issue" : "Suggestion"}</span>
                    <span className="rounded border px-1.5 py-0.5 text-xs">{label(r.status)}</span>
                    <span className="truncate text-muted-foreground">{r.property_label ?? r.portal} · {r.page_title}</span>
                  </div>
                  <p className="line-clamp-1 text-sm">{r.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.submitter_name} · Submitted {usDateTime(r.submitted_at)} · Last activity{" "}
                    {usDateTime(r.last_activity_at ?? r.updated_at ?? r.submitted_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function TicketDetail({ t }: { t: any }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const update = useServerFn(updateHelpTicket);
  const recipientFn = useServerFn(getHelpTicketRecipient);
  const [status, setStatus] = useState<string>(t.status);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["help-ticket-events", t.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_ticket_events")
        .select("*")
        .eq("ticket_id", t.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const { data: recipient } = useQuery({
    queryKey: ["help-ticket-recipient", t.id],
    queryFn: () => recipientFn({ data: { ticketId: t.id } }),
  });

  const statusChanged = status !== t.status;
  const reopening = statusChanged && ["resolved", "closed"].includes(t.status) && OPEN.includes(status);
  const canSave = statusChanged || message.trim().length > 0;
  const emails = statusChanged || (mode === "reply" && message.trim().length > 0);

  async function save() {
    setSaving(true);
    try {
      const res = await update({
        data: {
          ticketId: t.id,
          status: statusChanged ? (status as any) : null,
          mode,
          message: message.trim(),
          origin: window.location.origin,
        },
      });
      toast.success(
        res.emailStatus == null
          ? "Saved."
          : res.emailed
            ? "Saved and emailed to the submitter."
            : "Saved. The email could not be delivered — see the activity thread.",
      );
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["help-tickets"] });
      void qc.invalidateQueries({ queryKey: ["help-ticket-events", t.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  async function openFile(a: Att) {
    const { data } = await supabase.storage.from("help-feedback").createSignedUrl(a.path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  const facts: [string, React.ReactNode][] = [
    ["Type", t.kind === "issue" ? "Issue" : "Suggestion"],
    ["Submitted by", t.submitter_name],
    ["Submitter email", recipient?.email ?? t.submitter_email ?? "—"],
    ["Role", t.user_role],
    ["Portal", t.portal],
    ...(t.property_label ? ([["Property", t.property_label]] as [string, React.ReactNode][]) : []),
    ["Page", t.page_title],
    ["Submitted", usDateTime(t.submitted_at)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Help Ticket #${t.ticket_number}`}
        description={`${t.kind === "issue" ? "Issue" : "Suggestion"} · ${label(t.status)}`}
      />
      <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/help-tickets", search: {} })}>
        Back to Help tickets
      </Button>

      <SectionCard title="Ticket">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-4 text-xs text-muted-foreground">Original feedback</h3>
        <p className="whitespace-pre-wrap text-sm">{t.description}</p>
        {((t.attachments as Att[]) ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(t.attachments as Att[]).map((a) => (
              <Button key={a.path} size="sm" variant="outline" onClick={() => void openFile(a)}>{a.name}</Button>
            ))}
          </div>
        )}
        {t.route && (
          <a className="mt-3 inline-block text-sm underline" href={t.route}>Open original page in Resolve</a>
        )}
      </SectionCard>

      <SectionCard title="Conversation & Activity">
        <ol className="space-y-3 text-sm">
          <li className="rounded-md border p-3">
            <p><strong>{t.submitter_name}</strong> submitted this {t.kind === "issue" ? "issue" : "suggestion"}</p>
            <p className="text-xs text-muted-foreground">{usDateTime(t.submitted_at)}</p>
          </li>
          {isLoading && <Skeleton className="h-16" />}
          {(events ?? []).map((e) => (
            <li key={e.id} className={`rounded-md border p-3 ${e.kind === "note" ? "bg-muted/50" : ""}`}>
              {e.kind === "status" ? (
                <p>
                  <strong>{e.author_name}</strong>{" "}
                  {["resolved", "closed"].includes(e.from_status ?? "") && OPEN.includes(e.to_status ?? "")
                    ? "reopened the ticket"
                    : "changed status"}
                  : {label(e.from_status ?? "")} → {label(e.to_status ?? "")}
                </p>
              ) : (
                <>
                  <p>
                    <strong>{e.author_name}</strong> {e.kind === "note" ? "added an internal note (not sent)" : "replied"}:
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{e.body}</p>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                {usDateTime(e.created_at)}
                {e.email_status &&
                  ` · ${e.email_status === "sent" ? `Email delivered to ${e.email_recipient}` : `Email not delivered (${e.email_status})`}`}
              </p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="Respond">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            Status:
            <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              {HELP_STATUSES.map((s) => (
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </select>
            {reopening && <span className="text-xs text-muted-foreground">Reopening — add an optional reason below.</span>}
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="Message type">
            <Button size="sm" variant={mode === "reply" ? "default" : "outline"} onClick={() => setMode("reply")}>
              Reply to Submitter
            </Button>
            <Button size="sm" variant={mode === "note" ? "default" : "outline"} onClick={() => setMode("note")}>
              Internal Note
            </Button>
          </div>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              mode === "reply"
                ? status === "resolved" && statusChanged
                  ? "Optional resolution message for the submitter…"
                  : "Write a reply to the submitter…"
                : "Internal note — only leadership sees this."
            }
            aria-label="Message"
          />
          <p className="text-xs text-muted-foreground">
            {emails
              ? `One email will go to ${recipient?.email ?? "the submitter"}${mode === "note" && message.trim() ? " (status only — the note stays internal)" : ""}.`
              : mode === "note"
                ? "Internal notes are never emailed."
                : "Nothing will be emailed until you write a reply or change status."}
          </p>
          <Button onClick={() => void save()} disabled={!canSave || saving}>
            {mode === "reply" && message.trim() ? "Send Reply" : "Save"}
          </Button>
        </div>
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
