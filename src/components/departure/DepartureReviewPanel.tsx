import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTicketDrawer } from "@/components/nav/TicketDrawer";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useActivityUpload } from "@/components/work-entry/useActivityUpload";
import { ownerRezBookingUrl } from "@/lib/ownerrez-links";
import { usDate } from "@/lib/dates";
import {
  DAMAGE_CATEGORIES,
  HOST_REVIEW_OPTIONS,
  OUTREACH_NO_REASONS,
  OUTREACH_OPTIONS,
  PLATFORM_LABEL,
  breezewayTaskUrl,
  canComplete,
  cleaningOutcome,
  completionSummary,
  effectiveOutreach,
  hostReviewSupported,
  platformOf,
  reviewRequestGuidance,
  stepChecks,
} from "@/lib/departure-review";

type Review = Tables<"departure_reviews">;

function Choice({ options, value, onChange, disabled }: {
  options: readonly { id: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.id} type="button" size="sm" disabled={disabled}
          variant={value === o.id ? "default" : "outline"} aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Step {n} — {title}</h3>
        {done ? <Badge variant="secondary">Done</Badge> : <Badge variant="outline">To do</Badge>}
      </div>
      {children}
    </section>
  );
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) : "—";

export function DepartureReviewPanel({ reviewId }: { reviewId: string }) {
  const qc = useQueryClient();
  const drawer = useTicketDrawer();
  const userId = useCurrentUserId();
  const upload = useActivityUpload();
  const q = useQuery({
    queryKey: ["departure-review", reviewId],
    queryFn: async () => {
      const { data: r, error } = await supabase.from("departure_reviews").select("*, properties(name)").eq("id", reviewId).single();
      if (error) throw error;
      const [linked, events, claim, ext, docs] = await Promise.all([
        supabase.from("tickets").select("id, ref, title, status, entry_kind").eq("departure_review_id", reviewId).is("archived_at", null).order("created_at"),
        supabase.from("departure_review_events").select("*").eq("departure_review_id", reviewId).order("created_at"),
        r.claim_id ? supabase.from("claims").select("id, title, stage").eq("id", r.claim_id).maybeSingle() : Promise.resolve({ data: null }),
        r.ownerrez_booking_id || r.reservation_code
          ? supabase.from("guest_feedback").select("id, rating, feedback_type").eq("property_id", r.property_id).neq("feedback_type", "internal_survey")
              .or([r.ownerrez_booking_id && `ownerrez_booking_id.eq.${r.ownerrez_booking_id}`, r.reservation_code && `reservation_confirmation.eq.${r.reservation_code}`].filter(Boolean).join(","))
              .limit(1)
          : Promise.resolve({ data: [] }),
        r.attachment_document_ids.length
          ? supabase.from("documents").select("id, filename").in("id", r.attachment_document_ids)
          : Promise.resolve({ data: [] }),
      ]);
      return {
        r: r as Review & { properties: { name: string } | null },
        linked: linked.data ?? [],
        events: events.data ?? [],
        claim: (claim as { data: { id: string; title: string; stage: string } | null }).data,
        externalReview: ((ext as { data: unknown[] | null }).data ?? []).length > 0,
        docs: ((docs as { data: { id: string; filename: string }[] | null }).data ?? []),
      };
    },
  });

  const r = q.data?.r;
  const [propNotes, setPropNotes] = useState("");
  const [dmg, setDmg] = useState({ description: "", estimate: "", notes: "" });
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!r) return;
    setPropNotes(r.property_notes ?? "");
    setDmg({ description: r.damage_description ?? "", estimate: r.damage_estimate?.toString() ?? "", notes: r.damage_notes ?? "" });
    setReason(r.outreach_reason ?? "");
    setNotes(r.notes ?? "");
  }, [r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading Departure Review…</p>;
  if (!r || !q.data) return <p className="p-4 text-sm text-destructive">This Departure Review could not be loaded.</p>;

  const done = r.status === "completed";
  const ctx = { linkedWork: q.data.linked.length, hasClaim: !!r.claim_id, externalReview: q.data.externalReview };
  const checks = stepChecks(r, ctx);
  const ok = (i: number) => checks[i]?.done ?? false;
  const outreach = effectiveOutreach(r, ctx.externalReview);
  const platform = platformOf(r.booking_source);
  const orUrl = ownerRezBookingUrl(r.ownerrez_booking_id);
  const bwUrl = breezewayTaskUrl(r.breezeway_task_id);
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["departure-review", reviewId] }),
    qc.invalidateQueries({ queryKey: ["departure-reviews"] }),
  ]);

  const logEvent = async (event_type: string, summary: string) => {
    if (!userId) return;
    await supabase.from("departure_review_events").insert({ departure_review_id: r.id, property_id: r.property_id, event_type, summary, actor_id: userId });
  };

  /** Saves answers; claims the review for the person working it if nobody has. */
  const save = async (patch: Partial<Review>, event?: [string, string]) => {
    setBusy(true);
    const claim = !r.claimed_by && userId ? { claimed_by: userId, claimed_at: new Date().toISOString(), status: "in_progress" } : {};
    const { error } = await supabase.from("departure_reviews").update({ ...claim, ...patch } as never).eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (event) await logEvent(event[0], event[1]);
    await refresh();
  };

  const createClaim = async () => {
    setBusy(true);
    const cats = r.damage_categories.map((c) => DAMAGE_CATEGORIES.find((d) => d.id === c)?.label ?? c);
    const { data, error } = await supabase.from("claims").insert({
      claim_type: "guest_damage",
      title: `Departure damage — ${cats.join(", ")}`,
      incident_description: dmg.description || r.damage_description || null,
      incident_on: r.stay_departure,
      property_id: r.property_id,
      guest_name: r.guest_name,
      reservation_channel: r.booking_source,
      reservation_confirmation: r.reservation_code,
      ownerrez_booking_id: r.ownerrez_booking_id,
      stay_arrival: r.stay_arrival,
      stay_departure: r.stay_departure,
      estimated_amount: dmg.estimate ? Number(dmg.estimate) : r.damage_estimate,
      created_by: userId,
      is_demo: r.is_demo,
      departure_review_id: r.id,
      damage_categories: r.damage_categories,
      evidence_document_ids: r.attachment_document_ids,
    } as never).select("id").single();
    if (error) {
      setBusy(false);
      toast.error(error.code === "23505" ? "A Claim is already linked to this Departure Review." : error.message);
      return;
    }
    await supabase.from("departure_reviews").update({ claim_id: data.id }).eq("id", r.id);
    await supabase.from("cleaning_reviews").update({ linked_claim_id: data.id }).eq("departure_review_id", r.id);
    await logEvent("claim_created", "Claim created and sent to the Claims queue");
    setBusy(false);
    toast.success("Claim created in the Claims queue.");
    await refresh();
  };

  const uploadFiles = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const ids = await upload(r.property_id, files);
      const all = [...r.attachment_document_ids, ...ids];
      await supabase.from("departure_reviews").update({ attachment_document_ids: all }).eq("id", r.id);
      await supabase.from("cleaning_reviews").update({ photo_document_ids: all }).eq("departure_review_id", r.id);
      setFiles([]);
      toast.success("Files attached.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const { error: crErr } = await supabase.from("cleaning_reviews").update({
      reviewed_by: r.clean_reviewed_by ?? userId,
      reviewed_at: r.clean_reviewed_at,
      outcome: cleaningOutcome(r),
      property_issues_found: r.property_attention === "yes",
      damage_found: r.damage_screen !== "no",
      notes: [r.property_notes, r.damage_description, notes].filter(Boolean).join("\n\n") || null,
      photo_document_ids: r.attachment_document_ids,
      linked_ticket_ids: q.data!.linked.map((t) => t.id),
      linked_claim_id: r.claim_id,
    }).eq("departure_review_id", r.id);
    if (crErr) { setBusy(false); toast.error(crErr.message); return; }
    const { error } = await supabase.from("departure_reviews").update({
      status: "completed", completed_at: now, completed_by: userId, notes: notes || null,
      outreach_decision: outreach, claimed_by: r.claimed_by ?? userId,
    }).eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logEvent("completed", "Departure Review completed");
    toast.success("Departure Review completed.");
    await refresh();
  };

  const summary = completionSummary(r, ctx);
  const locked = done || busy;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold">{r.properties?.name ?? "Property"}</h2>
          <Badge variant={done ? "secondary" : "default"}>{done ? "Completed" : r.status === "in_progress" ? "In progress" : "Open"}</Badge>
          {r.is_demo && <Badge variant="outline">Demo</Badge>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Reservation guest</dt><dd>{r.guest_name ?? "—"}</dd>
          <dt className="text-muted-foreground">Stay</dt><dd>{r.stay_arrival ? usDate(r.stay_arrival) : "—"} – {r.stay_departure ? usDate(r.stay_departure) : "—"}</dd>
          <dt className="text-muted-foreground">Reservation</dt><dd>{r.reservation_code ?? r.ownerrez_booking_id ?? "—"}{orUrl && <> · <a className="underline" href={orUrl} target="_blank" rel="noreferrer">Open in OwnerRez</a></>}</dd>
          <dt className="text-muted-foreground">Booking source</dt><dd>{r.booking_source ? PLATFORM_LABEL[platform] : "—"}</dd>
          <dt className="text-muted-foreground">Deposit</dt><dd>{r.deposit_amount != null ? `$${r.deposit_amount}` : "Not known"}{r.deposit_payer ? ` · ${r.deposit_payer}` : ""}</dd>
          <dt className="text-muted-foreground">Claimed by</dt><dd>{r.claimed_by ? (r.claimed_by === userId ? "You" : "A Team B teammate") : "Unclaimed — anyone on Team B can take it"}</dd>
        </dl>
      </div>

      <Step n={1} title="Review departure clean" done={ok(0)}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Clean</dt><dd>{r.clean_name ?? "Departure clean"}</dd>
          <dt className="text-muted-foreground">Cleaner</dt><dd>{r.cleaner_name || "Not provided by Breezeway"}</dd>
          <dt className="text-muted-foreground">{r.clean_completed_exact ? "Finished in Breezeway" : "Last Breezeway update"}</dt><dd>{r.clean_completed_at ? fmtTime(r.clean_completed_at) : "Not provided"}{!r.clean_completed_exact && r.clean_completed_at ? " (not an exact finish time)" : ""}</dd>
          <dt className="text-muted-foreground">Photos</dt><dd>{r.clean_photo_count ?? 0} in Breezeway</dd>
        </dl>
        {bwUrl && <a className="text-sm underline" href={bwUrl} target="_blank" rel="noreferrer">Open the clean in Breezeway</a>}
        {r.clean_reviewed_at ? (
          <p className="text-sm text-muted-foreground">Reviewed {fmtTime(r.clean_reviewed_at)}.</p>
        ) : (
          <Button size="sm" disabled={locked} onClick={() => save({ clean_reviewed_at: new Date().toISOString(), clean_reviewed_by: userId }, ["clean_reviewed", "Departure clean reviewed"])}>
            I reviewed the departure clean
          </Button>
        )}
      </Step>

      {r.clean_reviewed_at && (
        <>
          <Step n={2} title="Property condition" done={ok(1)}>
            <p className="text-sm">Is there anything that needs attention at the property?</p>
            <Choice options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} value={r.property_attention} disabled={locked}
              onChange={(v) => save({ property_attention: v })} />
            {r.property_attention === "yes" && (
              <div className="space-y-2">
                <Label htmlFor="dr-prop">What needs attention?</Label>
                <Textarea id="dr-prop" value={propNotes} disabled={locked} onChange={(e) => setPropNotes(e.target.value)}
                  onBlur={() => propNotes !== (r.property_notes ?? "") && save({ property_notes: propNotes })} />
                {q.data.linked.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {q.data.linked.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="underline" onClick={() => drawer?.openTicket(t.id)}>
                          #{t.ref} {t.title}
                        </button>{" "}
                        <Badge variant="outline">{t.entry_kind === "maintenance" ? "Maintenance" : "Ops Ticket"} · {t.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {!done && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { void logEvent("follow_up", "Property follow-up started (Report Maintenance)"); drawer?.openNewTicket({ property: r.property_id, kind: "maintenance", departureReview: r.id }); }}>Report linked Maintenance</Button>
                    <Button size="sm" variant="outline" onClick={() => { void logEvent("follow_up", "Property follow-up started (Ops Ticket)"); drawer?.openNewTicket({ property: r.property_id, kind: "ops", departureReview: r.id }); }}>Create linked Ops Ticket</Button>
                  </div>
                )}
              </div>
            )}
          </Step>

          <Step n={3} title="Damage / claim screening" done={ok(2)}>
            <p className="text-sm">Did the departure clean identify damage or another issue that may require guest recovery?</p>
            <Choice options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Unsure" }]} value={r.damage_screen} disabled={locked}
              onChange={(v) => save({ damage_screen: v })} />
            {(r.damage_screen === "yes" || r.damage_screen === "unsure") && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Damage categories">
                  {DAMAGE_CATEGORIES.map((c) => {
                    const on = r.damage_categories.includes(c.id);
                    return (
                      <Button key={c.id} size="sm" type="button" disabled={locked} variant={on ? "default" : "outline"} aria-pressed={on}
                        onClick={() => save({ damage_categories: on ? r.damage_categories.filter((x) => x !== c.id) : [...r.damage_categories, c.id] })}>
                        {c.label}
                      </Button>
                    );
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="dr-dd">Description</Label>
                    <Textarea id="dr-dd" value={dmg.description} disabled={locked} onChange={(e) => setDmg({ ...dmg, description: e.target.value })}
                      onBlur={() => save({ damage_description: dmg.description || null })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dr-de">Estimated amount (if known)</Label>
                    <Input id="dr-de" type="number" min="0" step="0.01" value={dmg.estimate} disabled={locked} onChange={(e) => setDmg({ ...dmg, estimate: e.target.value })}
                      onBlur={() => save({ damage_estimate: dmg.estimate ? Number(dmg.estimate) : null })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dr-dn">Notes</Label>
                    <Input id="dr-dn" value={dmg.notes} disabled={locked} onChange={(e) => setDmg({ ...dmg, notes: e.target.value })}
                      onBlur={() => save({ damage_notes: dmg.notes || null })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Add photos/evidence in Notes &amp; files below — they travel with the Claim.</p>
                {q.data.claim ? (
                  <p className="text-sm">Linked Claim: <a className="underline" href="/claims">{q.data.claim.title}</a> <Badge variant="outline">{q.data.claim.stage}</Badge></p>
                ) : !done && r.damage_categories.length > 0 ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={createClaim}>Pursue a Claim</Button>
                ) : null}
              </div>
            )}
          </Step>

          <Step n={4} title="Review outreach" done={ok(3)}>
            {ctx.externalReview ? (
              <p className="text-sm"><Badge>Guest already reviewed</Badge> An external review for this reservation has arrived — no review request needed.</p>
            ) : (
              <>
                <p className="text-sm">Is this guest appropriate for review outreach?</p>
                <Choice options={OUTREACH_OPTIONS} value={r.outreach_decision} disabled={locked}
                  onChange={(v) => save({ outreach_decision: v, outreach_status: v === "yes" ? r.outreach_status : v === "no" ? "not_requested" : v === "unable" ? "unable" : "already_reviewed" }, ["outreach", `Review outreach decision: ${OUTREACH_OPTIONS.find((o) => o.id === v)?.label}`])} />
                {r.outreach_decision === "no" && (
                  <div className="space-y-2">
                    <Label>Reason (required)</Label>
                    <div className="flex flex-wrap gap-2">
                      {OUTREACH_NO_REASONS.map((x) => (
                        <Button key={x} size="sm" type="button" disabled={locked} variant={reason === x ? "default" : "outline"}
                          onClick={() => { setReason(x); void save({ outreach_reason: x }); }}>{x}</Button>
                      ))}
                    </div>
                  </div>
                )}
                {r.outreach_decision === "yes" && (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{reviewRequestGuidance(r.booking_source)} Resolve does not send review requests itself.</p>
                    <Choice options={[{ id: "requested", label: "Requested" }, { id: "not_requested", label: "Not requested" }, { id: "unable", label: "Unable to request" }]}
                      value={r.outreach_status} disabled={locked} onChange={(v) => save({ outreach_status: v })} />
                  </div>
                )}
              </>
            )}
          </Step>

          <Step n={5} title="Host review" done={ok(4)}>
            {hostReviewSupported(r.booking_source) ? (
              <>
                <p className="text-sm">Complete host review on {PLATFORM_LABEL[platform]}.</p>
                <Choice options={HOST_REVIEW_OPTIONS} value={r.host_review} disabled={locked}
                  onChange={(v) => save({ host_review: v }, v === "completed" ? ["host_review", "Host review completed"] : undefined)} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{r.booking_source ? `${PLATFORM_LABEL[platform]} bookings` : "This booking source"} don’t support host reviews — nothing to do.</p>
            )}
          </Step>

          <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Notes and files">
            <h3 className="font-semibold">Notes &amp; files</h3>
            <Textarea aria-label="Notes" value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (r.notes ?? "") && save({ notes: notes || null })} />
            {q.data.docs.length > 0 && <ul className="text-sm">{q.data.docs.map((d) => <li key={d.id}>📎 {d.filename}</li>)}</ul>}
            {!done && (
              <div className="flex flex-wrap items-center gap-2">
                <Input type="file" multiple aria-label="Attach photos or files" className="max-w-xs" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                <Button size="sm" variant="outline" disabled={!files.length || busy} onClick={uploadFiles}>Attach</Button>
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-lg border border-primary/40 bg-card p-4" aria-label="Summary">
            <h3 className="font-semibold">Summary</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Departure clean</dt><dd>{summary.clean}</dd>
              <dt className="text-muted-foreground">Property issues</dt><dd>{summary.property}</dd>
              <dt className="text-muted-foreground">Damage / claim</dt><dd>{summary.damage}</dd>
              <dt className="text-muted-foreground">Review outreach</dt><dd>{summary.outreach}</dd>
              <dt className="text-muted-foreground">Host review</dt><dd>{summary.host}</dd>
              <dt className="text-muted-foreground">Notes</dt><dd>{notes ? "Added" : "None"}</dd>
              <dt className="text-muted-foreground">Attachments</dt><dd>{r.attachment_document_ids.length}</dd>
            </dl>
            {!done && (
              <>
                {checks.filter((c) => !c.done).map((c) => <p key={c.id} className="text-xs text-muted-foreground">• {c.missing}</p>)}
                <Button disabled={!canComplete(r, ctx) || busy} onClick={complete}>Complete Departure Review</Button>
              </>
            )}
          </section>
        </>
      )}

      <section className="space-y-1 text-sm" aria-label="History">
        <h3 className="font-semibold">History</h3>
        <ul className="space-y-1">
          {q.data.events.map((e) => (
            <li key={e.id} className="text-muted-foreground"><span className="text-foreground">{e.summary}</span> · {fmtTime(e.created_at)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
