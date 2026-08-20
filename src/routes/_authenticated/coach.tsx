import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  HelpCircle,
  MessageSquare,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { askCoach, askCoachFollowUp, linkCoachSession } from "@/lib/coach.functions";
import { getPropertyStay } from "@/lib/ownerrez.functions";
import type { Guidance } from "@/lib/coach-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GUEST_IMPACT,
  OCCUPANCY_STATUS,
  labelFor,
  priorityMeta,
  priorityTone,
  slaDueDates,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Ask the Coach — Resolve Operations" },
      {
        name: "description",
        content:
          "Describe a live situation in plain language and get the ARHA-approved priority, checklist, vendor brief and guest message before anyone is dispatched.",
      },
      { property: "og:title", content: "Ask the Coach — Resolve Operations" },
      {
        property: "og:description",
        content: "Plain-language situation in, coached plan and dispatch brief out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachPage,
});

const EXAMPLES = [
  "There is an active leak in a vacant house.",
  "Guest says an alarm keeps beeping and they can't find where it's coming from.",
  "No hot water reported at 9pm, guest checks out tomorrow at 10am.",
  "Cleaner says the door code isn't working and the guest arrives in 2 hours.",
];

function CoachPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [session, setSession] = useState<{ id: string; guidance: Guidance } | null>(null);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const fetchStay = useServerFn(getPropertyStay);
  const { data: stay } = useQuery({
    queryKey: ["ownerrez-stay", propertyId],
    queryFn: () => fetchStay({ data: { propertyId } }),
    enabled: Boolean(propertyId),
    retry: false,
  });

  const ask = useServerFn(askCoach);
  const askFollowUpFn = useServerFn(askCoachFollowUp);
  const link = useServerFn(linkCoachSession);

  const assess = useMutation({
    mutationFn: () =>
      ask({
        data: {
          question: question.trim(),
          propertyId: propertyId || null,
          occupancyHint: stay?.ok ? stay.data.occupancy_status : null,
          guestName: stay?.ok ? stay.data.guest_name : null,
        },
      }),
    onSuccess: (res) => {
      setSession({ id: res.sessionId, guidance: res.guidance as Guidance });
      setChat([]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The coach could not answer that."),
  });

  const follow = useMutation({
    mutationFn: (q: string) => askFollowUpFn({ data: { sessionId: session!.id, question: q } }),
    onSuccess: (res) => setChat(res.history as { role: "user" | "assistant"; content: string }[]),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not answer that follow-up."),
  });

  const g = session?.guidance;

  async function openMatter() {
    if (!g || !session) return;
    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data: workTypes } = await supabase.from("work_types").select("*").eq("active", true);
      const wt =
        workTypes?.find((w) => w.name.toLowerCase() === g.work_type_name.toLowerCase()) ??
        workTypes?.find((w) => w.category === g.category) ??
        null;

      const now = new Date();
      const { response_due_at, action_due_at } = slaDueDates(g.priority, now, wt);

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          record_type: "ticket",
          title: g.suggested_title.slice(0, 160),
          description: `${question.trim()}\n\nCoach read-back: ${g.read_back}`,
          property_id: propertyId || null,
          work_type_id: wt?.id ?? null,
          functional_role_code: wt?.functional_role_code ?? null,
          category: wt?.category ?? g.category,
          bucket: wt?.bucket ?? null,
          guest_impact: g.guest_impact,
          occupancy_status: g.occupancy_status,
          suggested_priority: g.priority,
          priority: g.priority,
          source_channel: "internal",
          ownerrez_booking_id: stay?.ok ? stay.data.booking_id : null,
          guest_name: stay?.ok ? stay.data.guest_name : null,
          guest_in_residence: g.occupancy_status === "occupied",
          playbook_id: wt?.playbook_id ?? null,
          reported_at: now.toISOString(),
          acknowledged_at: now.toISOString(),
          response_due_at,
          action_due_at,
          due_at: action_due_at,
          created_by: userId,
          record_owner: userId,
          accountable_owner: userId,
          current_action_owner: userId,
          status: "open",
        })
        .select("id")
        .single();
      if (error) throw error;

      if (g.steps.length) {
        const { error: stepError } = await supabase.from("ticket_steps").insert(
          g.steps.map((s, i) => ({
            ticket_id: ticket.id,
            position: i + 1,
            instruction: s.instruction,
            detail: s.detail || null,
            required: s.required,
            photo_required: s.photo_required,
          })),
        );
        if (stepError) throw stepError;
      }

      await supabase.from("ticket_activity").insert([
        {
          ticket_id: ticket.id,
          author_id: userId,
          kind: "created",
          event_type: "created",
          channel: "internal",
          body: `Opened from Coach at ${g.priority.toUpperCase()}. ${g.priority_reason}`,
        },
        {
          ticket_id: ticket.id,
          author_id: userId,
          kind: "note",
          event_type: "note",
          channel: "internal",
          body: vendorBriefText(g),
        },
      ]);

      await link({ data: { sessionId: session.id, ticketId: ticket.id } });
      toast.success("Matter opened with the coached checklist attached.");
      router.navigate({ to: "/tickets/$ticketId", params: { ticketId: ticket.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the matter");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Sparkles className="size-7 text-primary" /> Ask the Coach
        </h1>
        <p className="mt-1 text-muted-foreground">
          Describe what is happening in plain language. The coach reads it against our SOP, sets the priority,
          gives you the checklist, and writes the brief for whoever you dispatch — before anyone leaves a hole
          in a wall.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What is happening?</CardTitle>
          <CardDescription>
            Pick the home so the coach can use its access notes, live occupancy and its own history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coach-property">Property</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger id="coach-property">
                <SelectValue placeholder="Select a property (optional)" />
              </SelectTrigger>
              <SelectContent>
                {(properties ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nickname ? `${p.nickname} — ${p.name}` : p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stay?.ok && (
              <p className="text-xs text-muted-foreground">
                Live from the booking system: {labelFor(OCCUPANCY_STATUS, stay.data.occupancy_status)}
                {stay.data.guest_name ? ` · ${stay.data.guest_name}` : ""}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="coach-question">The situation</Label>
            <Textarea
              id="coach-question"
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="There is an active leak in a vacant house."
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuestion(ex)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => assess.mutate()}
            disabled={question.trim().length < 5 || assess.isPending}
            className="w-full"
          >
            {assess.isPending ? "Coaching…" : "Coach me through this"}
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {assess.isPending && <Skeleton className="h-96 w-full" />}

      {g && (
        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={priorityTone(g.priority)}>{priorityMeta(g.priority).short}</Badge>
                <Badge variant="outline">{g.work_type_name}</Badge>
                <Badge variant="outline">{labelFor(GUEST_IMPACT, g.guest_impact)}</Badge>
                <Badge variant="outline">{labelFor(OCCUPANCY_STATUS, g.occupancy_status)}</Badge>
              </div>
              <CardTitle className="text-xl">{g.suggested_title}</CardTitle>
              <CardDescription>{g.read_back}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">Why {priorityMeta(g.priority).short}: </span>
                {g.priority_reason} Acknowledge within {priorityMeta(g.priority).responseMinutes} minutes, start
                action within {priorityMeta(g.priority).actionMinutes}.
              </p>

              {g.risk_flags.length > 0 && (
                <div className="space-y-2 rounded-md border border-danger/30 bg-danger/5 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-danger">
                    <AlertTriangle className="size-4" /> Risk to contain
                  </p>
                  <ul className="space-y-1 text-sm">
                    {g.risk_flags.map((r) => (
                      <li key={r.title}>
                        <span className="font-medium">{r.title}:</span> {r.why}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Section icon={CheckCircle2} title="Do this now">
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {g.immediate_actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ol>
              </Section>

              {g.clarifying_questions.length > 0 && (
                <Section icon={HelpCircle} title="Confirm before you dispatch">
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {g.clarifying_questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section icon={ClipboardCheck} title="Your checklist">
                <ol className="space-y-2">
                  {g.steps.map((s, i) => (
                    <li key={s.instruction} className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium">
                        {i + 1}. {s.instruction}
                      </p>
                      {s.detail && <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>}
                      <div className="mt-2 flex gap-2">
                        {s.required && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {s.photo_required && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Camera className="size-3" /> Photo proof
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section icon={Wrench} title="Brief for the maintenance person">
                <div className="space-y-3 rounded-md border border-border p-3 text-sm">
                  <p>{g.vendor_brief.scope}</p>
                  <BriefList label="Must check" items={g.vendor_brief.must_check} />
                  <BriefList label="Must NOT do" items={g.vendor_brief.must_not_do} tone="danger" />
                  <BriefList label="Bring back as evidence" items={g.vendor_brief.evidence_required} />
                  <BriefList label="Before leaving the home" items={g.vendor_brief.before_leaving} />
                  <Button size="sm" variant="outline" onClick={() => copy(vendorBriefText(g))}>
                    <Copy className="size-4" /> Copy brief
                  </Button>
                </div>
              </Section>

              <Section icon={MessageSquare} title="Message to the guest">
                <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{g.guest_message}</p>
                  <Button size="sm" variant="outline" onClick={() => copy(g.guest_message)}>
                    <Copy className="size-4" /> Copy message
                  </Button>
                </div>
              </Section>

              {g.owner_note && (
                <Section icon={MessageSquare} title="If the owner needs to know">
                  <p className="rounded-md border border-border p-3 text-sm whitespace-pre-wrap">{g.owner_note}</p>
                </Section>
              )}

              {g.escalate_if.length > 0 && (
                <Section icon={AlertTriangle} title="Escalate the moment">
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {g.escalate_if.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </Section>
              )}

              <Separator />
              <Button onClick={openMatter} disabled={creating} className="w-full">
                {creating ? "Opening…" : "Open a matter with this plan"}
                <ArrowRight className="size-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                The checklist becomes the matter&apos;s steps, the clocks start, and this coaching session stays
                attached to the record.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Something changed? Keep asking.</CardTitle>
              <CardDescription>
                &ldquo;The handyman says the shutoff is seized.&rdquo; &middot; &ldquo;Guest wants to leave.&rdquo;
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[95%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  {m.content}
                </div>
              ))}
              {follow.isPending && <Skeleton className="h-16 w-full" />}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = followUp.trim();
                  if (!q) return;
                  setFollowUp("");
                  follow.mutate(q);
                }}
              >
                <Input
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Ask the coach a follow-up…"
                />
                <Button type="submit" disabled={follow.isPending || !followUp.trim()}>
                  <Send className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CheckCircle2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" /> {title}
      </p>
      {children}
    </div>
  );
}

function BriefList({ label, items, tone }: { label: string; items: string[]; tone?: "danger" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone === "danger" ? "text-danger" : "text-muted-foreground"}`}>
        {label}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function vendorBriefText(g: Guidance) {
  const line = (label: string, items: string[]) =>
    items.length ? `\n${label}:\n${items.map((i) => `- ${i}`).join("\n")}` : "";
  return [
    `SCOPE: ${g.vendor_brief.scope}`,
    line("MUST CHECK", g.vendor_brief.must_check),
    line("DO NOT", g.vendor_brief.must_not_do),
    line("EVIDENCE REQUIRED", g.vendor_brief.evidence_required),
    line("BEFORE LEAVING", g.vendor_brief.before_leaving),
  ].join("\n");
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy"),
  );
}
