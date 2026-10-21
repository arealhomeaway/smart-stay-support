import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Camera, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { VisitCheckInCard } from "@/components/VisitCheckInCard";
import { Chip, EmptyState, LoadingRows, SectionBand, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { usDateTime } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/vendor/$ticketId")({
  component: VendorJob,
  head: () => ({
    meta: [
      { title: "Work order details | Resolve vendor portal" },
      {
        name: "description",
        content:
          "Access details, required steps and sign-off for a Work Order dispatched by A Real Home Away.",
      },
      { property: "og:title", content: "Work order details | Resolve vendor portal" },
      { property: "og:description", content: "Everything you need on site for this Work Order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const VENDOR_STATE: Record<string, { label: string; tone: StatusTone }> = {
  on_site: { label: "On site", tone: "progress" },
  accepted: { label: "In progress", tone: "progress" },
  dispatched: { label: "New", tone: "waiting" },
  completed: { label: "Complete", tone: "resolved" },
};

function VendorJob() {
  const { ticketId } = useParams({ from: "/_authenticated/vendor/$ticketId" });
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const job = useQuery({
    queryKey: ["vendor-job", ticketId],
    queryFn: async () => {
      const [ticket, steps, activity] = await Promise.all([
        supabase
          .from("tickets")
          .select(
            "id, ref, title, description, priority, status, category, due_at, vendor_brief, vendor_status, vendor_accepted_at, guest_in_residence, occupancy_status, properties(name, address_line1, city, state, postal_code, unit, access_notes, wifi_notes, primary_photo_url)",
          )
          .eq("id", ticketId)
          .maybeSingle(),
        supabase.from("ticket_steps").select("*").eq("ticket_id", ticketId).order("position"),
        supabase
          .from("ticket_activity")
          .select("id, body, created_at, kind")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (ticket.error) throw ticket.error;
      return { ticket: ticket.data, steps: steps.data ?? [], activity: activity.data ?? [] };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["vendor-job", ticketId] });

  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tickets")
        .update({ vendor_status: "accepted", vendor_accepted_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
      await logActivity("Vendor accepted the Work Order and is on the way.");
    },
    onSuccess: () => {
      toast.success("Thanks — the team can see you're on it.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not accept the Work Order"),
  });

  const toggleStep = useMutation({
    mutationFn: async (vars: { id: string; completed: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ticket_steps")
        .update({
          completed: vars.completed,
          completed_at: vars.completed ? new Date().toISOString() : null,
          completed_by: vars.completed ? (auth.user?.id ?? null) : null,
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the step"),
  });

  async function logActivity(body: string) {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("ticket_activity").insert({
      ticket_id: ticketId,
      author_id: auth.user?.id ?? null,
      kind: "note",
      event_type: "note",
      channel: "vendor_portal",
      body,
    });
    if (error) throw error;
  }

  const addNote = useMutation({
    mutationFn: async () => logActivity(note.trim()),
    onSuccess: () => {
      setNote("");
      toast.success("Update sent to the team.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send the update"),
  });

  const complete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tickets")
        .update({ vendor_status: "completed", vendor_completed_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
      await logActivity(
        note.trim()
          ? `Vendor marked the work complete.\n\n${note.trim()}`
          : "Vendor marked the work complete.",
      );
    },
    onSuccess: () => {
      setNote("");
      toast.success("Marked complete — a coordinator will review and close it out.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not mark it complete"),
  });

  if (job.isLoading) return <LoadingRows rows={5} />;

  const ticket = job.data?.ticket;
  if (!ticket) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<ShieldAlert className="size-8" />}
          title="Work order not available"
          hint="This job is not assigned to you, or it has been reassigned. Reach out to your coordinator if you think that's wrong."
          action={
            <Button asChild variant="outline">
              <Link to="/vendor">Back to my Work Orders</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const property = ticket.properties as {
    name: string;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    unit: string | null;
    access_notes: string | null;
    wifi_notes: string | null;
    primary_photo_url: string | null;
  } | null;

  const steps = job.data?.steps ?? [];
  const requiredOpen = steps.filter((s) => s.required && !s.completed).length;
  const finished = ticket.vendor_status === "completed";
  const state = VENDOR_STATE[ticket.vendor_status ?? ""] ?? {
    label: "New",
    tone: "waiting" as StatusTone,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/vendor">
          <ArrowLeft className="size-4" /> My jobs
        </Link>
      </Button>

      <header className="flex items-start gap-3">
        <PropertyPhoto
          url={property?.primary_photo_url}
          name={property?.name}
          className="size-14"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              className={
                ticket.priority === "p1" ? "border-danger/40 bg-danger/10 text-danger" : undefined
              }
            >
              {(ticket.priority ?? "").toUpperCase()}
            </Chip>
            <Chip>{(ticket.category ?? "").replace(/_/g, " ")}</Chip>
            <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
            {ticket.guest_in_residence && (
              <StatusBadge tone="waiting">Guest in the home</StatusBadge>
            )}
          </div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">
            #{ticket.ref} {ticket.title}
          </h1>
          {ticket.due_at && (
            <p className="text-sm text-muted-foreground">Needed by {usDateTime(ticket.due_at)}</p>
          )}
        </div>
      </header>

      {ticket.guest_in_residence && (
        <div className="flex gap-3 rounded-xl border border-amber/25 bg-amber/8 px-4 py-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber" />
          <p>
            A guest is staying in this home. Knock and announce yourself, keep the work area clean,
            and never leave an opening in a wall, ceiling or floor unsealed at the end of the visit.
          </p>
        </div>
      )}

      <SectionCard title="The home">
        <div className="space-y-2 text-sm">
          <p className="font-medium">{property?.name ?? "Address to be confirmed"}</p>
          <p className="text-muted-foreground">
            {[
              property?.address_line1,
              property?.unit,
              property?.city,
              property?.state,
              property?.postal_code,
            ]
              .filter(Boolean)
              .join(", ") || "Ask your coordinator for the address."}
          </p>
          {property?.access_notes && (
            <p>
              <span className="font-medium">Access: </span>
              {property.access_notes}
            </p>
          )}
          {property?.wifi_notes && (
            <p>
              <span className="font-medium">Wifi: </span>
              {property.wifi_notes}
            </p>
          )}
        </div>
      </SectionCard>

      {!finished && (
        <VisitCheckInCard ticketId={ticketId} homeName={property?.name ?? "the home"} />
      )}

      <SectionCard
        title="What we need done"
        description="Straight from the coordinator who dispatched this."
      >
        <div className="space-y-3 text-sm">
          {ticket.vendor_brief && (
            <p className="whitespace-pre-wrap font-medium">{ticket.vendor_brief}</p>
          )}
          {ticket.description && (
            <p className="whitespace-pre-wrap text-muted-foreground">{ticket.description}</p>
          )}
          {!ticket.vendor_brief && !ticket.description && (
            <p className="text-muted-foreground">
              No extra detail was added — call your coordinator if unclear.
            </p>
          )}
        </div>
      </SectionCard>

      {steps.length > 0 && (
        <SectionCard
          title="Required steps"
          description="These come from our playbook for this kind of work. Everything marked required has to be done before the job can be signed off."
        >
          <div className="space-y-1.5">
            {steps.map((step) => (
              <label
                key={step.id}
                className="flex items-start gap-3 border-b border-border/60 py-2.5 text-sm last:border-0"
              >
                <Checkbox
                  checked={step.completed}
                  disabled={finished || toggleStep.isPending}
                  onCheckedChange={(v) => toggleStep.mutate({ id: step.id, completed: v === true })}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block font-medium">
                    {step.instruction}
                    {step.required && <span className="ml-1 text-danger">*</span>}
                  </span>
                  {step.detail && (
                    <span className="block text-muted-foreground">{step.detail}</span>
                  )}
                  {step.photo_required && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Camera className="size-3" /> Send a photo of this to your coordinator.
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Update the team"
        description="Anything you find that we didn't ask about — tell us here rather than leaving it."
      >
        <div className="space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you found, what you did, what still needs a follow-up visit…"
            rows={4}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!note.trim() || addNote.isPending}
              onClick={() => addNote.mutate()}
            >
              Send update
            </Button>
            {ticket.vendor_status === "dispatched" && (
              <Button
                variant="secondary"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
              >
                Accept job
              </Button>
            )}
            {!finished && (
              <Button
                className="ml-auto"
                disabled={complete.isPending || requiredOpen > 0}
                onClick={() => complete.mutate()}
              >
                <CheckCircle2 className="size-4" />
                Mark work complete
              </Button>
            )}
          </div>
          {requiredOpen > 0 && (
            <p className="text-xs text-muted-foreground">
              {requiredOpen} required step{requiredOpen === 1 ? "" : "s"} still open.
            </p>
          )}
          {finished && (
            <p className="text-xs text-muted-foreground">
              Marked complete. A coordinator reviews the evidence before the ticket is closed.
            </p>
          )}
        </div>
      </SectionCard>

      <div className="space-y-3">
        <SectionBand title="History on this Work Order" />
        {(job.data?.activity ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <div className="space-y-3">
            {(job.data?.activity ?? []).map((a) => (
              <div key={a.id} className="border-l-2 border-border pl-3 text-sm">
                <p className="whitespace-pre-wrap">{a.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{usDateTime(a.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
