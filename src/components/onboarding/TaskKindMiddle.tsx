/**
 * The middle of the Task drawer for the Nov 12 kinds of Task (A3): Fill in Resolve,
 * Upload files, Done outside Resolve, Email, Vendor or team request and Approval.
 * Do it, Work order and Send to the homeowner keep the sections already built in TaskDrawer.
 * Presentation only: saves go through the existing home panels, email composer, step review
 * and the Task's own save.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailComposer } from "@/components/EmailComposer";
import { SchedulePanel } from "@/components/SchedulePanel";
import { ProjectTeamPanel } from "@/components/onboarding/ProjectTeamPanel";
import { PropertyFactsPanel } from "@/components/onboarding/PropertyFactsPanel";
import { TaskReviewPanel } from "@/components/onboarding/TaskReviewPanel";
import { fillInValuesFn, taskVendorsFn } from "@/lib/onboarding-task-kinds.functions";
import {
  FILL_FIELDS,
  WHERE_IT_WENT,
  noVendorLine,
  type KindSettings,
  type TaskKindCode,
  type WhereCode,
} from "@/lib/onboarding-task-kinds";

export type OutsideDraft = { where: WhereCode | null; proof: string; note: string };

/** The proof line saved on a Done outside Resolve Task. */
export function outsideEvidence(d: OutsideDraft): string {
  const where = WHERE_IT_WENT.find((w) => w.code === d.where)?.label ?? "Other";
  return [`Where it went: ${where}`, d.proof.trim() ? `Proof: ${d.proof.trim()}` : null, d.note.trim() ? `Note: ${d.note.trim()}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** Fill in Resolve: which chosen fields are still empty (null when the field has no home in Resolve). */
export function useFillIn(propertyId: string, fields: string[], enabled: boolean) {
  const read = useServerFn(fillInValuesFn);
  return useQuery({
    queryKey: ["task-fill-in", propertyId, fields.join(",")],
    queryFn: () => read({ data: { propertyId, fields } }),
    enabled: enabled && fields.length > 0,
  });
}

export function missingFillFields(fields: string[], filled: Record<string, boolean | null> | undefined): string[] {
  return fields
    .filter((f) => !filled || filled[f] !== true)
    .map((f) => FILL_FIELDS.find((x) => x.code === f)?.label ?? f);
}

export function TaskKindMiddle({
  kind,
  settings,
  taskId,
  propertyId,
  disabled,
  canEdit,
  plannedClosingOn,
  outside,
  onOutside,
  onEmailSent,
  onVendorRequested,
}: {
  kind: TaskKindCode;
  settings: KindSettings;
  taskId: string;
  propertyId: string;
  disabled: boolean;
  canEdit: boolean;
  plannedClosingOn: string | null;
  outside: OutsideDraft;
  onOutside: (d: OutsideDraft) => void;
  onEmailSent: (info: { subject: string; to: string }) => void;
  onVendorRequested: (vendor: string, info: { subject: string; to: string }) => void;
}) {
  if (kind === "fill_in") {
    return <FillIn settings={settings} propertyId={propertyId} canEdit={canEdit && !disabled} plannedClosingOn={plannedClosingOn} />;
  }
  if (kind === "upload_files") {
    return (
      <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Upload the files above. They show on later steps that list this step under Show files from.
      </p>
    );
  }
  if (kind === "outside_resolve") {
    return (
      <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Done outside Resolve">
        <p className="font-medium">Done outside Resolve</p>
        <div className="space-y-1.5">
          <Label>Where it went</Label>
          <Select value={outside.where ?? "none"} disabled={disabled} onValueChange={(v) => onOutside({ ...outside, where: v === "none" ? null : (v as WhereCode) })}>
            <SelectTrigger className="min-h-11 w-full sm:w-64" aria-label="Where it went"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose</SelectItem>
              {WHERE_IT_WENT.map((w) => <SelectItem key={w.code} value={w.code}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`outside-proof-${taskId}`}>Proof</Label>
          <Input id={`outside-proof-${taskId}`} className="min-h-11" value={outside.proof} disabled={disabled}
            onChange={(e) => onOutside({ ...outside, proof: e.target.value })}
            placeholder="Paste a link or envelope number, or upload a screenshot above" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`outside-note-${taskId}`}>Note</Label>
          <Textarea id={`outside-note-${taskId}`} rows={2} value={outside.note} disabled={disabled}
            onChange={(e) => onOutside({ ...outside, note: e.target.value })} />
        </div>
      </section>
    );
  }
  if (kind === "email") {
    return (
      <section className="space-y-2 rounded-lg border border-border p-4" aria-label="Email">
        <p className="font-medium">Email</p>
        <p className="text-sm text-muted-foreground">Choose an email template, check every fill-in, then send.</p>
        <EmailComposer
          context="onboarding_task"
          recordId={taskId}
          label="Choose an email template"
          presetTemplateId={settings.emailTemplateId ?? null}
          bracketFillIns
          disabled={disabled}
          onSent={onEmailSent}
        />
      </section>
    );
  }
  if (kind === "vendor_request") {
    return <VendorRequest settings={settings} taskId={taskId} propertyId={propertyId} disabled={disabled} onRequested={onVendorRequested} />;
  }
  if (kind === "approval") {
    return (
      <section className="space-y-2 rounded-lg border border-border p-4" aria-label="Approval">
        <p className="font-medium">What to review</p>
        <p className="text-sm text-muted-foreground">The files above and the step text. Approve, or send it back with a note.</p>
        <TaskReviewPanel taskId={taskId} />
      </section>
    );
  }
  return null;
}

function FillIn({ settings, propertyId, canEdit, plannedClosingOn }: { settings: KindSettings; propertyId: string; canEdit: boolean; plannedClosingOn: string | null }) {
  const fields = settings.fields ?? [];
  const q = useFillIn(propertyId, fields, true);
  if (!fields.length) return <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">This step has no fields chosen yet.</p>;
  const filled = q.data?.filled ?? {};
  const has = (f: string) => fields.includes(f as never);
  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Fill in Resolve">
      <p className="font-medium">Fill in</p>
      <ul className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <li key={f}>
            <Chip>{FILL_FIELDS.find((x) => x.code === f)?.label ?? f} · {filled[f] === true ? "Filled" : filled[f] === null ? "Not kept in Resolve yet" : "Empty"}</Chip>
          </li>
        ))}
      </ul>
      {has("closing_date") && (
        <SchedulePanel propertyId={propertyId} plannedClosingOn={plannedClosingOn} actualClosingOn={null} actualAccessOn={null} canEdit={canEdit} onChange={() => void q.refetch()} />
      )}
      {has("team_roles") && <ProjectTeamPanel propertyId={propertyId} />}
      {(has("wifi") || has("access_plan") || has("utility_accounts")) && <PropertyFactsPanel propertyId={propertyId} canEdit={canEdit} />}
      {(has("target_handoff") || has("budget") || has("verified_address")) && (
        <Link to="/onboarding/$propertyId" params={{ propertyId }} search={{ tab: "info" } as never} className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">
          Fill the rest in Home info
        </Link>
      )}
    </section>
  );
}

function VendorRequest({ settings, taskId, propertyId, disabled, onRequested }: { settings: KindSettings; taskId: string; propertyId: string; disabled: boolean; onRequested: (vendor: string, info: { subject: string; to: string }) => void }) {
  const read = useServerFn(taskVendorsFn);
  const trade = settings.trade ?? null;
  const q = useQuery({ queryKey: ["task-vendors", propertyId, trade], queryFn: () => read({ data: { propertyId, trade: trade! } }), enabled: Boolean(trade) });
  if (!trade) return <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">This step has no trade chosen yet.</p>;
  const rows = q.data?.rows ?? [];
  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Vendor or team request">
      <p className="font-medium">{trade} vendors</p>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading vendors…</p> : null}
      {q.data && rows.length === 0 ? (
        <div className="space-y-1 text-sm">
          <p>{noVendorLine(trade, q.data.market)}</p>
          <Link to="/vendors" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">Add a vendor</Link>
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {rows.map((v) => (
          <li key={v.orgId} className="space-y-1 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{v.name}</span>
              {v.homeFirstChoice && <Chip>First choice for this home</Chip>}
              <Chip>{v.usesBreezeway ? "Breezeway: yes" : "Breezeway: no"}</Chip>
            </div>
            {v.note && <p className="text-muted-foreground">{v.note}</p>}
            <p className="text-muted-foreground">{[v.contact, v.email].filter(Boolean).join(" · ") || "No contact on file"}</p>
            <div className="flex flex-wrap gap-2">
              {v.phone && (
                <>
                  <Button asChild variant="outline" size="sm" className="min-h-11 gap-1"><a href={`tel:${v.phone}`}><Phone className="size-4" aria-hidden /> {v.phone}</a></Button>
                  <Button asChild variant="outline" size="sm" className="min-h-11 gap-1"><a href={`sms:${v.phone}`}><MessageSquare className="size-4" aria-hidden /> Text</a></Button>
                </>
              )}
              {v.email && (
                <EmailComposer
                  context="onboarding_task"
                  recordId={taskId}
                  label="Request"
                  initialTo={v.email}
                  presetTemplateId={settings.emailTemplateId ?? null}
                  bracketFillIns
                  disabled={disabled}
                  onSent={(info) => onRequested(v.name, info)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A large "Open the form" button built from the first link in the step text (A4). */
export function OpenFormButton({ href }: { href: string }) {
  return (
    <Button asChild size="lg" className="min-h-12 w-full gap-2">
      <a href={href} target="_blank" rel="noopener noreferrer">
        Open the form <ExternalLink className="size-4" aria-hidden />
      </a>
    </Button>
  );
}
