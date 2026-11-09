import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { StatusBadge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  checkDirectBookingApprovals,
  checkDirectBookingPartnerReply,
  decideDirectBookingApproval,
  getDirectBooking,
  markDirectBookingOutcome,
  markDirectBookingPartnerApproved,
  markDirectBookingSentByHand,
  saveDirectBookingDetails,
  searchDirectBookingHomes,
  sendDirectBookingFollowUp,
  startDirectBooking,
  submitDirectBookingReply,
} from "@/lib/direct-bookings.functions";
import {
  CC_ROLE_LINE,
  clockLabel,
  DB_COPY,
  DEFAULT_FOLLOW_UP_TEMPLATE,
  DEFAULT_REPLY_SUBJECT,
  DEFAULT_REPLY_TEMPLATE,
  DEFAULT_SEARCH_DISTANCE,
  fillTemplate,
  followUpDueAt,
  longDate,
  MAX_HOMES,
  money,
  NOT_BOOKED_REASONS,
  replyClock,
  clockStart,
  replyValues,
  requestStatus,
  SEARCH_DISTANCES,
  statusChip,
  type SearchDistance,
} from "@/lib/direct-bookings";

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

/** Every field and button on this page is at least 44px tall. */
const FIELD = "h-11 text-sm";
const BTN = "min-h-11 px-4 font-semibold";
const BIG = "min-h-12 px-6 text-[15px] font-semibold";

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
  // The 2 minute rule also runs on the server on its own schedule; this is a second check while the page is open.
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
    <div>
      <Button variant="outline" className={cn(BTN, "border-primary text-primary")} asChild>
        <Link to="/direct-bookings">{DB_COPY.back}</Link>
      </Button>
    </div>
  );
}

function Panel({ tone, children }: { tone: "green" | "amber" | "plain"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl border p-[18px]",
        tone === "green" && "border-sage/40 bg-sage/10",
        tone === "amber" && "border-amber/40 bg-amber/10",
        tone === "plain" && "border-border bg-card",
      )}
    >
      {children}
    </div>
  );
}

function Section({ title, hint, actions, children }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-base">{title}</strong>
        {actions}
      </div>
      {hint ? <span className="text-[13px] text-muted-foreground">{hint}</span> : null}
      {children}
    </section>
  );
}

function RequestView({ d, refetch }: { d: Detail; refetch: () => void }) {
  const lead = d.lead;
  const now = useNow();
  const status = requestStatus({ ...lead, pending_approval: Boolean(d.pending) });
  const chip = statusChip(status, lead, now, d.settings.replyTargetMinutes, d.settings.overnightClockStart);
  const mine = lead.owned_by === d.me;
  const editable = mine && !lead.reply_sent_at && !d.pending;
  const partner = lead.partner_name || lead.company || lead.contact_name || "Partner not named yet";
  const start = useServerFn(startDirectBooking);
  const [picked, setPicked] = useState<Home[]>([]);
  const [lostOpen, setLostOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
      <BackLink />
      <div className={cn("flex flex-col gap-1.5 rounded-2xl border bg-card p-4", chip.late ? "border-destructive/60" : "border-border")}>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] font-semibold">{partner}</h1>
          <StatusBadge tone={chip.tone} className="text-[13px] font-semibold">{chip.text}</StatusBadge>
        </div>
        <span className="text-sm text-muted-foreground">{lead.subject || "Request entered by hand"}</span>
      </div>

      {!lead.owned_by ? (
        <Panel tone="amber">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">{DB_COPY.notOwned}</span>
            <Button
              className={BIG}
              onClick={async () => {
                const r = await start({ data: { id: lead.id } }).catch((e: Error) => (toast.error(e.message), null));
                if (r && !r.won) toast.info(DB_COPY.someoneElseOwns);
                refetch();
              }}
            >
              {DB_COPY.startQuote}
            </Button>
          </div>
        </Panel>
      ) : !mine && !lead.reply_sent_at ? (
        <p className="text-sm text-muted-foreground">{DB_COPY.ownedByOther}</p>
      ) : null}

      {lead.reply_sent_at ? <SentBanner d={d} /> : null}
      {lostOpen && !lead.outcome ? <NotBookedPanel d={d} onClose={() => setLostOpen(false)} onDone={refetch} /> : null}
      {status === "partner_approved" ? <ApprovedPanel d={d} onLost={() => setLostOpen(true)} onDone={refetch} /> : null}
      {status === "sent" ? <FollowUpPanel d={d} onLost={() => setLostOpen(true)} onDone={refetch} /> : null}
      {lead.outcome ? <OutcomeLine d={d} /> : null}
      {d.pending ? <ApprovalBanner d={d} refetch={refetch} /> : null}
      {d.lastSentBack && !d.pending && !lead.reply_sent_at ? (
        <Panel tone="amber">
          <span className="text-sm">Sent back to edit: {d.lastSentBack.note}</span>
        </Panel>
      ) : null}

      <AskedFor d={d} editable={editable} onSaved={refetch} />
      <PickHomes d={d} editable={editable} picked={picked} setPicked={setPicked} />
      <ReplySection d={d} editable={editable} picked={picked} partner={partner} onDone={refetch} />
    </div>
  );
}

function SentBanner({ d }: { d: Detail }) {
  const lead = d.lead;
  const took = replyClock(clockStart(lead, d.settings.overnightClockStart), lead.reply_sent_at, new Date(), d.settings.replyTargetMinutes);
  const due = followUpDueAt(lead);
  const parts = [
    `Sent in ${clockLabel(took.seconds)}${lead.reply_sent_via === "manual" ? " from Outlook" : ""}.`,
    lead.last_follow_up_at ? `Last follow-up ${new Date(lead.last_follow_up_at).toLocaleString()}.` : null,
    !lead.outcome && !lead.partner_approved_at && due ? `Follow up ${new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.` : null,
  ].filter(Boolean);
  return (
    <div className="rounded-2xl border border-sage/40 bg-sage/10 p-[18px] text-[15px]">
      <strong>{DB_COPY.replySent}</strong> {parts.join(" ")}
    </div>
  );
}

function OutcomeLine({ d }: { d: Detail }) {
  const lead = d.lead;
  return (
    <Panel tone="plain">
      <span className="text-[15px]">
        {lead.outcome === "booked" ? "Booked. Well done." : `Not booked: ${lead.not_booked_reason ?? ""}. ${lead.not_booked_note ?? ""}`}
      </span>
    </Panel>
  );
}

function NotBookedPanel({ d, onClose, onDone }: { d: Detail; onClose: () => void; onDone: () => void }) {
  const outcome = useServerFn(markDirectBookingOutcome);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const off = busy || !reason || !note.trim();
  return (
    <Panel tone="amber">
      <strong className="text-base">{DB_COPY.lostTitle}</strong>
      <span className="text-[13px]">{DB_COPY.lostHint}</span>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-xs">
          Reason
          <select className={cn(FIELD, "min-w-[240px] rounded-md border border-input bg-background px-2.5")} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {NOT_BOOKED_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex flex-[1_1_260px] flex-col gap-1 text-xs">
          Short note
          <Input className={FIELD} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className={BIG}
          disabled={off}
          onClick={async () => {
            setBusy(true);
            try {
              await outcome({ data: { id: d.lead.id, outcome: "not_booked", reason, note } });
              toast.success("Saved as not booked.");
              onClose();
              onDone();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not save.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {DB_COPY.lostSave}
        </Button>
        <Button variant="outline" className={BIG} onClick={onClose}>Cancel</Button>
      </div>
    </Panel>
  );
}

function ApprovedPanel({ d, onLost, onDone }: { d: Detail; onLost: () => void; onDone: () => void }) {
  const outcome = useServerFn(markDirectBookingOutcome);
  const offered = d.offeredHomes;
  const [asking, setAsking] = useState(false);
  // One home offered: it is that home. Several: the coordinator picks, or leaves it as not sure yet.
  const [home, setHome] = useState(offered.length === 1 ? offered[0]!.id : "");
  const [moveIn, setMoveIn] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await outcome({ data: { id: d.lead.id, outcome: "booked", propertyId: home || null, moveIn: moveIn || null } });
      toast.success("Marked as booked.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel tone="green">
      <strong className="text-base">{DB_COPY.approvedTitle}</strong>
      {d.lead.partner_approved_note ? <span className="text-sm">{d.lead.partner_approved_note}</span> : null}
      {asking ? (
        <div className="flex flex-wrap items-end gap-2.5">
          {offered.length > 1 ? (
            <label className="flex flex-col gap-1 text-xs">
              {DB_COPY.bookedHome}
              <select className={cn(FIELD, "min-w-[260px] rounded-md border border-input bg-background px-2.5")} value={home} onChange={(e) => setHome(e.target.value)}>
                <option value="">{DB_COPY.bookedHomeUnknown}</option>
                {offered.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs">
            {DB_COPY.bookedMoveIn}
            <Input type="date" className={cn(FIELD, "w-[190px]")} value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {asking ? (
          <>
            <Button className={BIG} disabled={busy} onClick={save}>{DB_COPY.bookedSave}</Button>
            <Button variant="outline" className={BIG} disabled={busy} onClick={() => setAsking(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <Button className={BIG} onClick={() => setAsking(true)}>{DB_COPY.markBooked}</Button>
            <Button variant="outline" className={cn(BIG, "border-primary text-primary")} onClick={onLost}>{DB_COPY.markNotBooked}</Button>
          </>
        )}
      </div>
    </Panel>
  );
}

function FollowUpPanel({ d, onLost, onDone }: { d: Detail; onLost: () => void; onDone: () => void }) {
  const lead = d.lead;
  const followUp = useServerFn(sendDirectBookingFollowUp);
  const approved = useServerFn(markDirectBookingPartnerApproved);
  const checkReply = useServerFn(checkDirectBookingPartnerReply);
  const suggestion = useQuery({
    queryKey: ["direct-booking-partner-reply", lead.id],
    queryFn: () => checkReply({ data: { id: lead.id } }),
    enabled: d.mailboxConnected,
    refetchInterval: 60_000,
  });
  const template = d.templates.find((t) => t.name === "Direct booking follow-up");
  const dates = [lead.desired_move_in, lead.desired_check_out].filter(Boolean).map((x) => longDate(x!)).join(" to ");
  const values = { contact_name: lead.contact_name ?? "there", dates: dates || "your dates", sender_name: d.myName };
  const [body, setBody] = useState(() => fillTemplate(template?.body ?? DEFAULT_FOLLOW_UP_TEMPLATE, values));
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  const confirmApproved = (note?: string) => run(() => approved({ data: { id: lead.id, note } }), "Moved to Approved.");
  const hit = suggestion.data && suggestion.data.suggest ? suggestion.data : null;
  return (
    <>
      {hit ? (
        <Panel tone="green">
          <strong className="text-base">{DB_COPY.suggestion}</strong>
          <span className="whitespace-pre-wrap text-sm">{hit.excerpt}</span>
          <div className="flex flex-wrap gap-2">
            <Button className={BIG} disabled={busy} onClick={() => confirmApproved(hit.excerpt)}>{DB_COPY.suggestionYes}</Button>
          </div>
        </Panel>
      ) : null}
      <Panel tone="plain">
        <strong className="text-base">{DB_COPY.followTitle}</strong>
        <span className="text-[13px] text-muted-foreground">{DB_COPY.followHint}</span>
        <Textarea aria-label="Follow-up" className="min-h-[110px] text-sm leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {d.mailboxConnected ? (
            <Button
              className={BIG}
              disabled={busy || !body.trim()}
              onClick={() =>
                run(async () => {
                  const r = await followUp({ data: { id: lead.id, body, byHand: false } });
                  if (r.state !== "sent") throw new Error(`${r.detail} Copy it and send from Outlook.`);
                }, "Follow-up sent.")
              }
            >
              {DB_COPY.followSend}
            </Button>
          ) : (
            <>
              <Button variant="outline" className={BIG} onClick={() => navigator.clipboard.writeText(body).then(() => toast.success("Copied."))}>Copy follow-up</Button>
              <Button className={BIG} disabled={busy} onClick={() => run(() => followUp({ data: { id: lead.id, body, byHand: true } }), "Follow-up saved.")}>I sent it</Button>
            </>
          )}
          <Button variant="outline" className={cn(BIG, "border-primary text-primary")} onClick={onLost}>{DB_COPY.markNotBooked}</Button>
          <Button variant="outline" className={cn(BIG, "border-primary text-primary")} disabled={busy} onClick={() => confirmApproved()}>{DB_COPY.partnerApproved}</Button>
        </div>
      </Panel>
    </>
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
      else if (r.state === "approved_not_sent") toast.warning(`Approved. ${r.detail} The coordinator can copy the reply and send it from Outlook.`);
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
    <Panel tone="amber">
      <strong className="text-base">{d.canApprove ? DB_COPY.approvalTitleSupervisor : DB_COPY.approvalTitleOthers}</strong>
      {d.canApprove ? (
        <>
          <span className="text-sm">{DB_COPY.approvalSupervisor}</span>
          <div className="flex flex-wrap gap-2">
            <Button className={cn(BIG, "bg-sage text-primary-foreground hover:bg-sage/90")} disabled={busy} onClick={() => run("approved")}>{DB_COPY.approve}</Button>
            <Button variant="outline" className={cn(BIG, "border-primary text-primary")} disabled={busy} onClick={() => setBackOpen(true)}>{DB_COPY.sendBack}</Button>
          </div>
          {backOpen ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs">
                What should change?
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </label>
              <div>
                <Button className={BTN} disabled={busy || !note.trim()} onClick={() => run("sent_back")}>Send back</Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <span className="text-sm">{DB_COPY.approvalOthers}</span>
      )}
    </Panel>
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
      asap: lead.asap ? "yes" : "no",
      move_in: lead.desired_move_in ?? "",
      stay_length: lead.stay_length ?? "",
      move_out: lead.desired_check_out ?? "",
      bedrooms: lead.bedrooms?.toString() ?? "",
      preferred_bedrooms: lead.preferred_bedrooms?.toString() ?? "",
      bathrooms: lead.min_bathrooms?.toString() ?? "",
      guests: lead.guests?.toString() ?? "",
      dogs: lead.dogs?.toString() ?? "",
      cats: lead.cats?.toString() ?? "",
      near_address: lead.near_address ?? "",
      distance_wanted: lead.distance_wanted ?? "",
      requirements: lead.requirements ?? "",
      inquiry_source_id: lead.inquiry_source_id ?? "",
    }),
    [lead],
  );
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const field = (label: string, k: keyof typeof f, type = "text", extra?: { placeholder?: string; help?: string }) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Input aria-label={label} className={cn(FIELD, "text-foreground")} type={type} value={f[k]} onChange={set(k)} disabled={!editable} placeholder={extra?.placeholder} />
      {extra?.help ? <span>{extra.help}</span> : null}
    </label>
  );
  const select = (label: string, k: keyof typeof f, options: { value: string; label: string }[]) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select aria-label={label} className={cn(FIELD, "w-full rounded-md border border-input bg-background px-2.5 text-foreground")} value={f[k]} onChange={set(k)} disabled={!editable}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
  return (
    <Section title={DB_COPY.askedTitle} hint={DB_COPY.askedHint}>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {field("Partner", "partner_name")}
        {select("Referral source", "inquiry_source_id", [{ value: "", label: "Not chosen" }, ...d.sources.map((s) => ({ value: s.id, label: s.name }))])}
        {field("Contact name", "contact_name")}
        {field("Email", "email")}
        {field("Phone", "phone")}
        {field(DB_COPY.whereLabel, "location", "text", { placeholder: DB_COPY.wherePlaceholder, help: DB_COPY.whereHelp })}
        {select("As soon as possible", "asap", [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }])}
        {field("Move in", "move_in", "date")}
        {field("Length of stay", "stay_length")}
        {field("Move out", "move_out", "date")}
        {field("Bedrooms (at least)", "bedrooms", "number")}
        {field("Preferred bedrooms", "preferred_bedrooms", "number")}
        {field("Bathrooms (at least)", "bathrooms", "number")}
        {field("People", "guests", "number")}
        {field("Dogs", "dogs", "number")}
        {field("Cats", "cats", "number")}
        {field("Near this address", "near_address")}
        {field("Distance wanted", "distance_wanted")}
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Notes
        <Textarea className="text-sm text-foreground" value={f.requirements} onChange={set("requirements")} rows={3} disabled={!editable} />
      </label>
      {editable ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className={BTN}
            onClick={async () => {
              try {
                const r = await save({
                  data: {
                    id: lead.id,
                    partner_name: f.partner_name, contact_name: f.contact_name, email: f.email, phone: f.phone,
                    location: f.location, move_in: f.move_in, move_out: f.move_out, requirements: f.requirements,
                    bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), guests: num(f.guests),
                    dogs: num(f.dogs), cats: num(f.cats), inquiry_source_id: f.inquiry_source_id || null,
                    asap: f.asap === "yes", stay_length: f.stay_length, preferred_bedrooms: num(f.preferred_bedrooms),
                    near_address: f.near_address, distance_wanted: f.distance_wanted,
                  },
                });
                if (r.extraSaved) toast.success("Saved.");
                else toast.warning("Saved. As soon as possible, length of stay, preferred bedrooms, the address and the distance are not saved yet.");
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
    </Section>
  );
}

function checkedLine(checkedAt: string, now: Date) {
  const mins = Math.floor((now.getTime() - Date.parse(checkedAt)) / 60_000);
  const when = mins < 1 ? "just now" : `${mins} minute${mins === 1 ? "" : "s"} ago`;
  return `Checked against OwnerRez ${when}. Best matches first: 30-day firm homes, then other free homes, then homes with 1 or 2 short stays.`;
}

const PAGE_SIZE = 6;

function PickHomes({ d, editable, picked, setPicked }: { d: Detail; editable: boolean; picked: Home[]; setPicked: (h: Home[]) => void }) {
  const search = useServerFn(searchDirectBookingHomes);
  const now = useNow();
  const [distance, setDistance] = useState<SearchDistance>(DEFAULT_SEARCH_DISTANCE);
  const [page, setPage] = useState(0);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["direct-booking-homes", d.lead.id, distance, d.lead.desired_move_in, d.lead.desired_check_out, d.lead.search_region, d.lead.bedrooms, d.lead.inquiry_source_id, d.lead.near_address, d.lead.preferred_bedrooms, d.lead.asap, d.lead.stay_length],
    queryFn: () => search({ data: { id: d.lead.id, distance } }),
    enabled: !d.lead.reply_sent_at,
    staleTime: 60_000,
  });
  const homes = data && data.ok ? data.homes : [];
  const shown = homes.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const full = picked.length >= MAX_HOMES;
  const toggle = (h: Home) => {
    if (picked.some((p) => p.id === h.id)) setPicked(picked.filter((p) => p.id !== h.id));
    else if (!full) setPicked([...picked, h]);
  };
  const different = () => {
    if (homes.length > PAGE_SIZE) setPage((p) => ((p + 1) * PAGE_SIZE >= homes.length ? 0 : p + 1));
    else refetch();
  };
  if (d.lead.reply_sent_at)
    return (
      <Section title={DB_COPY.homesTitle}>
        <span className="text-sm text-muted-foreground">{(d.lead.offered_property_ids ?? []).length} homes were offered in the reply.</span>
      </Section>
    );
  return (
    <Section
      title={DB_COPY.homesTitle}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {DB_COPY.searchWithin}
            <select
              aria-label={DB_COPY.searchWithin}
              className={cn(FIELD, "rounded-md border border-input bg-background px-2.5 text-foreground")}
              value={distance}
              onChange={(e) => { setDistance(Number(e.target.value) as SearchDistance); setPage(0); }}
            >
              {SEARCH_DISTANCES.map((m) => <option key={m} value={m}>{m} miles</option>)}
            </select>
          </label>
          <Button variant="outline" className={cn(BTN, "border-primary text-primary")} onClick={different}>{DB_COPY.differentHomes}</Button>
        </div>
      }
    >
      {data && data.ok ? <span className="text-[13px] text-muted-foreground">{checkedLine(data.checkedAt, now)}</span> : null}
      {isFetching && !data ? <span className="text-sm text-muted-foreground">Checking calendars…</span> : null}
      {data && !data.ok ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{data.message}</span>
          <Button variant="outline" className={BTN} onClick={() => refetch()}>Try again</Button>
        </div>
      ) : null}
      {data && data.ok ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <HomesMap center={data.center} homes={shown} picked={picked.map((p) => p.id)} distance={distance} onPick={(h) => editable && h.rent.ok && toggle(h)} />
          <div className="flex max-h-[340px] flex-col gap-2.5 overflow-y-auto">
            {shown.map((h, i) => {
              const on = picked.some((p) => p.id === h.id);
              const off = !editable || !h.rent.ok || (!on && full);
              return (
                <div key={h.id} data-card="home" className={cn("flex flex-col overflow-hidden rounded-xl border-2", on ? "border-primary bg-primary/5" : "border-border bg-card")}>
                  <HomePhoto url={h.photo} alt={h.address || h.name} className="h-32 w-full shrink-0" />
                  <div className="flex items-start gap-3 p-3">
                  <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">{i + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="text-[15px]">{h.name}</strong>
                    <span className="text-[13px] text-muted-foreground">
                      {[h.bedrooms ? `${h.bedrooms} bed` : null, h.bathrooms ? `${h.bathrooms} bath` : null, `${h.distanceMiles} miles away`].filter(Boolean).join(" · ")}
                    </span>
                    <span className="text-base font-semibold">
                      {h.rent.ok ? `${money(h.rent.monthly)} a month · ${money(h.rent.nightly)} a night` : h.rent.reason}
                    </span>
                    <span className={cn("text-xs", h.shortStays ? "text-amber" : "text-sage")}>{h.tag}</span>
                  </div>
                  <Button
                    variant={on ? "default" : "outline"}
                    className={cn(BTN, !on && "border-primary text-primary", off && !on && "opacity-50")}
                    disabled={off && !on}
                    onClick={() => toggle(h)}
                  >
                    {on ? "Picked" : "Pick"}
                  </Button>
                  </div>
                </div>
              );
            })}
            {homes.length === 0 ? <span className="text-sm text-muted-foreground">{DB_COPY.noHomes}</span> : null}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

/**
 * The search map: a dashed ring for the search distance, a black dot for the
 * search location and numbered pins matching the numbered cards.
 */
function HomesMap({ center, homes, picked, distance, onPick }: { center: { lat: number; lng: number }; homes: Home[]; picked: string[]; distance: number; onPick: (h: Home) => void }) {
  const milesPerLng = 69 * Math.cos((center.lat * Math.PI) / 180);
  const clamp = (n: number) => Math.min(95, Math.max(5, n));
  // The ring is 80% of the square, so its radius (40%) is the search distance.
  const pos = (h: Home) => ({
    x: clamp(50 + (((h.lng - center.lng) * milesPerLng) / distance) * 40),
    y: clamp(50 - (((h.lat - center.lat) * 69) / distance) * 40),
  });
  return (
    <div aria-label="Map of available homes" className="relative h-[340px] overflow-hidden rounded-xl border border-border bg-secondary/60">
      <div className="absolute inset-y-0 left-1/2 aspect-square h-full -translate-x-1/2">
        <div className="absolute left-[10%] top-[10%] h-[80%] w-[80%] rounded-full border-2 border-dashed border-primary opacity-50" />
        <div className="absolute left-1/2 top-1/2 -ml-[7px] -mt-[7px] size-3.5 rounded-full border-2 border-background bg-foreground" />
        {homes.map((h, i) => {
          if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) return null;
          const p = pos(h);
          const on = picked.includes(h.id);
          return (
            <button
              key={h.id}
              type="button"
              aria-label={`Home ${i + 1}: ${h.name}`}
              onClick={() => onPick(h)}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={cn(
                "absolute -ml-[17px] -mt-[17px] size-[34px] rounded-full border-2 border-background text-[13px] font-bold shadow",
                on ? "bg-primary text-primary-foreground" : "bg-card text-primary",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <span className="absolute bottom-2 left-2.5 text-xs text-muted-foreground">{DB_COPY.mapLegend}</span>
    </div>
  );
}

function ReplySection({ d, editable, picked, partner, onDone }: { d: Detail; editable: boolean; picked: Home[]; partner: string; onDone: () => void }) {
  const lead = d.lead;
  const submit = useServerFn(submitDirectBookingReply);
  const byHand = useServerFn(markDirectBookingSentByHand);
  const template = d.templates.find((t) => t.name === "Direct booking reply");
  const dates = [lead.desired_move_in, lead.desired_check_out].filter(Boolean).map((x) => longDate(x!)).join(" to ");
  const built = useMemo(() => {
    const values = replyValues({
      contactName: lead.contact_name,
      senderName: d.myName,
      subject: lead.subject,
      dates,
      addressGiven: Boolean(lead.near_address?.trim()),
      homes: picked.map((h) => ({
        name: h.name,
        address: h.address,
        link: h.link,
        distanceMiles: h.distanceMiles,
        bedrooms: h.bedrooms,
        bathrooms: h.bathrooms,
        availability: h.availability,
        monthly: h.rent.ok ? h.rent.monthly : 0,
        nightly: h.rent.ok ? h.rent.nightly : 0,
      })),
      fees: {
        cleaningFee: d.source?.cleaning_fee ?? null,
        applicationFee: d.source?.application_fee ?? null,
        petFeePerDog: d.source?.pet_fee_per_pet ?? null,
        dogs: lead.dogs ?? 0,
        deposit: d.source?.security_deposit ?? null,
      },
    });
    return {
      subject: fillTemplate(template?.subject ?? DEFAULT_REPLY_SUBJECT, values),
      body: fillTemplate(template?.body ?? DEFAULT_REPLY_TEMPLATE, values),
    };
  }, [picked, lead, d, template, dates]);
  const subject = lead.reply_subject ?? built.subject;
  const [body, setBody] = useState(lead.reply_body ?? built.body);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && !lead.reply_body) setBody(built.body);
  }, [built, touched, lead.reply_body]);
  const [busy, setBusy] = useState(false);
  const [notSent, setNotSent] = useState(false);
  const to = lead.reply_to ?? lead.email ?? "";

  async function send() {
    setBusy(true);
    try {
      const r = await submit({ data: { id: lead.id, subject, body, propertyIds: picked.map((p) => p.id) } });
      if (r.state === "waiting_approval") toast.success("Sent to a supervisor for OK. It sends the moment they approve.");
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
  const help = picked.length === 0 ? DB_COPY.pickFirst : !to ? "Add their email in step 1 first." : d.approvalRequiredNow ? DB_COPY.sendForOkHelp : "";
  return (
    <Section title={DB_COPY.replyTitle} hint={DB_COPY.replyHint(partner)}>
      <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
        <span>To: <strong className="text-foreground">{to || "Add their email in step 1"}</strong></span>
        <span>Subject: <strong className="text-foreground">{subject}</strong></span>
        <span>Cc: <strong className="text-foreground">{CC_ROLE_LINE}</strong></span>
      </div>
      <Textarea
        aria-label="Reply"
        className="min-h-[360px] text-sm leading-relaxed"
        value={body}
        onChange={(e) => { setBody(e.target.value); setTouched(true); }}
        disabled={!editable}
      />
      <div className="flex flex-wrap items-center gap-2.5">
        {editable ? (
          <Button className="min-h-[52px] px-7 text-base font-semibold" disabled={busy || picked.length === 0 || !to} onClick={send}>
            {d.approvalRequiredNow ? DB_COPY.sendForOk : DB_COPY.sendReply}
          </Button>
        ) : null}
        {editable && help ? <span className="text-[13px] text-muted-foreground">{help}</span> : null}
        {showManual ? (
          <>
            <Button variant="outline" className={BTN} onClick={() => navigator.clipboard.writeText(`To: ${to}\nCc: ${d.ccEmails.join(", ")}\nSubject: ${subject}\n\n${body}`).then(() => toast.success("Copied."))}>
              Copy reply
            </Button>
            <Button
              variant="outline"
              className={BTN}
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
      </div>
    </Section>
  );
}
