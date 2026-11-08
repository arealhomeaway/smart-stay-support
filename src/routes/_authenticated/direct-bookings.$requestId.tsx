import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  checkDirectBookingApprovals,
  decideDirectBookingApproval,
  getDirectBooking,
  markDirectBookingOutcome,
  markDirectBookingSentByHand,
  saveDirectBookingDetails,
  searchDirectBookingHomes,
  sendDirectBookingFollowUp,
  startDirectBooking,
  submitDirectBookingReply,
} from "@/lib/direct-bookings.functions";
import {
  clockLabel,
  DEFAULT_FOLLOW_UP_TEMPLATE,
  DEFAULT_REPLY_TEMPLATE,
  feeLines,
  fillTemplate,
  homeLines,
  MAX_HOMES,
  money,
  NOT_BOOKED_REASONS,
  replyClock,
  requestStatus,
  SEARCH_DISTANCES,
  STATUS_LABEL,
  type SearchDistance,
} from "@/lib/direct-bookings";
import { STATUS_TONE } from "./direct-bookings.index";

export const Route = createFileRoute("/_authenticated/direct-bookings/$requestId")({
  head: () => ({
    meta: [
      { title: "Direct booking request | ARHA Resolve" },
      { name: "description", content: "Check what the partner asked for, pick up to 3 homes and send the reply." },
      { property: "og:title", content: "Direct booking request | ARHA Resolve" },
      { property: "og:description", content: "Pick up to 3 homes and reply within 3 minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="direct_bookings_work" title="Direct Bookings">
      <RequestPage />
    </RequireCapability>
  ),
});

type Detail = Extract<Awaited<ReturnType<typeof getDirectBooking>>, { ready: true }>;
type Search = Awaited<ReturnType<typeof searchDirectBookingHomes>>;
type Home = Extract<Search, { ok: true }>["homes"][number];

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function RequestPage() {
  const { requestId } = Route.useParams();
  const get = useServerFn(getDirectBooking);
  const check = useServerFn(checkDirectBookingApprovals);
  const { data, refetch } = useQuery({
    queryKey: ["direct-booking", requestId],
    queryFn: () => get({ data: { id: requestId } }),
    refetchInterval: 10_000,
  });
  const pendingId = data && data.ready ? data.pending?.id : null;
  // The 2 minute rule is checked on the server while anyone has this open.
  useEffect(() => {
    if (!pendingId) return;
    const t = setInterval(() => check().then(() => refetch()).catch(() => null), 20_000);
    return () => clearInterval(t);
  }, [pendingId, check, refetch]);

  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  if (!data.ready)
    return (
      <div className="space-y-3">
        <BackLink />
        <p className="text-sm text-muted-foreground">Direct Bookings is still being set up. Use Leads for now.</p>
      </div>
    );
  return <RequestView d={data} refetch={() => refetch()} />;
}

function BackLink() {
  return (
    <Link to="/direct-bookings" className="text-sm font-medium text-primary hover:underline">
      ← Back to Direct Bookings
    </Link>
  );
}

function RequestView({ d, refetch }: { d: Detail; refetch: () => void }) {
  const lead = d.lead;
  const now = useNow();
  const status = requestStatus({ ...lead, pending_approval: Boolean(d.pending) });
  const mine = lead.owned_by === d.me;
  const editable = mine && !lead.reply_sent_at && !d.pending;
  const clock = replyClock(lead.created_at, lead.reply_sent_at, now, d.settings.replyTargetMinutes);
  const partner = lead.partner_name || lead.company || lead.contact_name || "Partner not named yet";
  const start = useServerFn(startDirectBooking);
  const [picked, setPicked] = useState<Home[]>([]);

  return (
    <div className="space-y-5">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{partner}</h1>
            <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>
          </div>
          <p className="text-muted-foreground">{lead.subject || "Request entered by hand"}</p>
        </div>
        <div className={`text-right ${clock.late ? "text-coral" : ""}`}>
          <div className="text-2xl font-semibold tabular-nums">{clockLabel(clock.seconds)}</div>
          <div className="text-xs text-muted-foreground">{clock.stopped ? "Time to reply" : "Clock running"}</div>
        </div>
      </div>

      {!lead.owned_by ? (
        <SectionCard tone="attention">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Nobody owns this request yet. Press Start to make it yours.</p>
            <Button
              onClick={async () => {
                const r = await start({ data: { id: lead.id } }).catch((e: Error) => (toast.error(e.message), null));
                if (r && !r.won) toast.info(`${r.owner_name ?? "A teammate"} already owns this request.`);
                refetch();
              }}
            >
              Start
            </Button>
          </div>
        </SectionCard>
      ) : !mine ? (
        <p className="text-sm text-muted-foreground">{d.names[lead.owned_by] ?? "A teammate"} owns this request.</p>
      ) : null}

      {d.pending ? <ApprovalBanner d={d} refetch={refetch} /> : null}
      {d.lastSentBack && !d.pending && !lead.reply_sent_at ? (
        <SectionCard tone="attention">
          <p className="text-sm">Sent back to edit: {d.lastSentBack.note}</p>
        </SectionCard>
      ) : null}

      {lead.reply_sent_at ? <SentState d={d} refetch={refetch} /> : null}

      <AskedFor d={d} editable={editable} onSaved={refetch} />
      <PickHomes d={d} editable={editable} picked={picked} setPicked={setPicked} />
      <Reply d={d} editable={editable} picked={picked} onDone={refetch} />
    </div>
  );
}

function ApprovalBanner({ d, refetch }: { d: Detail; refetch: () => void }) {
  const decide = useServerFn(decideDirectBookingApproval);
  const [backOpen, setBackOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(decision: "approved" | "sent_back") {
    setBusy(true);
    try {
      const r = await decide({ data: { id: d.lead.id, decision, note: decision === "sent_back" ? note : undefined } });
      if (r.state === "sent") toast.success("Reply sent.");
      else if (r.state === "approved_not_sent") toast.warning(`Approved. ${r.detail} The owner can copy the reply and send it from Outlook.`);
      else toast.success("Sent back to edit.");
      setBackOpen(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SectionCard tone="attention">
      <div className="space-y-3">
        <p className="font-medium">Check the homes and the reply below. The clock is running.</p>
        {d.canApprove ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run("approved")}>Approve and send</Button>
            <Button disabled={busy} variant="outline" onClick={() => setBackOpen(true)}>Send back to edit</Button>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          The Operations Supervisor has been alerted. If there is no approval within {d.settings.approvalWaitMinutes} minutes, the Director of Operations is alerted and can approve.
        </p>
      </div>
      <Dialog open={backOpen} onOpenChange={setBackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to edit</DialogTitle>
          </DialogHeader>
          <Label>What should change?</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <div className="flex justify-end">
            <Button disabled={busy || !note.trim()} onClick={() => run("sent_back")}>Send back</Button>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function AskedFor({ d, editable, onSaved }: { d: Detail; editable: boolean; onSaved: () => void }) {
  const lead = d.lead;
  const save = useServerFn(saveDirectBookingDetails);
  const initial = useMemo(
    () => ({
      partner_name: lead.partner_name ?? lead.company ?? "",
      contact_name: lead.contact_name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      location: lead.search_region ?? lead.market ?? "",
      move_in: lead.desired_move_in ?? "",
      move_out: lead.desired_check_out ?? "",
      bedrooms: lead.bedrooms?.toString() ?? "",
      bathrooms: lead.min_bathrooms?.toString() ?? "",
      guests: lead.guests?.toString() ?? "",
      dogs: lead.dogs?.toString() ?? "",
      cats: lead.cats?.toString() ?? "",
      requirements: lead.requirements ?? "",
      inquiry_source_id: lead.inquiry_source_id ?? "",
    }),
    [lead],
  );
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const field = (label: string, k: keyof typeof f, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={f[k]} onChange={set(k)} disabled={!editable} />
    </div>
  );
  return (
    <SectionCard title="1. What they asked for" description="Filled in from the email. Check it and fix anything that is wrong.">
      <div className="grid gap-3 sm:grid-cols-3">
        {field("Partner", "partner_name")}
        {field("Contact name", "contact_name")}
        {field("Email", "email")}
        {field("Where", "location")}
        {field("Move in", "move_in", "date")}
        {field("Move out", "move_out", "date")}
        {field("Bedrooms", "bedrooms", "number")}
        {field("Bathrooms", "bathrooms", "number")}
        {field("People", "guests", "number")}
        {field("Dogs", "dogs", "number")}
        {field("Cats", "cats", "number")}
        <div className="space-y-1">
          <Label>Referral source</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={f.inquiry_source_id}
            onChange={set("inquiry_source_id")}
            disabled={!editable}
          >
            <option value="">Not chosen</option>
            {d.sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Label>Notes</Label>
        <Textarea value={f.requirements} onChange={set("requirements")} rows={3} disabled={!editable} />
      </div>
      {editable ? (
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await save({
                  data: {
                    id: lead.id, ...f,
                    bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), guests: num(f.guests),
                    dogs: num(f.dogs), cats: num(f.cats), inquiry_source_id: f.inquiry_source_id || null,
                  },
                });
                toast.success("Saved.");
                onSaved();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save.");
              }
            }}
          >
            Save details
          </Button>
        </div>
      ) : null}
    </SectionCard>
  );
}

function PickHomes({ d, editable, picked, setPicked }: { d: Detail; editable: boolean; picked: Home[]; setPicked: (h: Home[]) => void }) {
  const search = useServerFn(searchDirectBookingHomes);
  const [distance, setDistance] = useState<SearchDistance>(10);
  const [page, setPage] = useState(0);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["direct-booking-homes", d.lead.id, distance, d.lead.desired_move_in, d.lead.desired_check_out, d.lead.search_region, d.lead.bedrooms, d.lead.inquiry_source_id],
    queryFn: () => search({ data: { id: d.lead.id, distance } }),
    enabled: !d.lead.reply_sent_at,
    staleTime: 60_000,
  });
  const homes = data && data.ok ? data.homes : [];
  const pageSize = 6;
  const shown = homes.slice(page * pageSize, page * pageSize + pageSize);
  const toggle = (h: Home) => {
    if (picked.some((p) => p.id === h.id)) setPicked(picked.filter((p) => p.id !== h.id));
    else if (picked.length < MAX_HOMES) setPicked([...picked, h]);
    else toast.info(`Pick up to ${MAX_HOMES} homes.`);
  };
  if (d.lead.reply_sent_at)
    return (
      <SectionCard title="2. Pick up to 3 homes">
        <p className="text-sm text-muted-foreground">{(d.lead.offered_property_ids ?? []).length} homes were offered in the reply.</p>
      </SectionCard>
    );
  return (
    <SectionCard
      title="2. Pick up to 3 homes"
      description="Best matches first. Homes free for 30 days come first."
      actions={
        <div className="flex flex-wrap gap-1">
          {SEARCH_DISTANCES.map((m) => (
            <Button key={m} size="sm" variant={m === distance ? "default" : "outline"} onClick={() => { setDistance(m); setPage(0); }}>
              {m} miles
            </Button>
          ))}
        </div>
      }
    >
      {isFetching && !data ? <p className="text-sm text-muted-foreground">Checking calendars…</p> : null}
      {data && !data.ok ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{data.message}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : null}
      {data && data.ok && homes.length === 0 ? (
        <p className="text-sm">No homes are free inside this distance. Try a wider distance.</p>
      ) : null}
      {data && data.ok && homes.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((h) => {
              const on = picked.some((p) => p.id === h.id);
              return (
                <div key={h.id} className={`rounded-lg border p-3 ${on ? "border-primary" : "border-border"}`}>
                  <div className="font-semibold">{h.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {[h.bedrooms ? `${h.bedrooms} bed` : null, h.bathrooms ? `${h.bathrooms} bath` : null, `${h.distanceMiles} miles away`].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {h.rent.ok ? `${money(h.rent.monthly)} a month, ${money(h.rent.nightly)} a night` : h.rent.reason}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge tone={h.shortStays ? "waiting" : "resolved"}>{h.tag}</StatusBadge>
                    <Button size="sm" variant={on ? "default" : "outline"} disabled={!editable || !h.rent.ok} onClick={() => toggle(h)}>
                      {on ? "Picked" : "Pick"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <MiniMap center={data.center} homes={shown} picked={picked.map((p) => p.id)} />
        </div>
      ) : null}
      {homes.length > pageSize ? (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => ((p + 1) * pageSize >= homes.length ? 0 : p + 1))}>
            Show me different homes
          </Button>
        </div>
      ) : null}
    </SectionCard>
  );
}

/** A simple map: the search place in the middle, each home as a dot. */
function MiniMap({ center, homes, picked }: { center: { lat: number; lng: number }; homes: Home[]; picked: string[] }) {
  const located = homes.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
  const span = Math.max(0.05, ...located.map((h) => Math.max(Math.abs(h.lat - center.lat), Math.abs(h.lng - center.lng))));
  const pos = (lat: number, lng: number) => ({ x: 50 + ((lng - center.lng) / span) * 42, y: 50 - ((lat - center.lat) / span) * 42 });
  return (
    <svg viewBox="0 0 100 100" className="aspect-square w-full rounded-lg border border-border bg-secondary/40" role="img" aria-label="Map of the homes">
      <circle cx="50" cy="50" r="3" className="fill-coral" />
      {located.map((h) => {
        const p = pos(h.lat, h.lng);
        return (
          <circle key={h.id} cx={p.x} cy={p.y} r="2.2" className={picked.includes(h.id) ? "fill-primary" : "fill-muted-foreground"}>
            <title>{h.name}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function Reply({ d, editable, picked, onDone }: { d: Detail; editable: boolean; picked: Home[]; onDone: () => void }) {
  const lead = d.lead;
  const submit = useServerFn(submitDirectBookingReply);
  const byHand = useServerFn(markDirectBookingSentByHand);
  const template = d.templates.find((t) => t.name === "Direct booking reply");
  const dates = [lead.desired_move_in, lead.desired_check_out].filter(Boolean).join(" to ");
  const built = useMemo(() => {
    const values = {
      contact_name: lead.contact_name ?? "there",
      dates: dates || "your dates",
      homes: homeLines(picked.map((h) => ({ name: h.name, bedrooms: h.bedrooms, bathrooms: h.bathrooms, monthly: h.rent.ok ? h.rent.monthly : 0, nightly: h.rent.ok ? h.rent.nightly : 0 }))),
      fees: feeLines({
        cleaningFee: d.source?.cleaning_fee ?? null,
        applicationFee: d.source?.application_fee ?? null,
        petFeePerDog: d.source?.pet_fee_per_pet ?? null,
        dogs: lead.dogs ?? 0,
        deposit: d.source?.security_deposit ?? null,
      }).join("\n"),
      sender_name: d.names[lead.owned_by ?? ""] ?? "",
    };
    return {
      subject: fillTemplate(template?.subject ?? "Homes for {{dates}}", values),
      body: fillTemplate(template?.body ?? DEFAULT_REPLY_TEMPLATE, values),
    };
  }, [picked, lead, d, template, dates]);
  const [to, setTo] = useState(lead.reply_to ?? lead.email ?? "");
  const [cc, setCc] = useState((lead.reply_cc ?? d.ccEmails).join(", "));
  const [subject, setSubject] = useState(lead.reply_subject ?? built.subject);
  const [body, setBody] = useState(lead.reply_body ?? built.body);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && !lead.reply_body) {
      setSubject(built.subject);
      setBody(built.body);
    }
  }, [built, touched, lead.reply_body]);
  const [busy, setBusy] = useState(false);
  const [notSent, setNotSent] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await submit({
        data: { id: lead.id, to, cc: cc.split(",").map((s) => s.trim()).filter(Boolean), subject, body, propertyIds: picked.map((p) => p.id) },
      });
      if (r.state === "waiting_approval") toast.success("Sent for approval. The Operations Supervisor has been alerted.");
      else if (r.state === "sent") toast.success("Reply sent.");
      else {
        setNotSent(true);
        toast.warning(`${r.detail} Copy the reply and send it from Outlook, then press "I sent it".`);
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  const showManual = !lead.reply_sent_at && (notSent || !d.mailboxConnected) && lead.owned_by === d.me && !d.pending;
  if (lead.reply_sent_at) return null;
  return (
    <SectionCard title="3. The reply" description="Filled from the Direct booking reply template. Change anything you need.">
      <div className="grid gap-3">
        <div className="space-y-1"><Label>To</Label><Input value={to} onChange={(e) => setTo(e.target.value)} disabled={!editable} /></div>
        <div className="space-y-1"><Label>Subject</Label><Input value={subject} onChange={(e) => { setSubject(e.target.value); setTouched(true); }} disabled={!editable} /></div>
        <div className="space-y-1"><Label>Cc</Label><Input value={cc} onChange={(e) => setCc(e.target.value)} disabled={!editable} /></div>
        <Textarea value={body} onChange={(e) => { setBody(e.target.value); setTouched(true); }} rows={14} disabled={!editable} />
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {showManual ? (
          <>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(`To: ${to}\nCc: ${cc}\nSubject: ${subject}\n\n${body}`).then(() => toast.success("Copied."))}>
              Copy reply
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                try {
                  await byHand({ data: { id: lead.id } });
                  toast.success("Reply sent.");
                  onDone();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not save.");
                }
              }}
            >
              I sent it
            </Button>
          </>
        ) : null}
        {editable ? (
          <Button disabled={busy || picked.length === 0 || !to} onClick={send}>
            {d.approvalRequiredNow ? "Send for approval" : "Send reply"}
          </Button>
        ) : null}
      </div>
      {editable && picked.length === 0 ? <p className="mt-2 text-right text-xs text-muted-foreground">Pick at least one home first.</p> : null}
    </SectionCard>
  );
}

function SentState({ d, refetch }: { d: Detail; refetch: () => void }) {
  const lead = d.lead;
  const outcome = useServerFn(markDirectBookingOutcome);
  const followUp = useServerFn(sendDirectBookingFollowUp);
  const [booked, setBooked] = useState(false);
  const [notBooked, setNotBooked] = useState(false);
  const [follow, setFollow] = useState(false);
  const [home, setHome] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const template = d.templates.find((t) => t.name === "Direct booking follow-up");
  const dates = [lead.desired_move_in, lead.desired_check_out].filter(Boolean).join(" to ");
  const values = { contact_name: lead.contact_name ?? "there", dates: dates || "your dates", sender_name: d.names[d.me] ?? "" };
  const [fuBody, setFuBody] = useState(fillTemplate(template?.body ?? DEFAULT_FOLLOW_UP_TEMPLATE, values));
  const [fuCc, setFuCc] = useState((lead.reply_cc ?? d.ccEmails).join(", "));
  const sentBy = d.names[lead.reply_sent_by ?? ""] ?? "A teammate";
  const save = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.success(done);
      setBooked(false);
      setNotBooked(false);
      setFollow(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  };
  return (
    <SectionCard tone="default">
      <p className="font-medium">Reply sent.</p>
      <p className="text-sm text-muted-foreground">
        {sentBy} sent it {new Date(lead.reply_sent_at!).toLocaleString()}
        {lead.reply_sent_via === "manual" ? " from Outlook" : ""}.
        {lead.last_follow_up_at ? ` Last follow-up ${new Date(lead.last_follow_up_at).toLocaleString()}.` : ""}
      </p>
      {lead.outcome ? (
        <p className="mt-2 text-sm">{lead.outcome === "booked" ? "Booked. Well done." : `Not booked: ${lead.not_booked_reason}. ${lead.not_booked_note ?? ""}`}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => setBooked(true)}>Mark as booked</Button>
          <Button variant="outline" onClick={() => setNotBooked(true)}>Mark as not booked</Button>
          <Button variant="outline" onClick={() => setFollow(true)}>Follow up</Button>
        </div>
      )}

      <Dialog open={booked} onOpenChange={setBooked}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as booked</DialogTitle></DialogHeader>
          <Label>Which home (optional)</Label>
          <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={home} onChange={(e) => setHome(e.target.value)}>
            <option value="">Not sure yet</option>
            {(lead.offered_property_ids ?? []).map((id, i) => (
              <option key={id} value={id}>Home {i + 1} in the reply</option>
            ))}
          </select>
          <Label>Move-in date (optional)</Label>
          <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
          <div className="flex justify-end">
            <Button onClick={() => save(() => outcome({ data: { id: lead.id, outcome: "booked", propertyId: home || null, moveIn: moveIn || null } }), "Marked as booked.")}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={notBooked} onOpenChange={setNotBooked}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as not booked</DialogTitle></DialogHeader>
          <Label>Reason</Label>
          <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {NOT_BOOKED_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Label>Short note</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
          <div className="flex justify-end">
            <Button disabled={!reason || !note.trim()} onClick={() => save(() => outcome({ data: { id: lead.id, outcome: "not_booked", reason, note } }), "Marked as not booked.")}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={follow} onOpenChange={setFollow}>
        <DialogContent>
          <DialogHeader><DialogTitle>Follow up</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Goes in the same email thread.</p>
          <Label>Cc</Label>
          <Input value={fuCc} onChange={(e) => setFuCc(e.target.value)} />
          <Textarea value={fuBody} onChange={(e) => setFuBody(e.target.value)} rows={8} />
          <div className="flex flex-wrap justify-end gap-2">
            {!d.mailboxConnected ? (
              <>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(fuBody).then(() => toast.success("Copied."))}>Copy reply</Button>
                <Button variant="outline" onClick={() => save(() => followUp({ data: { id: lead.id, to: lead.reply_to ?? lead.email ?? "", cc: fuCc.split(",").map((s) => s.trim()).filter(Boolean), subject: `Re: ${lead.reply_subject ?? ""}`, body: fuBody, byHand: true } }), "Follow-up saved.")}>I sent it</Button>
              </>
            ) : (
              <Button
                onClick={() =>
                  save(async () => {
                    const r = await followUp({ data: { id: lead.id, to: lead.reply_to ?? lead.email ?? "", cc: fuCc.split(",").map((s) => s.trim()).filter(Boolean), subject: `Re: ${lead.reply_subject ?? ""}`, body: fuBody, byHand: false } });
                    if (r.state !== "sent") throw new Error(`${r.detail} Copy it and send from Outlook.`);
                  }, "Follow-up sent.")
                }
              >
                Send follow-up
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
