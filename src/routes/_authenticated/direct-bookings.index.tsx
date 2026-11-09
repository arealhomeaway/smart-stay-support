import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDemo } from "@/components/DemoProvider";
import { RequireCapability } from "@/components/RequireCapability";
import { PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createDirectBooking, listDirectBookings, startDirectBooking, type DirectBookingDetails, type DirectBookingRow } from "@/lib/direct-bookings.functions";
import {
  approvalStrip,
  boardTiles,
  DB_COPY,
  longDate,
  requestStatus,
  statusChip,
  viewCounts,
  viewOf,
  VIEWS,
  type RequestStatus,
  type ViewKey,
} from "@/lib/direct-bookings";

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

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function partnerOf(r: Pick<DirectBookingRow, "partner_name" | "company" | "contact_name">) {
  return r.partner_name || r.company || r.contact_name || "Partner not named yet";
}

/** What they need: bedrooms, people, pets and the place. */
export function summaryLine(r: DirectBookingRow) {
  const beds = r.bedrooms
    ? `${r.bedrooms} or more bedrooms${r.preferred_bedrooms && r.preferred_bedrooms !== r.bedrooms ? ` (${r.preferred_bedrooms} preferred)` : ""}`
    : null;
  const parts = [
    beds,
    r.guests ? `${r.guests} ${r.guests === 1 ? "person" : "people"}` : null,
    r.dogs ? `${r.dogs} dog${r.dogs === 1 ? "" : "s"}` : null,
    r.cats ? `${r.cats} cat${r.cats === 1 ? "" : "s"}` : null,
    r.search_region || r.market,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : r.subject || "Details still to fill in";
}

/** When: the dates, or as soon as possible and the length. */
export function datesLine(r: DirectBookingRow) {
  if (r.desired_move_in && r.desired_check_out) return `${longDate(r.desired_move_in)} to ${longDate(r.desired_check_out)}`;
  if (r.desired_move_in) return `From ${longDate(r.desired_move_in)}${r.stay_length ? ` for ${r.stay_length}` : ""}`;
  if (r.asap) return `As soon as possible${r.stay_length ? ` for ${r.stay_length}` : ""}`;
  return "Dates not given yet";
}

function detailLine(r: DirectBookingRow, s: RequestStatus) {
  const when = datesLine(r);
  if (s === "working") return `${when} · ${DB_COPY.coordinatorOnIt}`;
  if (s === "not_booked") return r.not_booked_reason ? `${when} · Not booked: ${r.not_booked_reason}` : when;
  return when;
}

function DirectBookingsPage() {
  const { demoMode } = useDemo();
  const list = useServerFn(listDirectBookings);
  const start = useServerFn(startDirectBooking);
  const create = useServerFn(createDirectBooking);
  const navigate = useNavigate();
  const now = useNow();
  const [newOpen, setNewOpen] = useState(false);
  const [view, setView] = useState<ViewKey>("open");
  const { data, refetch } = useQuery({
    queryKey: ["direct-bookings", demoMode],
    queryFn: () => list({ data: { demo: demoMode } }),
    refetchInterval: 15_000,
  });

  const requests = data?.requests ?? [];
  const pending = useMemo(() => new Set(data?.pending ?? []), [data?.pending]);
  const board = requests.map((r) => ({ ...r, status: requestStatus({ ...r, pending_approval: pending.has(r.id) }) }));
  const counts = viewCounts(board);
  const tiles = boardTiles(board, now, data?.settings.replyTargetMinutes, data?.settings.overnightClockStart);
  const shown = board
    .filter((r) => viewOf(r.status) === view)
    .sort((a, b) => (view === "open" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
  const strip = data?.settings
    ? approvalStrip(data.pendingApprovals ?? [], { isSupervisor: data.isSupervisor, isDirector: data.isDirector }, data.settings, now)
    : null;
  const earlier = (data?.past ?? []).filter((p) => (view === "booked" ? p.stage === "converted" : view === "not_booked" ? p.stage === "lost" : false));

  async function onStart(id: string) {
    try {
      const result = await start({ data: { id } });
      if (!result.won) toast.info(DB_COPY.someoneElseOwns);
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
        description={DB_COPY.subtitle}
        actions={
          <>
            <Button variant="outline" className="min-h-12 px-5 text-[15px] font-semibold" asChild>
              <Link to="/inquiry-sources">Referral sources</Link>
            </Button>
            <Button className="min-h-12 px-6 text-[15px] font-semibold" onClick={() => setNewOpen(true)}>New request</Button>
          </>
        }
      />

      {strip ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <strong className="text-base text-destructive">{strip.text}</strong>
          <Button variant="destructive" className="min-h-11 px-5 font-semibold" asChild>
            <Link to="/direct-bookings/$requestId" params={{ requestId: strip.openId }}>{DB_COPY.reviewNow}</Link>
          </Button>
        </div>
      ) : null}

      {data && !data.ready ? (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          Direct Bookings is still being set up. New requests will show here soon.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.key}
            className={cn("flex flex-col gap-1 rounded-xl border p-3.5", t.red ? "border-destructive/40 bg-destructive/10" : "border-border bg-card")}
          >
            <span className="text-[13px] text-muted-foreground">{t.label}</span>
            <strong className={cn("text-[26px] leading-tight", t.red ? "text-destructive" : "text-foreground")}>{t.value}</strong>
          </div>
        ))}
      </div>

      <div role="tablist" aria-label="Views" className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => {
          const on = v.key === view;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setView(v.key)}
              className={cn(
                "min-h-11 rounded-full border px-[18px] text-sm font-semibold transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary",
              )}
            >
              {v.label} <span className="opacity-80">{counts[v.key]}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {shown.map((r) => {
          const chip = statusChip(r.status, r, now, data?.settings.replyTargetMinutes, data?.settings.overnightClockStart);
          const startable = r.status === "new";
          return (
            <div
              key={r.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4",
                chip.late ? "border-destructive/60" : "border-border",
              )}
            >
              <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[17px]">{partnerOf(r)}</strong>
                  <StatusBadge tone={chip.tone} className="text-[13px] font-semibold">{chip.text}</StatusBadge>
                </div>
                <span className="text-[15px]">{summaryLine(r)}</span>
                <span className="text-[13px] text-muted-foreground">{detailLine(r, r.status)}</span>
              </div>
              {startable ? (
                <Button className="min-h-12 px-6 text-[15px] font-semibold" onClick={() => onStart(r.id)}>{DB_COPY.startQuote}</Button>
              ) : (
                <Button className="min-h-12 px-6 text-[15px] font-semibold" asChild>
                  <Link to="/direct-bookings/$requestId" params={{ requestId: r.id }}>{DB_COPY.open}</Link>
                </Button>
              )}
            </div>
          );
        })}
        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-7 text-center text-[15px] text-muted-foreground">{DB_COPY.empty}</div>
        ) : null}
      </div>

      {earlier.length > 0 ? (
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-muted-foreground">Earlier requests</h2>
          {earlier.map((p) => (
            <div key={p.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
              <span>{p.company || p.contact_name || "Not recorded"}</span>
              <span className="text-muted-foreground">
                {p.desired_move_in ? `Move in ${longDate(p.desired_move_in)}` : "No date"} · {longDate(p.created_at.slice(0, 10))}
              </span>
            </div>
          ))}
        </div>
      ) : null}

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
          <Field
            label={DB_COPY.whereLabel}
            value={f.location}
            onChange={set("location")}
            placeholder={DB_COPY.wherePlaceholder}
            help={DB_COPY.whereHelp}
          />
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
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="min-h-11"
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  type?: string;
  placeholder?: string;
  help?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex flex-col gap-1.5">
        {label}
        <Input className="h-11 font-normal" type={type} value={value} onChange={onChange} placeholder={placeholder} />
      </Label>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}
