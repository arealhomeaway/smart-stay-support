import { formatPropertyLabel, matchesPropertySearch } from "@/lib/property-label";
import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import {
  isPostStayFeedback,
  suggestActiveStayImpact,
  suggestGuestComm,
  type IssueRelation,
  type Occupancy,
} from "@/lib/guest-impact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { captureTicketReservation, getPropertyStay } from "@/lib/ownerrez.functions";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Mic, X } from "lucide-react";
import { useFeatureFlags } from "@/lib/feature-flags";
import { CHECKLIST_CATEGORIES, categoryUsesChecklist, isActiveGuest, parseChecklistRow, templatePriority } from "@/lib/ticket-checklists";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slaDueDates } from "@/lib/tickets";
import {
  activityCategoryFor,
  guestInHomeFrom,
  NOT_SURE_PROBLEM,
  ONE_TOUCH_DID,
  oneTouchOutcome,
  REPAIR_WORDS,
  repeatLine,
  understandRecordWork,
  urgencyWords,
  whoWillDoIt,
} from "@/lib/record-work";
import type { EntryKind } from "@/lib/work-entry";
import { useActivityUpload } from "@/components/work-entry/useActivityUpload";
import { BackControl } from "@/components/nav/NavContext";
import { resolveOrigin } from "@/lib/nav-context";

/**
 * Context handed in by whichever surface launched this form. It only
 * pre-populates the home and records where the work came from.
 */
type NewTicketSearch = {
  property?: string;
  lead?: string;
  project?: string;
  from?: string;
  /** Navigation-context token for the workspace this was launched from. */
  origin?: string;
  /** Older links still carry it; Record work sets the label from the text. */
  kind?: EntryKind;
  /** Guest feedback record this new work follows up on (kept separate from it). */
  feedback?: string;
  /** Departure Review this work was raised from (kept separate from it). */
  departureReview?: string;
};

export const Route = createFileRoute("/_authenticated/tickets/new")({
  validateSearch: (search: Record<string, unknown>): NewTicketSearch => {
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const out: NewTicketSearch = {};
    const property = str(search["property"]);
    const lead = str(search["lead"]);
    const project = str(search["project"]);
    const from = str(search["from"]);
    const origin = str(search["origin"]);
    if (property) out.property = property;
    if (lead) out.lead = lead;
    if (project) out.project = project;
    if (from) out.from = from;
    if (origin) out.origin = origin;
    const feedback = str(search["feedback"]);
    if (feedback && /^[0-9a-f-]{36}$/i.test(feedback)) out.feedback = feedback;
    const departureReview = str(search["departureReview"]);
    if (departureReview && /^[0-9a-f-]{36}$/i.test(departureReview)) out.departureReview = departureReview;
    const kind = str(search["kind"]);
    if (kind === "activity" || kind === "ops" || kind === "maintenance") out.kind = kind;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Record work | Resolve Operations" },
      { name: "description", content: "Say which home and what is wrong. Create a ticket or save it to the home's history." },
      { property: "og:title", content: "Record work | Resolve Operations" },
      { property: "og:description", content: "One form: Resolve reads the problem, sets the urgency and sends it to the right role." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewMatterPage,
});

function NewMatterPage() {
  const router = useRouter();
  const context = Route.useSearch();
  return (
    <NewTicketForm
      context={context}
      onCreated={(id) => router.navigate({ to: "/tickets/$ticketId", params: { ticketId: id } })}
    />
  );
}

export type { NewTicketSearch };

type WorkTypeRow = {
  id: string;
  name: string;
  category: string;
  bucket: string | null;
  default_priority: string;
  functional_role_code: string | null;
  playbook_id: string | null;
  response_minutes: number | null;
  action_start_minutes: number | null;
  pending_approval?: boolean | null;
};

type RepeatInfo = { line: string; flagged: boolean } | null;

type Saved = {
  kind: "ticket" | "one_touch";
  ticketId?: string;
  problem: string;
  home: string;
  who?: string;
  repeat: RepeatInfo;
  /** One touch: what the person did (register T11). */
  did?: string;
};

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/**
 * Record work: one form. Which home, what is wrong, what Resolve understood,
 * then Create ticket or One touch. The full page and the shell side panel
 * both render it; Open ticket is the only thing that differs.
 */
export function NewTicketForm({
  context,
  onCreated,
  inPanel = false,
}: {
  context: NewTicketSearch;
  /** Open ticket (or an existing linked ticket). */
  onCreated: (ticketId: string) => void;
  /** Rendered in the shell side panel: the panel's Close is the way back. */
  inPanel?: boolean;
}) {
  const { can, readOnly, isLoading: rolesLoading } = useRole();
  // In the demo environment a new ticket is a demo ticket: it lands in the
  // demo queues, never in the real counts, and reaches no guest or vendor.
  const { demoMode } = useDemo();
  const flags = useFeatureFlags();
  const qc = useQueryClient();
  const upload = useActivityUpload();

  const [propertyId, setPropertyId] = useState(context.property ?? "");
  const [propertyQuery, setPropertyQuery] = useState("");
  const [description, setDescription] = useState("");
  const [didWhat, setDidWhat] = useState("");
  const [chosenWorkTypeId, setChosenWorkTypeId] = useState<string | null>(null);
  const [pickingProblem, setPickingProblem] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState<null | "ticket" | "one_touch" | "escalate">(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const [speechCtor, setSpeechCtor] = useState<SpeechCtor | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setSpeechCtor(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
  }, []);

  const { data: properties } = useQuery({
    queryKey: ["properties", demoMode, context.property ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname, listing_alias, address_line1, unit, city, state, postal_code, ownerrez_property_id")
        .eq("active", true)
        .or(`is_demo.eq.${demoMode}${context.property ? `,id.eq.${context.property}` : ""}`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // OwnerRez tells us who is actually in the home right now (T9: in the home = affected).
  const fetchStay = useServerFn(getPropertyStay);
  const { data: stay } = useQuery({
    queryKey: ["ownerrez-stay", propertyId],
    queryFn: () => fetchStay({ data: { propertyId } }),
    enabled: Boolean(propertyId),
    retry: false,
  });
  const stayData = stay?.ok && stay.propertyId === propertyId ? stay.data : null;

  // A lead only carries context: the home it is already linked to.
  const { data: leadContext } = useQuery({
    queryKey: ["lead-ticket-context", context.lead],
    enabled: Boolean(context.lead),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, contact_name, lead_properties(property_id)")
        .eq("id", context.lead!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const linked = leadContext?.lead_properties?.[0]?.property_id;
    if (linked) setPropertyId((p) => p || linked);
  }, [leadContext]);

  const { data: workTypes } = useQuery({
    queryKey: ["work-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_types").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return data as unknown as WorkTypeRow[];
    },
  });
  const problemTypes = useMemo(() => (workTypes ?? []).filter((w) => !w.pending_approval), [workTypes]);

  const { data: playbooks } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("id, title, category")
        .eq("active", true)
        .in("status", ["approved", "active"])
        .is("checklist", null)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const understood = useMemo(
    () =>
      understandRecordWork({
        text: description,
        catalog: problemTypes,
        chosenWorkTypeId,
        occupancy: stayData?.occupancy_status ?? null,
      }),
    [description, problemTypes, chosenWorkTypeId, stayData?.occupancy_status],
  );
  const workType = understood.workType;

  // Guided checklist (unchanged rule): the same category the old form picked from the situation.
  const checklistGuestActive = isActiveGuest({
    inHome: understood.occupancy === "occupied",
    nextArrival: (stayData as { next_arrival?: string | null } | null)?.next_arrival ?? null,
  });
  const situationCategory = useMemo(() => {
    const c = CHECKLIST_CATEGORIES.find((c) => c.flag && c.situation(checklistGuestActive) === understood.situation?.id);
    return c?.id ?? null;
  }, [checklistGuestActive, understood.situation?.id]);
  const activeCategory =
    understood.entryKind === "maintenance"
      ? categoryUsesChecklist("maintenance", flags.enabled) ? "maintenance" : null
      : situationCategory && categoryUsesChecklist(situationCategory, flags.enabled) ? situationCategory : null;
  const liveChecklist = useQuery({
    queryKey: ["live-ticket-checklist", activeCategory],
    enabled: Boolean(activeCategory),
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("playbooks")
        .select("id, title, version, checklist, checklist_category, sop_url")
        .eq("checklist_category", activeCategory)
        .eq("status", "approved")
        .not("checklist", "is", null)
        .maybeSingle();
      if (error) throw error;
      return data ? parseChecklistRow(data) : null;
    },
  });
  const checklistStart = activeCategory ? templatePriority(liveChecklist.data, checklistGuestActive) : null;
  const priority = checklistStart ?? understood.priority;

  // Who will do it: the routing by time result for this problem type, as a role.
  const { data: route } = useQuery({
    queryKey: ["record-work-route", workType?.id ?? null],
    enabled: Boolean(propertyId) && description.trim().length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: any; error: any }> })
        .rpc("record_work_route_preview", { _work_type_id: workType?.id ?? null });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as { who_kind: string; role_name: string | null } | null;
    },
  });
  const who = whoWillDoIt(route, Boolean(workType));

  const home = (properties ?? []).find((p) => p.id === propertyId);
  const homeLabel = home ? formatPropertyLabel(home).primary : "";
  const ready = Boolean(propertyId) && description.trim().length > 0;
  const showUnderstood = ready && description.trim().length >= 3;

  async function readRepeat(): Promise<RepeatInfo> {
    if (!workType || !propertyId) return null;
    const { data } = await (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: any }> }).rpc(
      "home_problem_repeat",
      { _property_id: propertyId, _work_type_id: workType.id },
    );
    const r = Array.isArray(data) ? data[0] : data;
    if (!r) return null;
    return { line: repeatLine(workType.name, r.times_in_window, r.window_days), flagged: Boolean(r.flagged) };
  }

  function resetForAnother() {
    setDescription("");
    setDidWhat("");
    setChosenWorkTypeId(null);
    setPickingProblem(false);
    setFiles([]);
    setSaved(null);
    setCreatedTicketId(null);
    setEscalated(false);
  }

  /** One ordinary ticket through the existing creation and routing. Returns its id. */
  async function createTicket(): Promise<string | null> {
    if (createdTicketId) return createdTicketId;
    const title = description.trim().split("\n")[0]!.slice(0, 140);
    const sourceReference = context.lead
      ? `resolve:lead:${context.lead}`
      : context.project
        ? `resolve:onboarding:${context.project}`
        : context.from === "property_hub" && context.property
          ? `resolve:property_hub:${context.property}`
          : context.from
            ? `resolve:${context.from}`
            : null;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const now = new Date();
    const { response_due_at, action_due_at } = slaDueDates(priority, now, workType);
    const entryKind = understood.entryKind;
    const playbookId = workType?.playbook_id && playbooks?.some((p) => p.id === workType.playbook_id) ? workType.playbook_id : null;

    // A demo home only ever carries demo Tickets, whatever mode the viewer is in.
    const { data: propRow } = await supabase.from("properties").select("is_demo").eq("id", propertyId).maybeSingle();
    const impactAtEntry = (() => {
      const postStay = isPostStayFeedback(workType?.name);
      const occupancy: Occupancy = stayData ? (stayData.occupancy_status === "vacant" ? "vacant" : "in_home") : "unknown";
      const guestAffected = understood.guestImpact !== "none";
      const relation: IssueRelation | null = postStay ? "prior" : occupancy === "in_home" && guestAffected ? "current" : null;
      const impact = suggestActiveStayImpact({
        occupancy,
        relation,
        postStay,
        guestAffectedNow: guestAffected,
        guestImpact: understood.guestImpact,
      });
      return { postStay, relation, impact, comm: suggestGuestComm(impact) };
    })();
    const guestInResidence = guestInHomeFrom(understood.occupancy);

    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        is_demo: demoMode || Boolean(propRow?.is_demo),
        record_type: "active_task",
        title,
        description: description.trim(),
        property_id: propertyId,
        work_type_id: workType?.id ?? null,
        // The stored Ops or Maintenance label, set from Repair needed at the home.
        entry_kind: entryKind,
        ...(activeCategory && liveChecklist.data
          ? ({ checklist_playbook_id: liveChecklist.data.id, checklist_category: activeCategory } as {})
          : {}),
        linked_feedback_id: context.feedback ?? null,
        departure_review_id: context.departureReview ?? null,
        maintenance_category: entryKind === "maintenance" ? understood.maintenanceCategory : null,
        insurance_risk: understood.insurance ? "unsure" : null,
        estimated_cost: null,
        functional_role_code: workType?.functional_role_code ?? null,
        cross_team: false,
        category: workType?.category ?? "other",
        bucket: workType?.bucket ?? null,
        guest_impact: understood.guestImpact,
        occupancy_status: understood.occupancy,
        suggested_priority: priority,
        priority,
        priority_override_reason: null,
        source_channel: "guest_message",
        source_reference: sourceReference,
        // Post-stay feedback belongs to a past stay — never stamp the current booking on it.
        ownerrez_booking_id: stayData && !impactAtEntry.postStay ? stayData.booking_id : null,
        active_stay_impact: impactAtEntry.impact,
        guest_comm_required: impactAtEntry.comm,
        issue_reservation_relation: impactAtEntry.relation,
        guest_name: stayData?.guest_name ?? null,
        guest_contact: null,
        guest_in_residence: guestInResidence,
        playbook_id: playbookId,
        reported_at: now.toISOString(),
        response_due_at,
        action_due_at,
        acknowledged_at: now.toISOString(),
        action_started_at: null,
        due_at: action_due_at,
        created_by: userId,
        record_owner: userId,
        accountable_owner: userId,
        // current_action_owner / assigned_to are set by the tickets_auto_assign
        // database trigger (routing by the time), never here.
        status: "open",
        outcome_type: null,
        resolution_notes: null,
        resolved_at: null,
      })
      .select("id, assigned_to")
      .single();
    if (error && error.code === "23505" && context.feedback) {
      // Linked work already exists for this feedback — open it, never duplicate.
      const { data: existing } = await supabase
        .from("tickets")
        .select("id")
        .eq("linked_feedback_id", context.feedback)
        .eq("entry_kind", entryKind)
        .is("archived_at", null)
        .maybeSingle();
      if (existing) {
        toast.info("Linked work already exists. Opening it.");
        onCreated(existing.id);
        return null;
      }
    }
    if (error) throw error;

    // Freeze OwnerRez stay context onto the ticket. Best effort.
    void captureTicketReservation({ data: { ticketId: ticket.id } }).catch(() => {});

    if (context.lead) {
      const { error: linkError } = await supabase
        .from("lead_tickets")
        .insert({ lead_id: context.lead, ticket_id: ticket.id, linked_by: userId });
      if (linkError) toast.error("Ticket saved, but linking it to the lead failed.");
    }
    if (context.from?.startsWith("routine:")) {
      const { error: routineLinkError } = await supabase
        .from("routine_controls")
        .update({ follow_up_ticket_id: ticket.id })
        .eq("id", context.from.slice("routine:".length));
      if (routineLinkError) toast.error("Ticket saved, but linking it to the routine failed.");
    }
    if (playbookId) {
      const { data: steps, error: stepsError } = await supabase
        .from("playbook_steps")
        .select("position, instruction, detail, required, photo_required")
        .eq("playbook_id", playbookId)
        .order("position");
      if (stepsError) throw stepsError;
      if (steps?.length) {
        const { error: insertError } = await supabase.from("ticket_steps").insert(steps.map((s) => ({ ...s, ticket_id: ticket.id })));
        if (insertError) throw insertError;
      }
    }
    if (userId) {
      await supabase.from("ticket_activity").insert({
        ticket_id: ticket.id,
        author_id: userId,
        kind: "created",
        event_type: "created",
        channel: "guest_message",
        body: `Ticket created from Record work. Problem: ${understood.problem}. Repair needed at the home: ${REPAIR_WORDS[understood.repair]}. How urgent: ${urgencyWords(priority)}. ${understood.reason}`,
      });
    }
    if (files.length) {
      try {
        await upload(ticket.id, files, undefined, { entityType: "ticket", note: "Photo from Record work" });
      } catch {
        toast.error("Ticket saved, but a photo did not upload. Add it on the ticket.");
      }
    }
    setCreatedTicketId(ticket.id);
    const repeat = await readRepeat();
    setSaved({
      kind: "ticket",
      ticketId: ticket.id,
      problem: understood.problem,
      home: homeLabel,
      who: ticket.assigned_to ? who : "A supervisor will sort it",
      repeat,
    });
    void qc.invalidateQueries({ queryKey: ["tickets"] });
    return ticket.id;
  }

  async function onCreate() {
    if (!ready || saving) return;
    setSaving("ticket");
    try {
      await createTicket();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this ticket.");
    } finally {
      setSaving(null);
    }
  }

  async function onEscalate() {
    if (!ready || saving) return;
    setSaving("escalate");
    try {
      const id = await createTicket();
      if (!id) return;
      const { error } = await (supabase as unknown as { rpc: (n: string, a: object) => Promise<{ error: any }> }).rpc(
        "record_work_escalate",
        { _ticket_id: id },
      );
      if (error) throw new Error(error.message);
      setEscalated(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not escalate this ticket.");
    } finally {
      setSaving(null);
    }
  }

  async function onOneTouch() {
    if (!ready || saving) return;
    const did = oneTouchOutcome(didWhat);
    if (!did) {
      toast.error(`${ONE_TOUCH_DID.label} ${ONE_TOUCH_DID.help}`);
      return;
    }
    setSaving("one_touch");
    try {
      let attachmentIds: string[] = [];
      if (files.length) attachmentIds = await upload(propertyId, files);
      const { data: u } = await supabase.auth.getUser();
      // A demo home's history stays demo even outside demo mode.
      const { data: prop } = await supabase.from("properties").select("is_demo").eq("id", propertyId).maybeSingle();
      const { error } = await (supabase as unknown as { from: (t: string) => any }).from("property_activity_log").insert({
        property_id: propertyId,
        occurred_at: new Date().toISOString(),
        category: activityCategoryFor(workType?.category),
        what_happened: description.trim(),
        outcome: did,
        involved: null,
        ...(u.user ? { logged_by: u.user.id } : {}),
        is_demo: demoMode || Boolean(prop?.is_demo),
        attachment_document_ids: attachmentIds,
        problem_type_id: workType?.id ?? null,
        one_touch: true,
      });
      if (error) throw new Error(error.message);
      void qc.invalidateQueries({ queryKey: ["property-activity", propertyId] });
      void qc.invalidateQueries({ queryKey: ["home-repeat-flags"] });
      const repeat = await readRepeat();
      setSaved({ kind: "one_touch", problem: understood.problem, home: homeLabel, repeat, did });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nothing was saved. Try again.");
    } finally {
      setSaving(null);
    }
  }

  function toggleSpeak() {
    if (!speechCtor) return;
    if (listening) {
      speechRef.current?.stop();
      return;
    }
    const rec = new speechCtor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (said) setDescription((d) => (d.trim() ? `${d.trim()} ${said}` : said));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    speechRef.current = rec;
    setListening(true);
    rec.start();
  }

  // The capability is enforced in the database too; this stops someone
  // reaching the form by typing the URL.
  if (!rolesLoading && (readOnly || !can("ticket_create"))) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <h1 className="text-2xl font-semibold">Recording work is not part of your access</h1>
        <p className="text-muted-foreground">Ask a supervisor if you need to open tickets in Resolve.</p>
      </div>
    );
  }

  const insuranceBox = understood.insurance && showUnderstood && !escalated && (
    <div role="alert" className="space-y-3 rounded-xl border-2 border-destructive bg-destructive/10 p-4">
      <p className="text-[15px] font-semibold text-destructive">
        This could be an insurance claim. Escalate this ticket before taking action.
      </p>
      <Button
        type="button"
        variant="destructive"
        className="min-h-11 px-5"
        disabled={!ready || saving !== null}
        onClick={() => void onEscalate()}
      >
        {saving === "escalate" ? "Escalating" : "Escalate now"}
      </Button>
    </div>
  );
  const escalatedBox = escalated && (
    <div role="status" className="rounded-xl border-2 border-warning bg-warning/15 p-4 text-sm">
      <strong>Escalated.</strong> A supervisor has been told. Wait for their answer before you act.
    </div>
  );

  return (
    <div className="mx-auto max-w-[600px] space-y-5">
      {!inPanel && <BackControl origin={resolveOrigin(context.origin, "ticket")} />}
      <h1 className="text-3xl font-semibold">Record work</h1>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <span className="min-w-0 flex-1">
          Not sure how to handle it? Describe it to the Coach and it will set the priority, build the checklist and write the
          vendor brief.
        </span>
        <Button asChild variant="outline" className="min-h-11 border-primary font-semibold text-primary">
          <Link
            to="/coach"
            search={{ q: description.trim() || undefined, propertyId: propertyId || undefined }}
            data-testid="ask-the-coach"
          >
            Ask the Coach
          </Link>
        </Button>
      </div>

      {saved ? (
        <div className="space-y-4">
          {insuranceBox}
          {escalatedBox}
          <div role="status" className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm">
            <p className="text-lg font-semibold">{saved.kind === "ticket" ? "Ticket created." : "Saved to home history."}</p>
            <p>
              {saved.problem === NOT_SURE_PROBLEM ? "Problem not clear yet" : saved.problem} at {saved.home}.
            </p>
            {saved.kind === "ticket" && <p>Sent to: {saved.who}.</p>}
            {saved.kind === "one_touch" && saved.did && <p data-testid="one-touch-did">What you did: {saved.did}</p>}
            {saved.repeat && (
              <p className={saved.repeat.flagged ? "font-bold text-warning-ink" : undefined} data-repeat={saved.repeat.flagged ? "flagged" : "count"}>
                {saved.repeat.line}
              </p>
            )}
          </div>
          {saved.kind === "ticket" && saved.ticketId && (
            <Button type="button" className="min-h-[52px] w-full text-base font-semibold" onClick={() => onCreated(saved.ticketId!)}>
              Open ticket
            </Button>
          )}
          <Button type="button" variant="outline" className="min-h-[52px] w-full border-primary text-[15px] font-semibold text-primary" onClick={resetForAnother}>
            Record another at this home
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Which home?</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="h-11 text-[15px]" aria-label="Which home?">
                <SelectValue placeholder="Select a home" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    className="h-11"
                    placeholder="Find a home"
                    value={propertyQuery}
                    onChange={(e) => setPropertyQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                {(properties ?? [])
                  .filter((p) => matchesPropertySearch(p, propertyQuery))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id} className="min-h-11">
                      {formatPropertyLabel(p).primary}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rw-description" className="text-sm font-semibold">
              Describe the problem or request.
            </Label>
            <Textarea
              id="rw-description"
              rows={3}
              className="min-h-24 text-[15px]"
              placeholder="The refrigerator is not cold."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" aria-hidden="true" /> Add photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={!speechCtor}
                aria-pressed={listening}
                onClick={toggleSpeak}
              >
                <Mic className="size-4" aria-hidden="true" /> {listening ? "Stop" : "Speak"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Add photo"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setFiles((f) => [...f, ...picked]);
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">Short sentences are fine. Example: The refrigerator is not cold.</p>
          </div>

          {showUnderstood && (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4" data-testid="resolve-understood">
              <strong className="text-sm">Resolve understood</strong>
              <dl className="grid grid-cols-1 gap-x-3 gap-y-2 text-sm sm:grid-cols-[220px_1fr]">
                <dt className="text-muted-foreground">Problem</dt>
                <dd className="font-semibold">{understood.problem}</dd>
                <dt className="text-muted-foreground">Repair needed at the home</dt>
                <dd className="font-semibold">{REPAIR_WORDS[understood.repair]}</dd>
                <dt className="text-muted-foreground">How urgent</dt>
                <dd className="font-semibold">{urgencyWords(priority)}</dd>
                <dt className="text-muted-foreground">Who will do it</dt>
                <dd className="font-semibold">{who}</dd>
              </dl>
              <p className="text-sm text-muted-foreground">{understood.reason}</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 border-primary font-semibold text-primary"
                aria-expanded={pickingProblem}
                onClick={() => setPickingProblem((v) => !v)}
              >
                Change the problem
              </Button>
              {pickingProblem && (
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Problem types">
                  {problemTypes.map((w) => (
                    <Button
                      key={w.id}
                      type="button"
                      role="radio"
                      aria-checked={workType?.id === w.id}
                      variant={workType?.id === w.id ? "default" : "outline"}
                      className="h-auto min-h-11 justify-start whitespace-normal text-left"
                      onClick={() => {
                        setChosenWorkTypeId(w.id);
                        setPickingProblem(false);
                      }}
                    >
                      {w.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {insuranceBox}
          {escalatedBox}

          <div className="space-y-2">
            <Label htmlFor="rw-did" className="text-sm font-semibold">
              {ONE_TOUCH_DID.label}
            </Label>
            <Input
              id="rw-did"
              className="h-11 text-[15px]"
              maxLength={ONE_TOUCH_DID.max}
              placeholder={ONE_TOUCH_DID.placeholder}
              value={didWhat}
              onChange={(e) => setDidWhat(e.target.value)}
              aria-describedby="rw-did-help"
            />
            <p id="rw-did-help" className="text-sm text-muted-foreground">{ONE_TOUCH_DID.help}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className="min-h-[52px] w-full text-base font-semibold"
              disabled={!ready || saving !== null}
              onClick={() => void onCreate()}
            >
              {saving === "ticket" ? "Saving" : "Create ticket"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-[52px] w-full whitespace-normal border-primary text-[15px] font-semibold text-primary"
              disabled={!ready || saving !== null || !oneTouchOutcome(didWhat)}
              onClick={() => void onOneTouch()}
            >
              {saving === "one_touch" ? "Saving" : "One touch: nothing more to do. Save to home history."}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
