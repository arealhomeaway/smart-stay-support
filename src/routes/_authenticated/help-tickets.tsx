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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/hooks/useRole";
import { bulkUpdateHelpTickets } from "@/lib/help-ticket-bulk.functions";
import { filterHelpTickets, toggleHelpSelection, HELP_BULK_NOTIFY_DEFAULT, type HelpBulkInput } from "@/lib/help-ticket-bulk";
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
      { title: "Help tickets | Resolve" },
      { name: "description", content: "Register of Help & Feedback submissions about the Resolve application." },
      { property: "og:title", content: "Help tickets | Resolve" },
      { property: "og:description", content: "Issues and suggestions submitted from every Resolve page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    // Register A20: every staff member sees their own reports; only the Admin sees all and changes them.
    <RequireCapability capability="help_tickets_own" title="Help tickets">
      <HelpTicketsPage />
    </RequireCapability>
  ),
});

type Att = { path: string; name: string };
type Filter = "open" | "all" | (typeof HELP_STATUSES)[number];
const OPEN = ["new", "reviewing", "planned", "in_progress"];
const label = (s: string) => HELP_STATUS_LABEL[s] ?? s;
const sel = "h-9 rounded-md border bg-background px-2 text-sm";

function useTickets(ownOnly: string | null) {
  return useQuery({
    queryKey: ["help-tickets", ownOnly ?? "all"],
    queryFn: async () => {
      const rows = [];
      for (let from = 0; ; from += 500) {
        let query = supabase.from("help_tickets").select("*");
        if (ownOnly) query = query.eq("submitted_by", ownOnly);
        const { data, error } = await query
          .order("submitted_at", { ascending: false }).order("id").range(from, from + 499);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 500) return rows;
      }
    },
  });
}

function HelpTicketsPage() {
  const { ticket } = Route.useSearch();
  const { isAdmin, userId, isLoading: roleLoading } = useRole();
  const { data, isLoading } = useTickets(isAdmin ? null : (userId ?? "none"));
  if (roleLoading) return <Skeleton className="h-96" />;
  if (!isAdmin) return <MyReports rows={data ?? []} isLoading={isLoading} />;
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

export function TicketList({ rows: all, isLoading }: { rows: any[]; isLoading: boolean }) {
  const [status, setStatus] = useState<Filter>("open");
  const [kind, setKind] = useState<"all" | "issue" | "suggestion">("all");
  const [portal, setPortal] = useState("all");
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { roles, readOnly } = useRole();
  // Register A20: only the Admin changes help tickets.
  const canBulk = !readOnly && roles.includes("admin");
  const updateBulk = useServerFn(bulkUpdateHelpTickets);
  const [selection, setSelection] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<HelpBulkInput["status"]>("closed");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(HELP_BULK_NOTIFY_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<HelpBulkInput | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const portals = useMemo(() => [...new Set(all.map((r) => r.portal).filter(Boolean))] as string[], [all]);
  const rows = filterHelpTickets(all, { status, kind, portal, q });
  const selectedIds = selection.filter((id) => rows.some((row) => row.id === id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  function clearSelection() { if (pending) void qc.invalidateQueries({ queryKey: ["help-tickets"] }); setSelection([]); setPending(null); setConfirmation(""); }
  async function saveBulk() {
    if (!selectedIds.length || !canBulk) return;
    setSaving(true); setConfirmation("");
    const data = pending ?? {
      batchId: crypto.randomUUID(), tickets: rows.filter((row) => selectedIds.includes(row.id)).map((row) => ({ id: row.id as string, expectedUpdatedAt: row.updated_at as string })),
      status: bulkStatus, note: note.trim(), notify,
    };
    setPending(data);
    try {
      const result = await updateBulk({ data });
      const statusLabel = result.status === "closed" ? "Closed" : label(result.status);
      const message = `${result.count} tickets set to ${statusLabel}`;
      setConfirmation(message); toast.success(message);
      if (result.failed || result.deliveryUnconfirmed) toast.warning("Tickets saved. Some notifications could not be confirmed. Check ticket history before sending again.");
      setSelection([]); setPending(null); setNote(""); setNotify(HELP_BULK_NOTIFY_DEFAULT);
      void qc.invalidateQueries({ queryKey: ["help-tickets"] }); void qc.invalidateQueries({ queryKey: ["help-ticket-events"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not confirm this save. Try the same selection again or refresh the list."); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Help tickets" description="Issues and suggestions about Resolve, sent from the ? button on every page." />
      <RecipientSetting />
      <SectionCard title="Submissions">
        <div className="mb-4 flex flex-wrap gap-2">
          <select className={sel} disabled={saving || Boolean(pending)} value={status} onChange={(e) => { setStatus(e.target.value as Filter); clearSelection(); }} aria-label="Status">
            <option value="open">Open</option>
            {HELP_STATUSES.map((s) => (
              <option key={s} value={s}>{label(s)}</option>
            ))}
            <option value="all">All statuses</option>
          </select>
          <select className={sel} disabled={saving || Boolean(pending)} value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); clearSelection(); }} aria-label="Type">
            <option value="all">Issues & suggestions</option>
            <option value="issue">Issues</option>
            <option value="suggestion">Suggestions</option>
          </select>
          <select className={sel} disabled={saving || Boolean(pending)} value={portal} onChange={(e) => { setPortal(e.target.value); clearSelection(); }} aria-label="Portal">
            <option value="all">All portals</option>
            {portals.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <Input className="h-9 max-w-xs" disabled={saving || Boolean(pending)} placeholder="Search page, person, text…" value={q} onChange={(e) => { setQ(e.target.value); clearSelection(); }} />
        </div>
        {confirmation && <p role="status" className="mb-3 text-sm text-success">{confirmation}</p>}
        {canBulk && rows.length > 0 && !isLoading && <div className="mb-3 flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox aria-label="Select all" disabled={saving || Boolean(pending)} checked={allSelected ? true : selectedIds.length ? "indeterminate" : false} onCheckedChange={(checked) => { setSelection(toggleHelpSelection(selectedIds, rows.map((r) => r.id), checked === true)); setPending(null); }} />Select all</label>
          <span aria-live="polite">{selectedIds.length} selected</span>
        </div>}
        {canBulk && selectedIds.length > 0 && <div className="mb-4 space-y-3 border-y border-border py-4">
          {pending && !saving && <p role="alert" className="text-sm text-warning">The save was not confirmed. Save again to check the same update, or cancel and refresh the list.</p>}
          <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-medium">Change status</span><Select value={bulkStatus} disabled={saving || Boolean(pending)} onValueChange={(value) => { setBulkStatus(value as HelpBulkInput["status"]); setPending(null); }}><SelectTrigger aria-label="Change status" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{HELP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "closed" ? "Closed" : label(s)}</SelectItem>)}</SelectContent></Select></div>
          <Textarea aria-label="Optional note for all selected tickets" placeholder="Optional note" value={note} maxLength={5000} disabled={saving || Boolean(pending)} onChange={(e) => { setNote(e.target.value); setPending(null); }} />
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><Checkbox checked={notify} disabled={saving || Boolean(pending)} onCheckedChange={(checked) => { setNotify(checked === true); setPending(null); }} />Notify submitters</label><div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={clearSelection}>Cancel</Button><Button disabled={saving} onClick={() => void saveBulk()}>{saving ? "Saving…" : "Save"}</Button></div></div>
        </div>}
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <EmptyState title="No help tickets" hint="Nothing matches these filters." />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                {canBulk && <Checkbox className="mt-4 shrink-0" aria-label={`Select Help Ticket #${r.ticket_number}`} disabled={saving || Boolean(pending)} checked={selectedIds.includes(r.id)} onCheckedChange={(checked) => { setSelection(toggleHelpSelection(selectedIds, [r.id], checked === true)); setPending(null); setConfirmation(""); }} />}
                <Link
                  to="/help-tickets"
                  search={{ ticket: r.ticket_number }}
                  className="block min-w-0 flex-1 space-y-1 py-3 hover:bg-muted/40"
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

export const MY_REPORTS_COPY = {
  title: "My reports",
  description: "What you sent from the help button and where each one stands.",
  empty: "You have not sent any reports yet.",
} as const;

/** Register A20: a person's own reports and their status, read only. */
export function MyReports({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeader title={MY_REPORTS_COPY.title} description={MY_REPORTS_COPY.description} />
      <SectionCard>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <EmptyState title={MY_REPORTS_COPY.empty} />
        ) : (
          <ul className="divide-y" data-testid="my-reports">
            {rows.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">#{r.ticket_number}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.kind === "issue" ? "Issue" : "Suggestion"}</span>
                  <span className="rounded border px-1.5 py-0.5 text-xs">{label(r.status)}</span>
                  <span className="truncate text-muted-foreground">{r.page_title}</span>
                </div>
                <p className="line-clamp-2 text-sm">{r.description}</p>
                <p className="text-xs text-muted-foreground">Sent {usDateTime(r.submitted_at)}</p>
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
