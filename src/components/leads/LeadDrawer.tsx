import { formatPropertyLabel } from "@/lib/property-label";
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
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OutlookSourceCard } from "@/components/OutlookSourceCard";
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
  SOURCE_LABELS,
  STAGE_LABELS,
  attentionFlags,
  followUpBucket,
  formatDate,
  isOpen,
  nextAction,
  nextFollowUpAt,
  proposeStage,
  relativeDays,
  type LeadChannel,
  type LeadLossReason,
  type LeadStage,
} from "@/lib/leads";
import {
  LEAD_OUTCOME_LABELS,
  OFFER_OUTCOME_LABELS,
  finderSearchFromLead,
  guestsPetsLabel,
  leadFollowUpDate,
  leadOutcome,
  leadRegion,
  offerOutcome,
  sortOffers,
  stayDatesLabel,
  validateLeadLost,
  waitingOffer,
  type LeadOffer,
} from "@/lib/lead-offers";
import { decideLeadOffer, updateLeadDetails } from "@/lib/lead-offers.functions";
import type { LeadRow, LeadUpdate } from "@/lib/lead-types";

type OfferProperty = {
  name: string; nickname: string | null; city: string | null; bedrooms: number | null;
  lifecycle_status: string | null; address_line1: string | null; unit: string | null;
  state: string | null; postal_code: string | null; ownerrez_property_id: string | null;
};
type OfferRow = LeadOffer & { properties: OfferProperty | null };

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
  const navigate = useNavigate();
  const decideOffer = useServerFn(decideLeadOffer);
  const saveLeadDetails = useServerFn(updateLeadDetails);
  const [channel, setChannel] = useState<LeadChannel>("email");
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [lossReason, setLossReason] = useState<LeadLossReason | "">("");
  const [lossNote, setLossNote] = useState("");
  const [keepOpen, setKeepOpen] = useState("");
  const [editingWho, setEditingWho] = useState(false);
  const [whoForm, setWhoForm] = useState({ organization: "", contactName: "", phone: "", email: "" });
  const [followUpOn, setFollowUpOn] = useState("");
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [choosePrompt, setChoosePrompt] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // Offers live on lead_properties. The offer columns come from the staged v2
  // SQL; until it is applied this query fails and the section says so instead
  // of breaking the drawer.
  const candidates = useQuery({
    queryKey: ["lead-properties", leadId],
    enabled: Boolean(leadId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_properties")
        .select(
          "id, lead_id, property_id, note, presented_at, added_by, created_at, quote_total, quote_currency, outcome, outcome_reason, outcome_at, outcome_by, properties(name, nickname, city, bedrooms, lifecycle_status, address_line1, unit, state, postal_code, ownerrez_property_id)",
        )
        .eq("lead_id", leadId!);
      if (error) throw error;
      return (data ?? []) as unknown as OfferRow[];
    },
  });

  const convertedProperty = useQuery({
    queryKey: ["lead-converted-property", lead?.converted_property_id],
    enabled: Boolean(lead?.converted_property_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname, city, address_line1, unit, state, postal_code, ownerrez_property_id")
        .eq("id", lead!.converted_property_id!)
        .maybeSingle();
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

  const offers = sortOffers(candidates.data ?? []);
  const hasProperty = offers.length > 0;
  const waiting = waitingOffer(offers);

  async function decide(offerId: string, decision: "declined" | "accepted", reason?: string) {
    setSaving(true);
    try {
      await decideOffer({ data: { offerId, decision, ...(reason ? { reason } : {}) } });
      toast.success(decision === "accepted" ? "Booked: this lead is now Booked on that home." : "Offer marked declined.");
      setDeclineId(null);
      setDeclineReason("");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the answer.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWho() {
    if (!lead) return;
    setSaving(true);
    try {
      await saveLeadDetails({
        data: {
          leadId: lead.id,
          who: {
            organization: whoForm.organization || undefined,
            contactName: whoForm.contactName || undefined,
            phone: whoForm.phone || undefined,
            email: whoForm.email || undefined,
          },
          nextFollowUpOn: followUpOn || null,
        },
      });
      toast.success("Lead details saved.");
      setEditingWho(false);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the lead details.");
    } finally {
      setSaving(false);
    }
  }

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
              : `Contact logged: stage moved to ${STAGE_LABELS[proposed]}.`,
          );
        },
      },
    );
  }

  function closeLost() {
    if (!lead) return;
    const problem = validateLeadLost(lossReason, lossNote);
    if (problem || !lossReason) {
      toast.error(problem ?? "Choose a reason.");
      return;
    }
    const reason = lossReason;
    patchLead.mutate(
      {
        patch: {
          stage: "lost",
          lost_at: new Date().toISOString(),
          lost_reason: reason,
          lost_note: lossNote || null,
        },
        log: {
          channel: "stage_change",
          outcome: `Closed as lost: ${LOSS_REASON_LABELS[reason]}`,
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
          <SheetTitle className="pr-8 text-left">{lead.contact_name ?? "Lead"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Something operational to handle for this lead?
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/tickets/new" search={{ lead: lead.id, from: "lead" }}>
                Report an issue
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip className={stateChip(stageState(lead.stage))}>{LEAD_OUTCOME_LABELS[leadOutcome(lead)]}</Chip>
            <Chip>{SOURCE_LABELS[lead.source]}</Chip>
            {leadRegion(lead) !== "Not set" ? <Chip>{leadRegion(lead)}</Chip> : null}
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
                : "No follow-up clock: this opportunity is closed."}
              {" · Last contact "}
              {relativeDays(lead.last_contact_at)}
            </p>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Who and the stay</h3>
              {canEdit && !editingWho && (
                <Button
                  size="sm"
                  variant="outline"
                  className="resolve-press"
                  onClick={() => {
                    setWhoForm({
                      organization: lead.company ?? "",
                      contactName: lead.contact_name ?? "",
                      phone: lead.phone ?? "",
                      email: lead.email ?? "",
                    });
                    setFollowUpOn(leadFollowUpDate(lead) ?? "");
                    setEditingWho(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
            {editingWho ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Input placeholder="Organization or inquiry source" value={whoForm.organization} onChange={(e) => setWhoForm((w) => ({ ...w, organization: e.target.value }))} />
                <Input placeholder="Contact name" value={whoForm.contactName} onChange={(e) => setWhoForm((w) => ({ ...w, contactName: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Phone" value={whoForm.phone} onChange={(e) => setWhoForm((w) => ({ ...w, phone: e.target.value }))} />
                  <Input placeholder="Email" value={whoForm.email} onChange={(e) => setWhoForm((w) => ({ ...w, email: e.target.value }))} />
                </div>
                <Label className="text-xs text-muted-foreground">Next follow-up date</Label>
                <Input type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" className="resolve-press" onClick={() => void saveWho()} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingWho(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Facts
                rows={[
                  ["Organization / source", lead.company ?? "Not set"],
                  ["Contact", lead.contact_name ?? "Not recorded yet"],
                  ["Phone", lead.phone ?? "Not set"],
                  ["Email", lead.email ?? "Not set"],
                  ["Region", leadRegion(lead)],
                  ["Stay", stayDatesLabel(lead)],
                  ["Guests and pets", guestsPetsLabel(lead)],
                  ["Next follow-up", leadFollowUpDate(lead) ?? (derived.due ? formatDate(derived.due.toISOString()) : "-")],
                  ["Assigned to", displayName(assignee)],
                ]}
              />
            )}
          </section>

          <OutlookSourceCard entityType="lead" entityId={lead.id} />

          {lead.stage === "converted" ? (
            <section className="resolve-rise space-y-1.5 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
              <p className="eyebrow">Booked</p>
              <p className="text-sm font-semibold">Booking confirmed</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Converted</dt>
                <dd className="text-right font-medium">{formatDate(lead.converted_at)}</dd>
                <dt className="text-muted-foreground">Property</dt>
                <dd className="text-right font-medium">
                  {convertedProperty.data ? (
                    <Link
                      to="/property/$propertyId"
                      params={{ propertyId: convertedProperty.data.id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {formatPropertyLabel(convertedProperty.data).primary}
                    </Link>
                  ) : (
                    "Not recorded"
                  )}
                </dd>
                <dt className="text-muted-foreground">Reservation ref</dt>
                <dd className="text-right font-medium">{lead.reservation_ref ?? "Not recorded"}</dd>
                <dt className="text-muted-foreground">Converted by</dt>
                <dd className="text-right font-medium">
                  {lead.converted_by
                    ? displayName(people.find((p) => p.id === lead.converted_by))
                    : "Not recorded"}
                </dd>
              </dl>
            </section>
          ) : null}

          {lead.requirements ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{lead.requirements}</p>
          ) : null}

          {Object.keys(lead.source_detail ?? {}).length > 0 && (
            <Facts
              title={`${SOURCE_LABELS[lead.source]} details`}
              rows={Object.entries(lead.source_detail as Record<string, string>).map(([k, v]) => [
                k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
                v || "Not set",
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
                placeholder="Outcome: e.g. first outreach sent, left voicemail"
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
              <Button
                size="sm"
                className="resolve-press"
                onClick={logContact}
                disabled={patchLead.isPending}
              >
                Log contact
              </Button>
            </section>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Offers</h3>
            </div>
            {candidates.error ? (
              <p className="text-sm text-muted-foreground">Offers will appear here once the pending lead update is applied.</p>
            ) : offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No homes offered yet. Offer homes from Direct Bookings.</p>
            ) : (
              <ul className="space-y-2">
                {offers.map((offer) => (
                  <li key={offer.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to="/property/$propertyId"
                        params={{ propertyId: offer.property_id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {offer.properties ? formatPropertyLabel(offer.properties).primary : "Home"}
                      </Link>
                      <Chip className={offerOutcome(offer) === "accepted" ? stateChip("done") : offerOutcome(offer) === "declined" ? stateChip("blocked") : stateChip("waiting")}>
                        {OFFER_OUTCOME_LABELS[offerOutcome(offer)]}
                      </Chip>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Offered {formatDate(offer.presented_at ?? offer.created_at)}
                      {offer.quote_total !== null ? ` · quoted $${Number(offer.quote_total).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : ""}
                      {offer.added_by ? ` · by ${displayName(people.find((p) => p.id === offer.added_by))}` : ""}
                    </p>
                    {offerOutcome(offer) === "declined" && offer.outcome_reason ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">Declined: {offer.outcome_reason}</p>
                    ) : null}
                    {canEdit && isOpen(lead.stage) && offerOutcome(offer) === "waiting" && (
                      <div className="mt-2 space-y-2">
                        {declineId === offer.id ? (
                          <div className="space-y-2">
                            <Input
                              placeholder="Reason it was declined"
                              value={declineReason}
                              onChange={(e) => setDeclineReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="resolve-press" disabled={saving || !declineReason.trim()} onClick={() => void decide(offer.id, "declined", declineReason)}>
                                Save declined
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setDeclineId(null); setDeclineReason(""); }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" className="resolve-press" disabled={saving} onClick={() => void decide(offer.id, "accepted")}>
                              Accepted: book this home
                            </Button>
                            <Button size="sm" variant="outline" className="resolve-press" onClick={() => { setDeclineId(offer.id); setDeclineReason(""); }}>
                              Declined
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Activity</h3>
            <ol className="space-y-2">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-medium">{CHANNEL_LABELS[a.channel as LeadChannel]}</span>
                  {a.outcome ? ` · ${a.outcome}` : ""}
                  {a.to_stage ? ` to ${STAGE_LABELS[a.to_stage as LeadStage]}` : ""}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDate(a.occurred_at)}
                  </span>
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
                <p className="text-xs text-muted-foreground">
                  To mark the lead Booked, accept the offer on the home they chose under Offers.
                </p>

                <Select
                  value={lossReason}
                  onValueChange={(v) => setLossReason(v as LeadLossReason)}
                >
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
                <Button
                  variant="outline"
                  className="resolve-press w-full"
                  onClick={closeLost}
                  disabled={patchLead.isPending}
                >
                  Close as lost
                </Button>

                {lead.stage === "final_follow_up" && followUpBucket(lead) === "overdue" && (
                  <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                    <p className="text-xs">
                      The final follow-up has lapsed. Close it as lost, or keep it open with a
                      reason. Resolve will not close a legitimate opportunity for you.
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
                            patch: {
                              keep_open_reason: keepOpen,
                              last_contact_at: new Date().toISOString(),
                            },
                            log: { channel: "note", outcome: "Kept open", note: keepOpen },
                          },
                          { onSuccess: () => toast.success("Kept open: follow-up clock reset.") },
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
