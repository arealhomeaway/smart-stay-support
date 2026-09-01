/**
 * Lead workspace drawer.
 *
 * Opening a lead should feel like opening an opportunity, not editing a
 * database row. Everything Resolve already knows — follow-up timing, the next
 * action, the contact history — is stated plainly; the employee supplies the
 * judgement.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Chip } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayName, useCurrentUserId, type TeamMember } from "@/hooks/useTeam";
import { stateChip } from "@/lib/semantic";
import {
  CHANNEL_LABELS,
  LOSS_REASON_LABELS,
  PIPELINE,
  SOURCE_LABELS,
  STAGE_LABELS,
  attentionFlags,
  followUpBucket,
  formatDate,
  formatMoney,
  isOpen,
  nextAction,
  nextFollowUpAt,
  proposeStage,
  relativeDays,
  type LeadChannel,
  type LeadLossReason,
  type LeadStage,
} from "@/lib/leads";
import type { LeadRow, LeadUpdate } from "@/lib/lead-types";

const CONTACT_CHANNELS: LeadChannel[] = ["call", "email", "text", "other"];

export function stageState(stage: LeadStage) {
  if (stage === "converted") return "done" as const;
  if (stage === "lost") return "blocked" as const;
  if (stage === "new") return "new" as const;
  if (stage === "booking_pending" || stage === "engaged") return "active" as const;
  return "waiting" as const;
}

export function LeadDrawer({
  lead,
  people,
  canEdit,
  onClose,
}: {
  lead: LeadRow | null;
  people: TeamMember[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const [channel, setChannel] = useState<LeadChannel>("email");
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [lossReason, setLossReason] = useState<LeadLossReason | "">("");
  const [lossNote, setLossNote] = useState("");
  const [keepOpen, setKeepOpen] = useState("");
  const [reservationRef, setReservationRef] = useState("");
  const [propertySearch, setPropertySearch] = useState("");

  const leadId = lead?.id ?? null;

  const activity = useQuery({
    queryKey: ["lead-activity", leadId],
    enabled: Boolean(leadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activity")
        .select("*")
        .eq("lead_id", leadId!)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const candidates = useQuery({
    queryKey: ["lead-properties", leadId],
    enabled: Boolean(leadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_properties")
        .select("id, property_id, note, properties(name, nickname, city, bedrooms, lifecycle_status)")
        .eq("lead_id", leadId!);
      if (error) throw error;
      return data;
    },
  });

  const propertyOptions = useQuery({
    queryKey: ["lead-property-search", propertySearch],
    enabled: Boolean(leadId) && propertySearch.trim().length > 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname, city, bedrooms, lifecycle_status")
        .or(`name.ilike.%${propertySearch}%,nickname.ilike.%${propertySearch}%,city.ilike.%${propertySearch}%`)
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["lead-activity", leadId] });
    void qc.invalidateQueries({ queryKey: ["lead-properties", leadId] });
  };

  const patchLead = useMutation({
    mutationFn: async ({
      patch,
      log,
    }: {
      patch: LeadUpdate;
      log?: {
        channel: LeadChannel;
        outcome?: string | undefined;
        note?: string | undefined;
        from?: LeadStage | undefined;
        to?: LeadStage | undefined;
      };
    }) => {
      const { error } = await supabase.from("leads").update(patch).eq("id", leadId!);
      if (error) throw error;
      if (log) {
        const { error: aErr } = await supabase.from("lead_activity").insert({
          lead_id: leadId!,
          channel: log.channel,
          outcome: log.outcome ?? null,
          note: log.note ?? null,
          from_stage: log.from ?? null,
          to_stage: log.to ?? null,
          actor_id: userId,
        });
        if (aErr) throw aErr;
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const hasProperty = (candidates.data ?? []).length > 0;

  const derived = useMemo(() => {
    if (!lead) return null;
    return {
      action: nextAction(lead, { hasProperty }),
      due: nextFollowUpAt(lead),
      bucket: followUpBucket(lead),
      flags: attentionFlags(lead, { hasProperty }),
    };
  }, [lead, hasProperty]);

  if (!lead || !derived) return null;

  const assignee = people.find((p) => p.id === lead.assigned_to);

  function logContact() {
    if (!lead) return;
    const proposed = proposeStage(lead.stage, channel);
    patchLead.mutate(
      {
        patch: {
          last_contact_at: new Date().toISOString(),
          stage: proposed,
        },
        log: {
          channel,
          outcome: outcome || CHANNEL_LABELS[channel],
          note: note || undefined,
          from: lead.stage,
          to: proposed !== lead.stage ? proposed : undefined,
        },
      },
      {
        onSuccess: () => {
          setOutcome("");
          setNote("");
          toast.success(
            proposed === lead.stage
              ? "Contact logged."
              : `Contact logged — stage moved to ${STAGE_LABELS[proposed]}.`,
          );
        },
      },
    );
  }

  function convert() {
    if (!lead) return;
    patchLead.mutate(
      {
        patch: {
          stage: "converted",
          converted_at: new Date().toISOString(),
          converted_by: userId,
          converted_property_id: candidates.data?.[0]?.property_id ?? null,
          reservation_ref: reservationRef || null,
        },
        log: { channel: "stage_change", outcome: "Booking converted", from: lead.stage, to: "converted" },
      },
      { onSuccess: () => toast.success("✓ Booking converted") },
    );
  }

  function closeLost() {
    if (!lead) return;
    if (!lossReason) {
      toast.error("Choose a loss reason.");
      return;
    }
    if (lossReason === "other" && !lossNote.trim()) {
      toast.error("A note is required for Other.");
      return;
    }
    patchLead.mutate(
      {
        patch: {
          stage: "lost",
          lost_at: new Date().toISOString(),
          lost_reason: lossReason,
          lost_note: lossNote || null,
        },
        log: {
          channel: "stage_change",
          outcome: `Closed as lost — ${LOSS_REASON_LABELS[lossReason]}`,
          note: lossNote || undefined,
          from: lead.stage,
          to: "lost",
        },
      },
      { onSuccess: () => toast.success("Lead closed as lost.") },
    );
  }

  return (
    <Sheet open={Boolean(lead)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-8 text-left">{lead.contact_name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-10">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={stateChip(stageState(lead.stage))}>{STAGE_LABELS[lead.stage]}</Chip>
            <Chip>{SOURCE_LABELS[lead.source]}</Chip>
            {lead.market ? <Chip>{lead.market}</Chip> : null}
            {derived.flags.map((f) => (
              <Chip
                key={f.key}
                className={
                  f.tone === "critical"
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : f.tone === "attention"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-info/40 bg-info/10 text-info"
                }
              >
                {f.label}
              </Chip>
            ))}
          </div>

          <div className="resolve-rise rounded-lg border border-accent/35 bg-accent/8 px-4 py-3">
            <p className="eyebrow">Next action</p>
            <p className="mt-1 text-base font-semibold">{derived.action}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {derived.due
                ? `Next follow-up ${formatDate(derived.due.toISOString())} · ${
                    derived.bucket === "overdue"
                      ? "overdue"
                      : derived.bucket === "today"
                        ? "due today"
                        : "upcoming"
                  }`
                : "No follow-up clock — this opportunity is closed."}
              {" · Last contact "}
              {relativeDays(lead.last_contact_at)}
            </p>
          </div>

          <Facts
            rows={[
              ["Company", lead.company ?? "—"],
              ["Phone", lead.phone ?? "—"],
              ["Email", lead.email ?? "—"],
              ["Assigned to", displayName(assignee)],
              ["Move-in", formatDate(lead.desired_move_in)],
              ["Length of stay", lead.length_of_stay_days ? `${lead.length_of_stay_days} days` : "—"],
              ["Bedrooms", lead.bedrooms ? String(lead.bedrooms) : "—"],
              ["Budget", formatMoney(lead.budget_monthly)],
              ["Pets", lead.pets === null ? "—" : lead.pets ? "Yes" : "No"],
              ["Dates flexible", lead.date_flexible === null ? "—" : lead.date_flexible ? "Yes" : "No"],
            ]}
          />

          {lead.requirements ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{lead.requirements}</p>
          ) : null}

          {Object.keys(lead.source_detail ?? {}).length > 0 && (
            <Facts
              title={`${SOURCE_LABELS[lead.source]} details`}
              rows={Object.entries(lead.source_detail as Record<string, string>).map(([k, v]) => [
                k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
                v || "—",
              ])}
            />
          )}

          <Separator />

          {canEdit && isOpen(lead.stage) && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Log contact</h3>
              <div className="flex flex-wrap gap-2">
                {CONTACT_CHANNELS.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={channel === c ? "default" : "outline"}
                    className="resolve-press"
                    onClick={() => setChannel(c)}
                  >
                    {CHANNEL_LABELS[c]}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Outcome — e.g. first outreach sent, left voicemail"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
              <Textarea
                placeholder="Optional note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Resolve will set last contact to now
                {proposeStage(lead.stage, channel) !== lead.stage
                  ? ` and move the stage to ${STAGE_LABELS[proposeStage(lead.stage, channel)]}.`
                  : "."}
              </p>
              <Button size="sm" className="resolve-press" onClick={logContact} disabled={patchLead.isPending}>
                Log contact
              </Button>
            </section>
          )}

          {canEdit && (
            <section className="space-y-2">
              <Label className="text-sm font-semibold">Stage</Label>
              <Select
                value={lead.stage}
                onValueChange={(v) =>
                  patchLead.mutate({
                    patch: { stage: v as LeadStage },
                    log: { channel: "stage_change", from: lead.stage, to: v as LeadStage, outcome: "Stage changed" },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Candidate properties</h3>
            {(candidates.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No homes linked yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(candidates.data ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link to="/property/$propertyId" params={{ propertyId: c.property_id }} className="underline-offset-2 hover:underline">
                      {c.properties?.nickname ?? c.properties?.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {c.properties?.city ?? "—"} · {c.properties?.bedrooms ?? "?"} bd · {c.properties?.lifecycle_status ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <>
                <Input
                  placeholder="Search homes by name or city…"
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                />
                {(propertyOptions.data ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="resolve-press block w-full rounded-md border px-3 py-1.5 text-left text-sm hover:bg-muted/60"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("lead_properties")
                        .insert({ lead_id: lead.id, property_id: p.id, added_by: userId });
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      setPropertySearch("");
                      invalidate();
                    }}
                  >
                    {p.nickname ?? p.name} · {p.city ?? "—"} · {p.bedrooms ?? "?"} bd
                  </button>
                ))}
              </>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Activity</h3>
            <ol className="space-y-2">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-medium">{CHANNEL_LABELS[a.channel as LeadChannel]}</span>
                  {a.outcome ? ` — ${a.outcome}` : ""}
                  {a.to_stage ? ` → ${STAGE_LABELS[a.to_stage as LeadStage]}` : ""}
                  <span className="ml-2 text-xs text-muted-foreground">{formatDate(a.occurred_at)}</span>
                  {a.note ? <p className="text-xs text-muted-foreground">{a.note}</p> : null}
                </li>
              ))}
              {(activity.data ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Nothing recorded yet.</li>
              )}
            </ol>
          </section>

          {canEdit && isOpen(lead.stage) && (
            <>
              <Separator />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Close the opportunity</h3>
                <Input
                  placeholder="Reservation reference (optional)"
                  value={reservationRef}
                  onChange={(e) => setReservationRef(e.target.value)}
                />
                <Button className="resolve-press w-full" onClick={convert} disabled={patchLead.isPending}>
                  Convert — booking confirmed
                </Button>

                <Select value={lossReason} onValueChange={(v) => setLossReason(v as LeadLossReason)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Loss reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOSS_REASON_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder={lossReason === "other" ? "Required note" : "Optional note"}
                  value={lossNote}
                  onChange={(e) => setLossNote(e.target.value)}
                  rows={2}
                />
                <Button variant="outline" className="resolve-press w-full" onClick={closeLost} disabled={patchLead.isPending}>
                  Close as lost
                </Button>

                {lead.stage === "final_follow_up" && followUpBucket(lead) === "overdue" && (
                  <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                    <p className="text-xs">
                      The final follow-up has lapsed. Close it as lost, or keep it open with a reason — Resolve will
                      not close a legitimate opportunity for you.
                    </p>
                    <Input
                      placeholder="Reason to keep this open"
                      value={keepOpen}
                      onChange={(e) => setKeepOpen(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="resolve-press"
                      onClick={() =>
                        patchLead.mutate(
                          {
                            patch: { keep_open_reason: keepOpen, last_contact_at: new Date().toISOString() },
                            log: { channel: "note", outcome: "Kept open", note: keepOpen },
                          },
                          { onSuccess: () => toast.success("Kept open — follow-up clock reset.") },
                        )
                      }
                      disabled={!keepOpen.trim()}
                    >
                      Keep open
                    </Button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Facts({ title, rows }: { title?: string; rows: [string, string][] }) {
  return (
    <section className="space-y-1.5">
      {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-border/40 pb-1">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
