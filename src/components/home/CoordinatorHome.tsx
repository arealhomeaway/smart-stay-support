import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRole } from '@/hooks/useRole';
import { useDemo } from '@/components/DemoProvider';
import { useHomeTeams } from '@/hooks/useHomeTeam';
import { Button } from '@/components/ui/button';
import { TicketDueLabel } from '@/components/tickets/TicketDueLabel';
import { useTeamBReviews } from '@/components/operations/TeamBReviewRows';
import { RoutineDrawer, type RoutineRow } from '@/components/routines/RoutineDrawer';
import { startRoutineReview } from '@/components/routines/start-routine-review';
import { takeUnownedTicket } from '@/components/operations/take-unowned-ticket';
import { TicketHandoffsQueue, loadHandoffsForMe, handoffsKey } from '@/components/operations/TicketHandoffsQueue';
import { type DoneEntry } from '@/components/operations/QueueRow';
import { useMyShift } from '@/components/home/MyShift';
import { ShiftHandoffDialog, type WalkTicket } from '@/components/home/ShiftHandoffDialog';
import { NeedsYouNowPanel, type NeedsPanelItem } from '@/components/home/NeedsYouNowPanel';
import { myDirectBookings, startDirectBooking } from '@/lib/direct-bookings.functions';
import { myOwnerFollowUps } from '@/lib/owner-followups.functions';
import { homeBookingLine, followUpDueAt } from '@/lib/direct-bookings';
import { COORDINATOR_HOME_LIMIT, coordinatorDueSort, coordinatorTakeTickets, coordinatorTicketWork } from '@/lib/coordinator-home';
import { type HomeTicket } from '@/lib/home-work';
import { handoffAt, ticketsToHandOff, myTeamToday } from '@/lib/my-shift';
import { formatPropertyLabel } from '@/lib/property-label';
import { DEFAULT_QUEUE_TIMING } from '@/lib/team-queue-board';
import { isEmailTestTicket } from '@/lib/email-intake';

type WorkLine = { id: string; title: string; property: string; due: string | null; content: ReactNode; take?: () => Promise<void> };

function HomeSection({ title, empty, rows, seeAll, busy, onTake, readOnly = false }: {
  title: string; empty: string; rows: WorkLine[]; seeAll: ReactNode;
  busy: string | null; onTake: (r: WorkLine) => void; readOnly?: boolean;
}) {
  return <section aria-label={title} className="space-y-2 border-t border-border pt-5">
    <h2 className="text-lg font-semibold">{title}</h2>
    {rows.length === 0 ? <p className="py-2 text-sm text-muted-foreground">{empty}</p> :
      <ul className="divide-y divide-border">{rows.slice(0, COORDINATOR_HOME_LIMIT).map(r =>
        <li key={r.id} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">{r.content}</div>
          {r.take && <Button variant="outline" className="min-h-11 shrink-0" disabled={readOnly || busy !== null} onClick={() => onTake(r)}>{busy === r.id ? 'Taking...' : 'Take it'}</Button>}
        </li>)}</ul>}
    {rows.length > COORDINATOR_HOME_LIMIT && seeAll}
  </section>;
}

function lineContent(title: string, property: string, due: string | null, locked = false) {
  return <><span className="block text-sm text-muted-foreground">{property}</span>
    <span className="block break-words font-medium">{title}</span>
    <TicketDueLabel dueOn={due} locked={locked} /><ArrowRight className="ml-2 inline size-4 text-muted-foreground" aria-hidden="true" /></>;
}
const ROW_CLASS = 'min-h-11 h-auto w-full justify-start whitespace-normal rounded-none px-0 py-1 text-left text-foreground hover:text-foreground';

export function CoordinatorHome({ rows, userId, team, walkRows, originSearch }: {
  rows: HomeTicket[]; userId: string; team: string | null; walkRows: WalkTicket[]; originSearch: { from: string };
}) {
  const role = useRole();
  const { demoMode, demoReady } = useDemo();
  const qc = useQueryClient();
  const { homeTeamOf } = useHomeTeams();
  const [busy, setBusy] = useState<string | null>(null);
  const [routine, setRoutine] = useState<RoutineRow | null>(null);
  const [panel, setPanel] = useState<NeedsPanelItem | null>(null);
  const [done, setDone] = useState<Record<string, DoneEntry>>({});
  const [walking, setWalking] = useState(false);
  const shift = useMyShift(userId, true);
  const at = shift.data?.shift ? handoffAt('end_of_shift', shift.data.shift) : new Date().toISOString();
  const untilMs = Date.parse(at) + 2 * 3600_000;
  const fetchBookings = useServerFn(myDirectBookings);
  const startBooking = useServerFn(startDirectBooking);
  const fetchOwnerWork = useServerFn(myOwnerFollowUps);
  // Reuse the current Team Queue read and key, with no new scope or backend rule.
  const queue = useQuery({ queryKey: ['team-queue', demoMode], enabled: demoReady, refetchInterval: 60_000,
    queryFn: async () => {
      const r = await supabase.from('tickets').select('*, properties(name, nickname, market, city, state, address_line1, unit, postal_code, ownerrez_property_id, time_zone, lifecycle_status), work_types(name, functional_role_code, action_start_minutes), claims(id), handoff_carryovers(ticket_id)')
        .eq('is_demo', demoMode).is('archived_at', null).order('reported_at', { ascending: false });
      if (r.error) throw r.error;
      return r.data as unknown as HomeTicket[];
    } });
  const reviews = useTeamBReviews(demoMode, demoReady);
  const bookings = useQuery({ queryKey: ['my-direct-bookings', demoMode], enabled: role.can('direct_bookings_work'),
    queryFn: () => fetchBookings({ data: { demo: demoMode } }), refetchInterval: 15_000 });
  const ownerWork = useQuery({ queryKey: ['owner-followups'], queryFn: () => fetchOwnerWork() });
  const approvals = useQuery({ queryKey: ['home-my-approvals', demoMode, userId], staleTime: 30_000,
    queryFn: async () => {
      const r = await supabase.from('approvals').select('id, title, entity_type, entity_id, created_at')
        .eq('status', 'pending').eq('approver_id', userId).eq('is_demo', demoMode).order('created_at', { ascending: true }).limit(50);
      if (r.error) throw r.error;
      return r.data ?? [];
    } });
  const handoffs = useQuery({ queryKey: handoffsKey(userId, demoMode), enabled: demoReady,
    queryFn: () => loadHandoffsForMe(userId, demoMode), refetchInterval: 60_000 });
  const my: WorkLine[] = [];
  const take: WorkLine[] = [];
  const ticketLine = (t: HomeTicket): WorkLine => {
    const title = t.title ?? 'Ticket'; const property = formatPropertyLabel(t.properties).primary;
    const due = t.due_on ?? (t.due_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(t.due_at)) : null);
    return { id: `ticket:${t.id}`, title, property, due,
      content: <Button asChild variant="ghost" className={ROW_CLASS}><Link to="/tickets/$ticketId" params={{ ticketId: t.id }} search={originSearch}><span>{lineContent(title, property, due, Boolean(t.due_locked))}</span></Link></Button> };
  };
  for (const t of coordinatorTicketWork(rows, userId).filter(t => !isEmailTestTicket(t as never))) my.push(ticketLine(t));
  const rank: Record<string, number> = { p1: 0, p2: 1, p3: 2 };
  for (const t of coordinatorTakeTickets(queue.data ?? [], team).filter(t => !isEmailTestTicket(t as never))
    .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || (a.reported_at ?? '').localeCompare(b.reported_at ?? ''))) {
    take.push({ ...ticketLine(t), take: async () => { if (!await takeUnownedTicket(t, userId)) throw new Error('Someone else took it first.'); } });
  }
  for (const r of reviews.data?.routines.values() ?? []) {
    if (!['due', 'in_progress'].includes(r.status)) continue;
    const title = r.title; const property = formatPropertyLabel(r.properties).primary;
    const due = r.due_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(r.due_at)) : null;
    const item: WorkLine = { id: `routine:${r.id}`, title, property, due,
      content: <Button variant="ghost" className={ROW_CLASS} onClick={() => setRoutine(r)}><span>{lineContent(title, property, due)}</span></Button> };
    if (r.assigned_to === userId) my.push(item);
    else if (!r.assigned_to && team === 'property_operations') take.push({ ...item, take: () => startRoutineReview(r) });
  }
  const waitingBookings: WorkLine[] = [];
  for (const r of bookings.data ?? []) {
    const title = r.partner_name || r.company || r.subject || 'Direct booking';
    const dueAt = r.reply_sent_at ? followUpDueAt(r) : r.created_at;
    const due = dueAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(dueAt)) : null;
    const item: WorkLine = { id: `booking:${r.id}`, title, property: '', due,
      content: <Button variant="ghost" className={ROW_CLASS} onClick={() => setPanel({ kind: 'booking', id: `booking:${r.id}`, title, detail: homeBookingLine(r), bookingId: r.id })}><span>{lineContent(title, '', due)}</span></Button> };
    if (r.owned_by === userId) my.push(item);
    else if (team === 'guest_experience' && r.waitingForStart) waitingBookings.push({ ...item, take: async () => {
      const result = await startBooking({ data: { id: r.id } });
      if (!result.won) throw new Error('Someone else took it first.');
    } });
  }
  for (const r of ownerWork.data?.rows ?? []) my.push({ id: `owner:${r.id}`, title: r.title, property: '', due: null,
    content: <Button asChild variant="ghost" className={ROW_CLASS}><a href={r.link_path}><span>{lineContent(r.title, '', null)}</span></a></Button> });
  for (const a of approvals.data ?? []) my.push({ id: `approval:${a.id}`, title: a.title ?? 'Approval', property: '', due: null,
    content: <Button variant="ghost" className={ROW_CLASS} onClick={() => setPanel({ kind: 'approval', id: `approval:${a.id}`, title: a.title ?? 'Approval', detail: 'Waiting for your approval', approvalId: a.id, ticketId: a.entity_type === 'ticket' ? a.entity_id : null })}><span>{lineContent(a.title ?? 'Approval', '', null)}</span></Button> });
  my.sort(coordinatorDueSort);
  take.unshift(...waitingBookings);
  async function onTake(r: WorkLine) {
    if (role.readOnly || !r.take) return;
    setBusy(r.id);
    try { await r.take(); toast.success('You have it.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Not taken. Try again.'); }
    finally { setBusy(null); await Promise.all(['team-queue', 'home-my-work', 'team-b-reviews', 'routine-controls', 'my-direct-bookings'].map(key => qc.invalidateQueries({ queryKey: [key] }))); }
  }
  const ownTeam = team === 'guest_experience' ? 'a' : team === 'property_operations' ? 'b' : undefined;
  const seeAll = (mine: boolean) => <Button asChild variant="link" className="min-h-11 px-0"><Link to="/team-queue" search={mine ? { lens: 'mine' } : { ...(ownTeam ? { team: ownTeam } : {}) }}>See all <ArrowRight aria-hidden="true" /></Link></Button>;
  return <div className="space-y-6" data-testid="coordinator-home">
    {(queue.isError || reviews.isError || bookings.isError || ownerWork.isError || approvals.isError) && <p role="alert" className="text-sm text-danger">Some work could not be loaded. Try again.</p>}
    <HomeSection title="My work" empty="Nothing assigned to you." rows={my} seeAll={seeAll(true)} busy={busy} onTake={() => {}} />
    <HomeSection title="Take one" empty="Nothing waiting for an owner." rows={take} seeAll={seeAll(false)} busy={busy} readOnly={role.readOnly} onTake={r => void onTake(r)} />
    <section aria-label="Hand off" className="space-y-3 border-t border-border pt-5"><h2 className="text-lg font-semibold">Hand off</h2>
      {handoffs.isError ? <p role="alert">Handoffs could not be loaded.</p> : (handoffs.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No handoffs waiting for you.</p> :
        <TicketHandoffsQueue rows={handoffs.data ?? []} userId={userId} canAct={!role.readOnly} myTeam={team} homeTeamOf={homeTeamOf} cfg={DEFAULT_QUEUE_TIMING} now={new Date()} originSearch={originSearch}
          onChanged={() => Promise.all([qc.invalidateQueries({ queryKey: ['home-my-work'] }), qc.invalidateQueries({ queryKey: ['team-queue-handoffs'] })])}
          done={done} setDone={(id, entry) => setDone(prev => { const next = { ...prev }; if (entry) next[id] = entry; else delete next[id]; return next; })} />}
      <div className="flex flex-wrap gap-2"><Button className="min-h-11" disabled={role.readOnly || !shift.data?.shift?.worksShifts} onClick={() => setWalking(true)}>End my shift</Button>
        <Button asChild variant="outline" className="min-h-11"><Link to="/prepare-handoffs">Prepare handoffs</Link></Button></div>
    </section>
    <RoutineDrawer row={routine} open={Boolean(routine)} onOpenChange={open => { if (!open) { setRoutine(null); void qc.invalidateQueries({ queryKey: ['team-b-reviews'] }); } }} />
    <NeedsYouNowPanel item={panel} onClose={() => setPanel(null)} originSearch={originSearch} />
    <ShiftHandoffDialog open={walking} onClose={() => setWalking(false)} kind="end_of_shift" tickets={ticketsToHandOff(walkRows, userId, untilMs)} at={at} myTeam={shift.data?.shift ? myTeamToday(shift.data.shift) : team} userId={userId} demoMode={demoMode} untilMs={untilMs} />
  </div>;
}