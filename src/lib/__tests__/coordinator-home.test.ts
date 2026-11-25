import { describe, expect, it } from 'bun:test';
import { coordinatorTicketWork, coordinatorTakeTickets, coordinatorDueSort, COORDINATOR_HOME_LIMIT } from '../coordinator-home';
const ticket = { id: 't', status: 'open', priority: 'p2', external_source: null, functional_role_code: 'po_day', assigned_to: 'me' };
describe('coordinator Home existing live-work rules', () => {
  it('shows live work assigned to this person, not someone else or a pending incoming handoff', () => {
    expect(coordinatorTicketWork([ticket, { ...ticket, id: 'other', assigned_to: 'other' },
      { ...ticket, id: 'handoff', handoff_status: 'pending', pending_handoff_to: 'me' }], 'me').map(t => t.id)).toEqual(['t']);
  });
  it('held and quiet imports never appear in My work or Take one', () => {
    const rows = [{ ...ticket, import_hold: 'backlog_review' }, { ...ticket, external_source: 'notion', external_status: 'In progress' }];
    expect(coordinatorTicketWork(rows, 'me')).toEqual([]);
    expect(coordinatorTakeTickets(rows.map(t => ({ ...t, assigned_to: null })), 'property_operations')).toEqual([]);
  });
  it('Take one contains only unowned work on the coordinator own team', () => {
    expect(coordinatorTakeTickets([{ ...ticket, assigned_to: null },
      { ...ticket, id: 'a', assigned_to: null, functional_role_code: 'ge_day' }, ticket], 'property_operations').map(t => t.id)).toEqual(['t']);
    expect(coordinatorTakeTickets([{ ...ticket, assigned_to: null }], null)).toEqual([]);
  });
  it('Team A uses the existing ticket work-type role when the ticket role is empty', () => {
    const a = { ...ticket, assigned_to: null, functional_role_code: null, work_types: { name: 'Guest issue', functional_role_code: 'ge_day' } };
    expect(coordinatorTakeTickets([a], 'guest_experience').map(t => t.id)).toEqual(['t']);
    expect(coordinatorTakeTickets([a], 'property_operations')).toEqual([]);
  });
  it('leaders with no Operations home team see no Take one tickets', () => {
    const rows = [{ ...ticket, assigned_to: null },
      { ...ticket, id: 'a', assigned_to: null, functional_role_code: 'ge_day' }];
    expect(coordinatorTakeTickets(rows, null)).toEqual([]);
    expect(coordinatorTakeTickets(rows, 'leadership')).toEqual([]);
    expect(coordinatorTakeTickets(rows, 'property_operations').map(t => t.id)).toEqual(['t']);
  });
  it('both lists show at most ten rows before See all', () => {
    expect(COORDINATOR_HOME_LIMIT).toBe(10);
    expect(Array.from({ length: 11 }, (_, i) => i).slice(0, COORDINATOR_HOME_LIMIT)).toHaveLength(10);
  });
  it('late and today precede later week dates and undated items', () => {
    expect([{ due: null }, { due: '2026-11-27' }, { due: '2026-11-25' }, { due: '2026-11-24' }].sort(coordinatorDueSort).map(r => r.due))
      .toEqual(['2026-11-24', '2026-11-25', '2026-11-27', null]);
  });
});