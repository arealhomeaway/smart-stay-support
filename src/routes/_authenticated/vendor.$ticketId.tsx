import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Camera, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { VisitCheckInCard } from "@/components/VisitCheckInCard";

export const Route = createFileRoute("/_authenticated/vendor/$ticketId")({
  component: VendorJob,
  head: () => ({
    meta: [
      { title: "Work order details | Resolve vendor portal" },
      {
        name: "description",
        content: "Access details, required steps and sign-off for a work order dispatched by A Real Home Away.",
      },
      { property: "og:title", content: "Work order details | Resolve vendor portal" },
      { property: "og:description", content: "Everything you need on site for this work order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

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
            "id, ref, title, description, priority, status, category, due_at, vendor_brief, vendor_status, vendor_accepted_at, guest_in_residence, occupancy_status, properties(name, address_line1, city, state, postal_code, unit, access_notes, wifi_notes)",
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
      await logActivity("Vendor accepted the work order and is on the way.");
    },
    onSuccess: () => {
      toast.success("Thanks — the team can see you're on it.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not accept the work order"),
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

  if (job.isLoading) return <Skeleton className="h-96 w-full" />;

  const ticket = job.data?.ticket;
  if (!ticket) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-semibold">Work order not available</h1>
        <p className="text-sm text-muted-foreground">
          This job is not assigned to you, or it has been reassigned. Reach out to your coordinator if you think
          that's wrong.
        </p>
        <Button asChild variant="outline">
          <Link to="/vendor">Back to my work orders</Link>
        </Button>
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
  } | null;

  const steps = job.data?.steps ?? [];
  const requiredOpen = steps.filter((s) => s.required && !s.completed).length;
  const finished = ticket.vendor_status === "completed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/vendor">
          <ArrowLeft className="size-4" /> My jobs
        </Link>
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ticket.priority === "p1" ? "destructive" : "secondary"}>
            {(ticket.priority ?? "").toUpperCase()}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {ticket.category}
          </Badge>
          {ticket.guest_in_residence && <Badge className="bg-amber-500 text-white">Guest in the home</Badge>}
        </div>
        <h1 className="font-display text-2xl font-semibold">
          #{ticket.ref} {ticket.title}
        </h1>
        {ticket.due_at && (
          <p className="text-sm text-muted-foreground">Needed by {new Date(ticket.due_at).toLocaleString()}</p>
        )}
      </header>

      {ticket.guest_in_residence && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex gap-3 pt-6 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              A guest is staying in this home. Knock and announce yourself, keep the work area clean, and never
              leave an opening in a wall, ceiling or floor unsealed at the end of the visit.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">The home</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{property?.name ?? "Address to be confirmed"}</p>
          <p className="text-muted-foreground">
            {[property?.address_line1, property?.unit, property?.city, property?.state, property?.postal_code]
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
        </CardContent>
      </Card>

      {!finished && <VisitCheckInCard ticketId={ticketId} homeName={property?.name ?? "the home"} />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What we need done</CardTitle>
          <CardDescription>Straight from the coordinator who dispatched this.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {ticket.vendor_brief && <p className="whitespace-pre-wrap font-medium">{ticket.vendor_brief}</p>}
          {ticket.description && <p className="whitespace-pre-wrap text-muted-foreground">{ticket.description}</p>}
          {!ticket.vendor_brief && !ticket.description && (
            <p className="text-muted-foreground">No extra detail was added — call your coordinator if unclear.</p>
          )}
        </CardContent>
      </Card>

      {steps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Required steps</CardTitle>
            <CardDescription>
              These come from our playbook for this kind of work. Everything marked required has to be done before
              the job can be signed off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.map((step) => (
              <label
                key={step.id}
                className="flex items-start gap-3 rounded-md border border-border px-3 py-2 text-sm"
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
                    {step.required && <span className="ml-1 text-destructive">*</span>}
                  </span>
                  {step.detail && <span className="block text-muted-foreground">{step.detail}</span>}
                  {step.photo_required && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Camera className="size-3" /> Send a photo of this to your coordinator.
                    </span>
                  )}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Update the team</CardTitle>
          <CardDescription>
            Anything you find that we didn't ask about — tell us here rather than leaving it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
              <Button variant="secondary" disabled={accept.isPending} onClick={() => accept.mutate()}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">History on this work order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(job.data?.activity ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nothing logged yet.</p>
          ) : (
            (job.data?.activity ?? []).map((a) => (
              <div key={a.id} className="border-l-2 border-border pl-3">
                <p className="whitespace-pre-wrap">{a.body}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
