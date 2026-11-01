import { describe, it, expect } from 'bun:test';
import { acceptedVendorAppointment, DEFAULT_BREEZEWAY_SENDING, sendingAllowsHome } from '../pilot-dispatch';
describe('pilot dispatch rules', () => {
 it('default mode preserves all verified homes', () => expect(sendingAllowsHome(DEFAULT_BREEZEWAY_SENDING,'home')).toBe(true));
 it('pilot mode only permits listed homes', () => { expect(sendingAllowsHome({ mode:'pilot_only',homeIds:['one'] },'one')).toBe(true); expect(sendingAllowsHome({ mode:'pilot_only',homeIds:['one'] },'two')).toBe(false); });
 it('invalid mapped person refuses', () => { for (const id of [null,0,'bad',-1]) expect(() => acceptedVendorAppointment(id,'2026-11-09T16:30:00Z')).toThrow(); });
 it('missing or invalid appointment refuses', () => { for (const time of [null,'bad']) expect(() => acceptedVendorAppointment(123,time)).toThrow(); });
 it('Central summer appointment preserves local clock', () => expect(acceptedVendorAppointment(123,'2026-07-01T15:30:00Z')).toEqual({ assigneeIds:[123],scheduledDate:'2026-07-01',scheduledTime:'10:30:00' }));
 it('Central winter appointment preserves local clock', () => expect(acceptedVendorAppointment(123,'2026-11-09T16:30:00Z')).toEqual({ assigneeIds:[123],scheduledDate:'2026-11-09',scheduledTime:'10:30:00' }));
});