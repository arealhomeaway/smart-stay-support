import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/components/DemoProvider";
import { RequireCapability } from "@/components/RequireCapability";
import { PageHeader, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDirectBooking, listDirectBookings, startDirectBooking, type DirectBookingDetails, type DirectBookingRow } from "@/lib/direct-bookings.functions";
import { clockLabel, replyClock, requestStatus, STATUS_LABEL, type RequestStatus } from "@/lib/direct-bookings";

export const Route = createFileRoute("/_authenticated/direct-bookings/")({
  head: () => ({
    meta: [
      { title: "Direct Bookings | ARHA Resolve" },
      { name: "description", content: "Requests from insurance companies and referral partners. Reply to each one within 3 minutes." },
      { property: "og:title", content: "Direct Bookings | ARHA Resolve" },
      { property: "og:description", content: "Requests from insurance companies and referral partners, answered within 3 minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="direct_bookings_work" title="Direct Bookings">
      <DirectBookingsPage />
    </RequireCapability>
  ),
});

export const STATUS_TONE: Record<RequestStatus, StatusTone> = {
  new: "escalated",
  working: "progress",
  waiting_approval: "review",
  sent: "waiting",
  booked: "resolved",
  not_booked: "closed",
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function partnerOf(r: Pick<DirectBookingRow, "partner_name" | "company" | "contact_name">) {
  return r.partner_name || r.company || r.contact_name || "Partner not named yet";
}

function DirectBookingsPage() {
  const { demoMode } = useDemo();
  const list = useServerFn(listDirectBookings);
  const start = useServerFn(startDirectBooking);
  const create = useServerFn(createDirectBooking);
  const navigate = useNavigate();
  const now = useNow();
  const [newOpen, setNewOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["direct-bookings", demoMode],
    queryFn: () => list({ data: { demo: demoMode } }),
    refetchInterval: 15_000,
  });

  const requests = data?.requests ?? [];
  const status = (r: DirectBookingRow) =>
    requestStatus({ ...r, pending_approval: (data?.pending ?? []).includes(r.id) });
  const open = requests.filter((r) => !r.outcome);
  const counts = {
    new: open.filter((r) => status(r) === "new").length,
    working: open.filter((r) => ["working", "waiting_approval"].includes(status(r))).length,
    sent: open.filter((r) => status(r) === "sent").length,
    done: requests.filter((r) => r.outcome).length,
  };

  async function onStart(id: string) {
    try {
      const result = await start({ data: { id } });
      if (!result.won) toast.info(`${result.owner_name ?? "A teammate"} already owns this request.`);
      navigate({ to: "/direct-bookings/$requestId", params: { requestId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start.");
      refetch();
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Direct Bookings"
        description="Requests from insurance companies and referral partners. Reply to each one within 3 minutes."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/inquiry-sources">Referral sources</Link>
            </Button>
            <Button onClick={() => setNewOpen(true)}>New request</Button>
          </>
        }
      />

      {data && !data.ready ? (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          Direct Bookings is still being set up. New requests will show here soon.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Count label="New" value={counts.new} />
        <Count label="In progress" value={counts.working} />
        <Count label="Reply sent" value={counts.sent} />
        <Count label="Finished" value={counts.done} />
      </div>

      <SectionCard bodyClassName="space-y-2">
        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing here right now.</p>
        ) : (
          requests.map((r) => {
            const s = status(r);
            const clock = replyClock(r.created_at, r.reply_sent_at, now);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{partnerOf(r)}</span>
                    <StatusBadge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</StatusBadge>
                  </div>
                  <p className="truncate text-sm">{summary(r)}</p>
                  <p className="text-xs text-muted-foreground">
                    {detailLine(r, s, clock.seconds, data?.names ?? {})}
                  </p>
                </div>
                {s === "new" ? (
                  <Button size="sm" onClick={() => onStart(r.id)}>Start</Button>
                ) : (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/direct-bookings/$requestId" params={{ requestId: r.id }}>Open</Link>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </SectionCard>

      <SectionCard
        title="Past requests"
        description="Earlier leads, kept for reference. You can read them here."
        actions={
          <Button size="sm" variant="ghost" onClick={() => setShowPast((v) => !v)}>
            {showPast ? "Hide" : "Show"}
          </Button>
        }
        bodyClassName="space-y-1"
      >
        {showPast ? (
          (data?.past ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here right now.</p>
          ) : (
            (data?.past ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
                <span>{p.company || p.contact_name || "Not recorded"}</span>
                <span className="text-muted-foreground">
                  {p.desired_move_in ? `Move in ${p.desired_move_in}` : "No date"} · {new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )
        ) : (
          <p className="text-sm text-muted-foreground">{(data?.past ?? []).length} earlier requests.</p>
        )}
      </SectionCard>

      <NewRequestDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={async (payload) => {
          const created = await create({ data: payload });
          await start({ data: { id: created.id } }).catch(() => null);
          navigate({ to: "/direct-bookings/$requestId", params: { requestId: created.id } });
        }}
      />
    </div>
  );
}

function summary(r: DirectBookingRow) {
  const parts = [
    r.bedrooms ? `${r.bedrooms} bedrooms` : null,
    r.guests ? `${r.guests} people` : null,
    r.dogs ? `${r.dogs} dog${r.dogs === 1 ? "" : "s"}` : null,
    r.search_region || r.market,
    r.desired_move_in ? `from ${r.desired_move_in}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : r.subject || "Details still to fill in";
}

function detailLine(r: DirectBookingRow, s: RequestStatus, seconds: number, names: Record<string, string>) {
  if (s === "new") return `Waiting ${clockLabel(seconds)}. Press Start to own it.`;
  if (s === "working") return `${names[r.owned_by ?? ""] ?? "A teammate"} is on it. ${clockLabel(seconds)} so far.`;
  if (s === "waiting_approval") return `Waiting for approval. ${clockLabel(seconds)} so far.`;
  if (s === "sent") return `Reply sent by ${names[r.reply_sent_by ?? ""] ?? "a teammate"} in ${clockLabel(seconds)}.`;
  if (s === "booked") return "Booked. Well done.";
  return r.not_booked_reason ? `Not booked: ${r.not_booked_reason}` : "Not booked";
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface px-4 py-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

type NewPayload = DirectBookingDetails;

function NewRequestDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (p: NewPayload) => Promise<void>;
}) {
  const [f, setF] = useState({ partner_name: "", contact_name: "", email: "", phone: "", location: "", move_in: "", move_out: "", bedrooms: "", guests: "", dogs: "", requirements: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New request</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">For a phone call or a walk-in. The 3 minute clock starts when you save.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Partner" value={f.partner_name} onChange={set("partner_name")} />
          <Field label="Contact name" value={f.contact_name} onChange={set("contact_name")} />
          <Field label="Email" value={f.email} onChange={set("email")} />
          <Field label="Phone" value={f.phone} onChange={set("phone")} />
          <Field label="Where" value={f.location} onChange={set("location")} />
          <Field label="Bedrooms" value={f.bedrooms} onChange={set("bedrooms")} type="number" />
          <Field label="Move in" value={f.move_in} onChange={set("move_in")} type="date" />
          <Field label="Move out" value={f.move_out} onChange={set("move_out")} type="date" />
          <Field label="People" value={f.guests} onChange={set("guests")} type="number" />
          <Field label="Dogs" value={f.dogs} onChange={set("dogs")} type="number" />
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea value={f.requirements} onChange={set("requirements")} rows={3} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onCreate({ ...f, bedrooms: num(f.bedrooms), guests: num(f.guests), dogs: num(f.dogs) });
                onOpenChange(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save.");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save and start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (e: { target: { value: string } }) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={onChange} />
    </div>
  );
}
