import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import {
  isPostStayFeedback,
  suggestActiveStayImpact,
  suggestGuestComm,
  type IssueRelation,
  type Occupancy,
} from "@/lib/guest-impact";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { captureTicketReservation, getPropertyStay } from "@/lib/ownerrez.functions";
import { PropertyContactPanel } from "@/components/PropertyContactPanel";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, History, Users, Wrench } from "lucide-react";
import { PropertyActivityForm } from "@/components/work-entry/PropertyActivityForm";
import {
  ENTRY_KINDS,
  INSURANCE_RISK,
  MAINTENANCE_CATEGORIES,
  defaultMaintenanceWorkTypeName,
  insuranceFlagged,
  labelOf,
  workTypeFitsKind,
  type EntryKind,
} from "@/lib/work-entry";
import { supabase } from "@/integrations/supabase/client";
import { usTime } from "@/lib/dates";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GUEST_IMPACT,
  OCCUPANCY_STATUS,
  PRIORITIES,
  SOURCE_CHANNELS,
  labelFor,
  mechanicalPriority,
  priorityMeta,
  priorityTone,
  slaDueDates,
} from "@/lib/tickets";
import {
  SITUATIONS,
  SITUATION_GROUPS,
  priorityReason,
  resolveWorkType,
  situationById,
} from "@/lib/situations";
import { classifyTicketText } from "@/lib/ticket-classify";
import { BackControl } from "@/components/nav/NavContext";
import { resolveOrigin } from "@/lib/nav-context";

/**
 * Context handed in by whichever surface launched this form. It only
 * pre-populates fields and records where the ticket came from — every
 * classification choice stays with the person logging the work.
 */
type NewTicketSearch = {
  property?: string;
  lead?: string;
  project?: string;
  from?: string;
  /** Navigation-context token for the workspace this was launched from. */
  origin?: string;
  /** Preselects one of the three entry paths. */
  kind?: EntryKind;
  /** Guest feedback record this new work follows up on (kept separate from it). */
  feedback?: string;
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
    const kind = str(search["kind"]);
    if (kind === "activity" || kind === "ops" || kind === "maintenance") out.kind = kind;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Record work — Resolve Operations" },
      {
        name: "description",
        content:
          "Log property activity, open an Ops Ticket or report maintenance — each with the right workflow attached.",
      },
      { property: "og:title", content: "Record work — Resolve Operations" },
      {
        property: "og:description",
        content: "Log a one-touch resolution or open a ticket with its response standard attached.",
      },
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
      onActivityLogged={(pid) =>
        router.navigate({ to: "/property/$propertyId", params: { propertyId: pid } })
      }
    />
  );
}

type Mode = EntryKind | null;

export type { NewTicketSearch };

/**
 * The one Report an issue form. The full page and the shell side panel both
 * render it; only what happens after the record is created differs.
 */
export function NewTicketForm({
  context,
  onCreated,
  inPanel = false,
  onActivityLogged,
}: {
  context: NewTicketSearch;
  onCreated: (ticketId: string) => void;
  /** Rendered in the shell side panel: the panel's Close is the way back. */
  inPanel?: boolean;
  /** After a Property Activity entry is saved (no Ticket exists). */
  onActivityLogged?: (propertyId: string) => void;
}) {
  const { can, readOnly, isSupervisor, isLoading: rolesLoading } = useRole();
  // In the demo environment a new ticket is a demo ticket: it lands in the
  // demo queues, never in the real counts, and reaches no guest or vendor.
  const { demoMode } = useDemo();
  const [mode, setModeRaw] = useState<Mode>(context.kind ?? null);
  const isTicket = mode === "ops" || mode === "maintenance";
  const [saving, setSaving] = useState(false);
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  // Everything Resolve can decide for itself stays folded away until asked for.
  const [advanced, setAdvanced] = useState(false);
  const [situationTouched, setSituationTouched] = useState(false);
  const [propertyQuery, setPropertyQuery] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    property_id: context.property ?? "",
    situation_id: "",
    work_type_id: "",

    guest_impact: "none",
    occupancy_status: "vacant",
    priority: "p3",
    priority_override_reason: "",
    functional_role_code: "",
    cross_team: false,
    source_channel: "guest_message",
    guest_name: "",
    guest_contact: "",
    guest_in_residence: false,
    playbook_id: "auto",
    // maintenance only
    maintenance_category: "",
    insurance_risk: "",
    estimated_cost: "",
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", demoMode, context.property ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname")
        .eq("active", true)
        .or(`is_demo.eq.${demoMode}${context.property ? `,id.eq.${context.property}` : ""}`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // OwnerRez tells us who is actually in the home right now.
  const fetchStay = useServerFn(getPropertyStay);
  const { data: stay, isFetching: stayLoading } = useQuery({
    queryKey: ["ownerrez-stay", form.property_id],
    queryFn: () => fetchStay({ data: { propertyId: form.property_id } }),
    enabled: Boolean(form.property_id),
    retry: false,
  });

  // A lead only carries context: name for the banner, and the property it is
  // already linked to so the form can start there when nothing else says otherwise.
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
    if (!linked) return;
    setForm((f) => (f.property_id ? f : { ...f, property_id: linked }));
  }, [leadContext]);

  const { data: workTypes } = useQuery({
    queryKey: ["work-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_types")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["functional-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("functional_roles")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: playbooks } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("id, title, category")
        .eq("active", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Changing path drops a work type that belongs to the other path.
  function setMode(next: Mode) {
    setModeRaw(next);
    setForm((f) => {
      const wt = workTypes?.find((w) => w.id === f.work_type_id);
      const keep = wt && (next === "ops" || next === "maintenance") && workTypeFitsKind(wt.category, next);
      return keep ? f : { ...f, work_type_id: "", situation_id: "" };
    });
  }

  const kindWorkTypes = useMemo(
    () =>
      (workTypes ?? []).filter((w) =>
        mode === "ops" || mode === "maintenance" ? workTypeFitsKind(w.category, mode) : true,
      ),
    [workTypes, mode],
  );

  // Maintenance never stops on "pick a work type": with nothing recognised it
  // falls back to the catalog's immediate/ongoing maintenance entry.
  const effectiveWorkTypeId = useMemo(() => {
    if (form.work_type_id) return form.work_type_id;
    if (mode !== "maintenance") return "";
    const affected = form.guest_in_residence || form.guest_impact === "active_guest_affected" || form.guest_impact === "safety_security";
    const name = defaultMaintenanceWorkTypeName(affected);
    return kindWorkTypes.find((w) => w.name === name)?.id ?? kindWorkTypes[0]?.id ?? "";
  }, [form.work_type_id, form.guest_in_residence, form.guest_impact, mode, kindWorkTypes]);

  const workType = useMemo(
    () => workTypes?.find((w) => w.id === effectiveWorkTypeId) ?? null,
    [workTypes, effectiveWorkTypeId],
  );

  /**
   * Situation → work type. Presentation only: it fills the same work_type_id
   * the select always filled, plus sensible starting answers for the two
   * contextual questions. The rubric still decides priority.
   */
  function pickSituation(id: string) {
    setSituationTouched(true);
    const situation = situationById(id);
    const resolved = resolveWorkType(situation, workTypes);
    setShowCatalog(Boolean(situation?.openCatalog) || (Boolean(situation) && !resolved));
    setForm((f) => ({
      ...f,
      situation_id: id,
      work_type_id: resolved?.id ?? "",
      guest_impact: situation?.guestImpact ?? f.guest_impact,
      occupancy_status: situation?.occupancy ?? f.occupancy_status,
    }));
  }

  /**
   * "Looks like…" — deterministic reading of what the coordinator typed.
   * It only preselects the same situation they could have picked by hand,
   * and it stops as soon as they choose one themselves.
   */
  const guess = useMemo(
    () => (situationTouched ? null : classifyTicketText(form.description)),
    [form.description, situationTouched],
  );

  useEffect(() => {
    if (!guess || situationTouched || !isTicket) return;
    const resolved = resolveWorkType(guess.situation, workTypes);
    if (!resolved || !workTypeFitsKind(resolved.category, mode)) return;
    setForm((f) =>
      f.situation_id === guess.situation.id
        ? f
        : {
            ...f,
            situation_id: guess.situation.id,
            work_type_id: resolved?.id ?? f.work_type_id,
            guest_impact: guess.situation.guestImpact ?? f.guest_impact,
          },
    );
  }, [guess, situationTouched, workTypes, isTicket, mode]);

  const role = useMemo(
    () => roles?.find((r) => r.code === form.functional_role_code) ?? null,
    [roles, form.functional_role_code],
  );

  // Mechanical priority model: work type suggests, guest impact and occupancy decide.
  const situation = useMemo(() => situationById(form.situation_id), [form.situation_id]);

  const mechanical = useMemo(
    () =>
      mechanicalPriority(
        workType?.default_priority,
        form.guest_impact,
        form.occupancy_status,
        situation?.priorityCeiling ?? null,
      ),
    [workType, form.guest_impact, form.occupancy_status, situation],
  );

  useEffect(() => {
    if (!priorityTouched) setForm((f) => ({ ...f, priority: mechanical }));
  }, [mechanical, priorityTouched]);

  // Prefill occupancy and guest from the live reservation instead of guessing.
  // Guards against an out-of-order response: react-query's queryKey already
  // scopes the cache by property_id, but this also refuses to apply a
  // payload that doesn't say it's for the property currently selected —
  // belt-and-suspenders against a stale fetch resolving after a newer one.
  useEffect(() => {
    if (!stay?.ok || stay.propertyId !== form.property_id) return;
    const s = stay.data;
    setForm((f) => ({
      ...f,
      occupancy_status: s.occupancy_status,
      guest_name: s.guest_name ?? f.guest_name,
      guest_in_residence: s.occupancy_status !== "vacant" ? true : f.guest_in_residence,
    }));
  }, [stay, form.property_id]);

  // The work type also carries its owning seat from the ownership matrix.
  useEffect(() => {
    if (workType?.functional_role_code) {
      setForm((f) => ({ ...f, functional_role_code: workType.functional_role_code as string }));
    }
  }, [workType]);

  const overridden = Boolean(workType && form.priority !== mechanical);
  const meta = priorityMeta(form.priority);

  const resolvedPlaybookId = useMemo(() => {
    if (form.playbook_id !== "auto") return form.playbook_id === "none" ? null : form.playbook_id;
    return workType?.playbook_id ?? null;
  }, [form.playbook_id, workType]);

  // The first line of what happened is the summary — nobody types it twice.
  const derivedTitle = (form.title.trim() || form.description.trim().split("\n")[0] || "").slice(
    0,
    140,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!derivedTitle) {
      toast.error("Tell us what happened first.");
      return;
    }
    if (!isTicket) return;
    if (!effectiveWorkTypeId) {
      toast.error("Pick what kind of Ops work this is.");
      return;
    }
    if (mode === "maintenance" && !form.maintenance_category) {
      toast.error("Pick the maintenance category.");
      return;
    }
    if (mode === "maintenance" && !form.insurance_risk) {
      toast.error("Answer whether this could be an insurance-related event (Yes / No / Unsure).");
      return;
    }
    if (overridden && !form.priority_override_reason.trim()) {
      toast.error(`The rubric says ${mechanical.toUpperCase()}. Document why you changed it.`);
      return;
    }

    setSaving(true);
    try {
      // Provenance only — where the person was standing when they logged it.
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
      const { response_due_at, action_due_at } = slaDueDates(form.priority, now, workType);
      const oneTouch = false;
      const estimated = form.estimated_cost.trim() ? Number(form.estimated_cost) : null;

      // A demo home only ever carries demo Tickets, whatever mode the viewer is in.
      const { data: propRow } = form.property_id
        ? await supabase.from("properties").select("is_demo").eq("id", form.property_id).maybeSingle()
        : { data: null };
      const impactAtEntry = (() => {
        const postStay = isPostStayFeedback(workType?.name);
        const occupancy: Occupancy =
          stay?.ok && stay.propertyId === form.property_id
            ? stay.data.occupancy_status === "vacant"
              ? "vacant"
              : "in_home"
            : "unknown";
        const relation: IssueRelation | null = postStay
          ? "prior"
          : occupancy === "in_home" && form.guest_in_residence
            ? "current"
            : null;
        const impact = suggestActiveStayImpact({
          occupancy,
          relation,
          postStay,
          guestAffectedNow: form.guest_in_residence,
          guestImpact: form.guest_impact,
        });
        return { postStay, relation, impact, comm: suggestGuestComm(impact) };
      })();
      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          is_demo: demoMode || Boolean(propRow?.is_demo),
          record_type: oneTouch
            ? "completed_interaction"
            : form.cross_team
              ? "collaborative_matter"
              : "active_task",
          title: derivedTitle,
          description: form.description || null,
          property_id: form.property_id || null,
          work_type_id: effectiveWorkTypeId,
          entry_kind: mode,
          linked_feedback_id: context.feedback ?? null,
          maintenance_category: mode === "maintenance" ? form.maintenance_category : null,
          insurance_risk: mode === "maintenance" ? form.insurance_risk : null,
          estimated_cost: mode === "maintenance" && estimated !== null && Number.isFinite(estimated) ? estimated : null,
          functional_role_code: form.functional_role_code || null,
          cross_team: oneTouch ? false : form.cross_team,
          category: workType?.category ?? "other",
          bucket: workType?.bucket ?? null,
          guest_impact: form.guest_impact,
          occupancy_status: form.occupancy_status,
          suggested_priority: mechanical,
          priority: form.priority,
          priority_override_reason: overridden ? form.priority_override_reason.trim() : null,
          source_channel: form.source_channel,
          source_reference: sourceReference,
          // Post-stay feedback belongs to a past stay — never stamp the current booking on it.
          ownerrez_booking_id: stay?.ok && !impactAtEntry.postStay ? stay.data.booking_id : null,
          active_stay_impact: impactAtEntry.impact,
          guest_comm_required: impactAtEntry.comm,
          issue_reservation_relation: impactAtEntry.relation,
          guest_name: form.guest_name || null,
          guest_contact: form.guest_contact || null,
          guest_in_residence: form.guest_in_residence,
          playbook_id: oneTouch ? null : resolvedPlaybookId,
          reported_at: now.toISOString(),
          response_due_at: oneTouch ? null : response_due_at,
          action_due_at: oneTouch ? null : action_due_at,
          acknowledged_at: now.toISOString(),
          action_started_at: oneTouch ? now.toISOString() : null,
          due_at: oneTouch ? null : action_due_at,
          created_by: userId,
          record_owner: userId,
          accountable_owner: userId,
          // current_action_owner / assigned_to are no longer set here — the
          // tickets_auto_assign database trigger resolves the owning role
          // (functional_role_code) to its current seat holder server-side,
          // or leaves the ticket unassigned with a reason if none is
          // eligible.
          // Every ticket is created "open", one-touch included — the
          // resolved/closed transition below runs through the same
          // validateTicketTransition gate every other ticket uses, so
          // evidence and Final Review rules apply here too instead of being
          // bypassed by inserting straight into a terminal status.
          status: "open",
          outcome_type: null,
          resolution_notes: null,
          resolved_at: null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Freeze OwnerRez stay context onto the ticket. Best effort: OwnerRez
      // stays authoritative and a failure here must not fail ticket creation.
      void captureTicketReservation({ data: { ticketId: ticket.id } }).catch(() => {});

      if (context.lead) {
        const { error: linkError } = await supabase.from("lead_tickets").insert({
          lead_id: context.lead,
          ticket_id: ticket.id,
          linked_by: userId,
        });
        if (linkError) toast.error("Ticket saved, but linking it to the lead failed.");
      }

      if (context.from?.startsWith("routine:")) {
        const routineId = context.from.slice("routine:".length);
        const { error: routineLinkError } = await supabase
          .from("routine_controls")
          .update({ follow_up_ticket_id: ticket.id })
          .eq("id", routineId);
        if (routineLinkError) toast.error("Ticket saved, but linking it to the routine failed.");
      }

      if (!oneTouch && resolvedPlaybookId) {
        const { data: steps, error: stepsError } = await supabase
          .from("playbook_steps")
          .select("position, instruction, detail, required, photo_required")
          .eq("playbook_id", resolvedPlaybookId)
          .order("position");
        if (stepsError) throw stepsError;
        if (steps?.length) {
          const { error: insertError } = await supabase
            .from("ticket_steps")
            .insert(steps.map((s) => ({ ...s, ticket_id: ticket.id })));
          if (insertError) throw insertError;
        }
      }

      if (userId) {
        await supabase.from("ticket_activity").insert({
          ticket_id: ticket.id,
          author_id: userId,
          kind: "created",
          event_type: "created",
          channel: form.source_channel,
          body: `${mode === "maintenance" ? "Maintenance reported" : "Ops Ticket opened"}${
            mode === "maintenance" ? ` (${labelOf(MAINTENANCE_CATEGORIES, form.maintenance_category)}${estimated !== null ? ` · est. $${estimated}` : ""})` : ""
          }. Ticket opened at ${meta.short} (${labelFor(GUEST_IMPACT, form.guest_impact)} · ${labelFor(
                OCCUPANCY_STATUS,
                form.occupancy_status,
              )}). Acknowledge within ${workType?.response_minutes ?? meta.responseMinutes}m.`,
        });
      }

      toast.success(mode === "maintenance" ? "Maintenance reported with its clocks running." : "Ticket opened with its clocks running.");
      onCreated(ticket.id);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Could not save this record",
      );
    } finally {
      setSaving(false);
    }
  }

  const propertyPicker = (
            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={form.property_id}
                onValueChange={(v) => setForm({ ...form, property_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search properties"
                      value={propertyQuery}
                      onChange={(e) => setPropertyQuery(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {(properties ?? [])
                    .filter((p) =>
                      `${p.nickname ?? ""} ${p.name}`
                        .toLowerCase()
                        .includes(propertyQuery.toLowerCase()),
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nickname ?? p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {properties?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  <Link to="/properties" className="text-primary hover:underline">
                    Add your first property
                  </Link>
                </p>
              )}
              {form.property_id && (
                <p className="text-xs text-muted-foreground">
                  {stayLoading
                    ? "Checking OwnerRez for the current reservation…"
                    : stay?.ok
                      ? stay.data.occupancy_status === "vacant"
                        ? `No one in the home${stay.data.next_arrival ? ` · next arrival ${stay.data.next_arrival.slice(0, 10)}` : ""}`
                        : `${stay.data.guest_name ?? "Guest"} in the home · ${stay.data.arrival?.slice(0, 10)} \u2192 ${stay.data.departure?.slice(0, 10)}`
                      : (stay?.error ?? "")}
                </p>
              )}
            </div>
  );

  // The capability is enforced in the database too; this stops someone
  // reaching the form by typing the URL.
  if (!rolesLoading && (readOnly || !can("ticket_create"))) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <h1 className="text-2xl font-semibold">Logging work is not part of your access</h1>
        <p className="text-muted-foreground">
          Ask a supervisor if you need to open tickets in Resolve.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Logging work is a detour, never a destination — the way back is named. */}
      {!inPanel && <BackControl origin={resolveOrigin(context.origin, "ticket")} />}
      <div>
        <h1 className="text-3xl font-semibold">Record work</h1>
        <p className="mt-1 text-muted-foreground">
          Choose what you are recording: something already handled, Ops work that needs an owner,
          or a repair at the home.
        </p>
      </div>

      {(leadContext || context.property || context.project || context.from) && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-medium">Started from </span>
          {leadContext
            ? `the lead ${leadContext.contact_name}`
            : context.from === "onboarding"
              ? "an onboarding workspace"
              : context.from === "property_hub"
                ? "a property hub"
                : "another Resolve workspace"}
          . We have filled in what we know — change anything that is not right.
        </div>
      )}

      <Link
        to="/coach"
        className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm transition hover:bg-primary/10"
      >
        <span>
          <span className="font-medium">Not sure how to handle it? </span>
          Describe it to the Coach and it will set the priority, build the checklist and write the
          vendor brief.
        </span>
        <span className="ml-3 whitespace-nowrap font-medium text-primary">Ask the Coach →</span>
      </Link>

      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="What are you recording?">
        {ENTRY_KINDS.map((k) => (
          <ModeCard
            key={k.value}
            active={mode === k.value}
            onClick={() => setMode(k.value)}
            icon={k.value === "activity" ? <History className="size-4" /> : k.value === "ops" ? <Clock className="size-4" /> : <Wrench className="size-4" />}
            title={k.title}
            hint={k.hint}
          />
        ))}
      </div>

      {mode === null && (
        <p className="text-sm text-muted-foreground">Choose one to continue.</p>
      )}

      {mode === "activity" && (
        <Card>
          <CardHeader>
            <CardTitle>Log Property Activity</CardTitle>
            <CardDescription>Something already handled that belongs in the property's history.</CardDescription>
          </CardHeader>
          <CardContent>
            <PropertyActivityForm
              propertyId={form.property_id}
              propertyPicker={propertyPicker}
              isDemo={demoMode}
              onLogged={(pid) => (onActivityLogged ? onActivityLogged(pid) : undefined)}
            />
          </CardContent>
        </Card>
      )}

      {isTicket && (
      <Card>
        <CardHeader>
          <CardTitle>{mode === "maintenance" ? "What is wrong?" : "What happened?"}</CardTitle>
          <CardDescription>Write it the way it was reported to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            {/* One question. Resolve works out the classification. */}
            <div className="space-y-2">
              <Label htmlFor="description">What happened?</Label>
              <Textarea
                id="description"
                rows={3}
                required
                placeholder="Fridge is not cooling, guest reported it"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Plain words are fine. Resolve sets the work type, the priority and who owns it.
              </p>
            </div>

            {propertyPicker}

            {form.property_id && <PropertyContactPanel propertyId={form.property_id} showOwner={false} />}

            {mode === "ops" && (
              <div className="space-y-2">
                <Label>Kind of Ops work</Label>
                <Select
                  value={form.work_type_id}
                  onValueChange={(v) => {
                    setSituationTouched(true);
                    setForm({ ...form, work_type_id: v });
                  }}
                >
                  <SelectTrigger aria-label="Kind of Ops work">
                    <SelectValue placeholder="Pick the closest match" />
                  </SelectTrigger>
                  <SelectContent>
                    {kindWorkTypes.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Resolve suggests one from your description; you can always change it.
                </p>
              </div>
            )}

            {mode === "maintenance" && (
              <div className="space-y-4 rounded-lg border border-border p-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Maintenance category</Label>
                    <Select
                      value={form.maintenance_category}
                      onValueChange={(v) => setForm({ ...form, maintenance_category: v })}
                    >
                      <SelectTrigger aria-label="Maintenance category">
                        <SelectValue placeholder="Pick a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="est-cost">Estimated cost, if known ($)</Label>
                    <Input
                      id="est-cost"
                      type="number"
                      min="0"
                      step="1"
                      value={form.estimated_cost}
                      onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Guest impact</Label>
                  <Select
                    value={form.guest_impact}
                    onValueChange={(v) => setForm({ ...form, guest_impact: v })}
                  >
                    <SelectTrigger aria-label="Guest impact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GUEST_IMPACT.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="guest-affected">A guest is currently affected</Label>
                  <Switch
                    id="guest-affected"
                    checked={form.guest_in_residence}
                    onCheckedChange={(v) => setForm({ ...form, guest_in_residence: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Potential insurance-related event?</Label>
                  <div className="flex gap-2" role="radiogroup" aria-label="Potential insurance-related event">
                    {INSURANCE_RISK.map((r) => (
                      <Button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={form.insurance_risk === r.value}
                        variant={form.insurance_risk === r.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setForm({ ...form, insurance_risk: r.value })}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flooding, major leak, roof, fire/smoke, structural damage.
                    {insuranceFlagged(form.insurance_risk)
                      ? " This will be flagged for supervisors and show owner contact. Nothing is sent to insurance."
                      : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add photos on the Ticket's Evidence tab once it opens.
                </p>
              </div>
            )}


            {workType && isTicket && (
              <div className="resolve-rise rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Looks like
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={priorityTone(form.priority)}>
                    {meta.short}
                  </Badge>
                  <span className="font-medium">{situation?.label ?? workType.name}</span>
                  <span className="text-muted-foreground">· {workType.name}</span>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {meta.short} because{" "}
                  {priorityReason(
                    form.guest_impact,
                    form.occupancy_status,
                    workType.default_priority,
                  )}
                  .{role ? ` Owned by ${role.name}.` : ""}
                </p>
                {!advanced && (
                  <button
                    type="button"
                    onClick={() => setAdvanced(true)}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Not right? Change
                  </button>
                )}
              </div>
            )}

            {!workType && (
              <button
                type="button"
                onClick={() => setAdvanced(true)}
                className="text-xs text-primary hover:underline"
              >
                Choose what happened
              </button>
            )}

            {advanced && (
              <div className="space-y-5 rounded-lg border border-border p-3">
                <div className="space-y-2">
                  <Label htmlFor="title">Summary</Label>
                  <Input
                    id="title"
                    placeholder={derivedTitle || "Leak under the kitchen sink"}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>How did it come in?</Label>
                  <Select
                    value={form.source_channel}
                    onValueChange={(v) => setForm({ ...form, source_channel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>What is happening?</Label>
                    <p className="text-xs text-muted-foreground">
                      Pick the situation. Resolve sets the work type, the owning seat and the
                      clocks.
                    </p>
                  </div>
                  {SITUATION_GROUPS.map((g) => (
                    <div key={g.key} className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {SITUATIONS.filter((s) => s.group === g.key).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickSituation(s.id)}
                            className={`resolve-press rounded-lg border p-3 text-left transition ${
                              form.situation_id === s.id
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/40 hover:bg-secondary"
                            }`}
                          >
                            <span className="block text-sm font-medium">{s.label}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {s.hint}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Work type</Label>
                  <Select
                    value={form.work_type_id}
                    onValueChange={(v) => {
                      setSituationTouched(true);
                      setShowCatalog(true);
                      setForm({ ...form, work_type_id: v });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick the closest match" />
                    </SelectTrigger>
                    <SelectContent>
                      {(workTypes ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} · suggests {w.default_priority.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {workType && isTicket && (
              <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                <p className="font-medium">Operating standard</p>
                {advanced && (
                  <p className="mt-1 text-muted-foreground">{workType.operating_standard}</p>
                )}
                <p className="mt-1 text-muted-foreground">
                  Acknowledge within {workType.response_minutes}m · start within{" "}
                  {workType.action_start_minutes === 0
                    ? "immediately"
                    : `${workType.action_start_minutes}m`}
                  {workType.completion_target
                    ? ` · target ${workType.completion_target.toLowerCase()}`
                    : ""}
                </p>
                {workType.required_closure_evidence && (
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-medium text-foreground">To close:</span>{" "}
                    {workType.required_closure_evidence}
                  </p>
                )}
              </div>
            )}

            {advanced && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Guest impact</Label>
                    <Select
                      value={form.guest_impact}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          guest_impact: v,
                          guest_in_residence:
                            v === "active_guest_affected" || v === "safety_security"
                              ? true
                              : form.guest_in_residence,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GUEST_IMPACT.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Occupancy status</Label>
                    <Select
                      value={form.occupancy_status}
                      onValueChange={(v) => setForm({ ...form, occupancy_status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OCCUPANCY_STATUS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.property_id && (
                      <p className="text-xs text-muted-foreground">
                        {stayLoading
                          ? "Checking OwnerRez for the current reservation…"
                          : stay?.ok
                            ? stay.data.occupancy_status === "vacant"
                              ? `OwnerRez: vacant${stay.data.next_arrival ? ` · next arrival ${stay.data.next_arrival.slice(0, 10)}` : ""}`
                              : `OwnerRez: ${stay.data.guest_name ?? "guest"} · ${stay.data.arrival?.slice(0, 10)} → ${stay.data.departure?.slice(0, 10)}`
                            : (stay?.error ?? "")}
                      </p>
                    )}
                  </div>
                </div>

                {isTicket && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={form.priority}
                        disabled={!isSupervisor}
                        onValueChange={(v) => {
                          setPriorityTouched(true);
                          setForm({ ...form, priority: v });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Rubric says <span className="font-medium">{mechanical.toUpperCase()}</span>{" "}
                        · {meta.summary}
                        {!isSupervisor && " Only a supervisor can change it."}
                      </p>

                    </div>

                    <div className="space-y-2">
                      <Label>Playbook</Label>
                      <Select
                        value={form.playbook_id}
                        onValueChange={(v) => setForm({ ...form, playbook_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Use the work type&apos;s playbook</SelectItem>
                          <SelectItem value="none">No playbook</SelectItem>
                          {(playbooks ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {isTicket && (
                  <div className="space-y-2">
                    <Label>Owning functional role</Label>
                    <Select
                      value={form.functional_role_code}
                      onValueChange={(v) => setForm({ ...form, functional_role_code: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Which seat owns this process?" />
                      </SelectTrigger>
                      <SelectContent>
                        {(roles ?? []).map((r) => (
                          <SelectItem key={r.code} value={r.code}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {role && (
                      <p className="text-xs text-muted-foreground">
                        {role.current_seat_holder
                          ? `Currently held by ${role.current_seat_name ?? "an unassigned seat"}`
                          : role.current_seat_name
                            ? `${role.current_seat_name} — invitation pending, so this seat is not yet routable`
                            : "This seat is unassigned"}{" "}
                        · {role.coverage_window}
                      </p>
                    )}
                  </div>
                )}

                {isTicket && overridden && (
                  <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <Label htmlFor="override">
                      Why {form.priority.toUpperCase()} instead of {mechanical.toUpperCase()}?
                    </Label>
                    <Input
                      id="override"
                      placeholder="Guest is elderly and alone in the home"
                      value={form.priority_override_reason}
                      onChange={(e) =>
                        setForm({ ...form, priority_override_reason: e.target.value })
                      }
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="guest_name">Guest name</Label>
                    <Input
                      id="guest_name"
                      value={form.guest_name}
                      onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest_contact">Guest contact</Label>
                    <Input
                      id="guest_contact"
                      placeholder="Phone, email or platform thread"
                      value={form.guest_contact}
                      onChange={(e) => setForm({ ...form, guest_contact: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Guest currently in the home</p>
                    <p className="text-xs text-muted-foreground">
                      Drives required guest communication before closure.
                    </p>
                  </div>
                  <Switch
                    checked={form.guest_in_residence}
                    onCheckedChange={(v) => setForm({ ...form, guest_in_residence: v })}
                  />
                </div>

                {isTicket && (
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Users className="size-4" /> Cross-team
                      </p>
                      <p className="text-xs text-muted-foreground">
                        More than one role, department or vendor has to act on this.
                      </p>
                    </div>
                    <Switch
                      checked={form.cross_team}
                      onCheckedChange={(v) => setForm({ ...form, cross_team: v })}
                    />
                  </div>
                )}
              </>
            )}

            {isTicket && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <Badge variant="outline" className={priorityTone(form.priority)}>
                  {meta.short}
                </Badge>
                <span className="text-muted-foreground">
                  Acknowledge by{" "}
                  {usTime(
                    Date.now() + (workType?.response_minutes ?? meta.responseMinutes) * 60_000,
                  )}
                  {" · "}
                  {labelFor(SOURCE_CHANNELS, form.source_channel)}
                </span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : mode === "maintenance" ? "Report maintenance" : "Open Ops Ticket"}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </button>
  );
}
