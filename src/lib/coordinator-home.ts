import { isResolveWork, type HomeTicket } from './home-work';
import { currentOwnerId } from './matters';
import { OPEN_STATUSES } from './tickets';
import { ticketTeam } from './team-queue-board';

export const COORDINATOR_HOME_LIMIT = 10;
export function coordinatorTicketWork<T extends HomeTicket>(rows: T[], userId: string) {
  return rows.filter(t => isResolveWork(t) && OPEN_STATUSES.includes(t.status)
    && currentOwnerId(t) === userId && !(t.handoff_status === 'pending' && t.pending_handoff_to === userId));
}
export function coordinatorTakeTickets<T extends HomeTicket>(rows: T[], team: string | null) {
  if (!team) return [];
  return rows.filter(t => {
    const workType = t.work_types;
    const workTypeRole = workType && 'functional_role_code' in workType && typeof workType.functional_role_code === 'string'
      ? workType.functional_role_code : null;
    return isResolveWork(t) && OPEN_STATUSES.includes(t.status)
      && !currentOwnerId(t) && ticketTeam({ id: t.id, status: t.status,
        external_source: t.external_source ?? null, functional_role_code: t.functional_role_code ?? workTypeRole }) === team;
  });
}
export function coordinatorDueSort(a: { due: string | null }, b: { due: string | null }) {
  return (a.due ?? '9999').localeCompare(b.due ?? '9999');
}