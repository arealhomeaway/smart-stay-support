import { describe, expect, it } from "bun:test";
import { HANDOFF_SETTLE_COPY, settleHandoff, type HandoffWrite } from "../handoff-accept";

/** Records the order of every save so the test can see what ran. */
function steps(ticket: HandoffWrite | Error, handoff: HandoffWrite | Error) {
  const calls: string[] = [];
  const run = (name: string, r: HandoffWrite | Error) => async () => {
    calls.push(name);
    if (r instanceof Error) throw r;
    return r;
  };
  return {
    calls,
    s: {
      saveTicket: run("ticket", ticket),
      saveHandoff: run("handoff", handoff),
      undoTicket: async () => {
        calls.push("undo");
      },
    },
  };
}
const OK: HandoffWrite = { error: null, rows: 1 };

describe("settleHandoff: the ticket must move before a handoff counts", () => {
  for (const kind of ["accept", "decline"] as const) {
    it(`${kind}: saves the ticket first, then the handoff`, async () => {
      const { calls, s } = steps(OK, OK);
      expect(await settleHandoff(kind, s)).toEqual({ ok: true });
      expect(calls).toEqual(["ticket", "handoff"]);
    });

    it(`${kind}: a refused ticket save stops it, and the handoff is never recorded`, async () => {
      const { calls, s } = steps({ error: { message: "new row violates row-level security policy" }, rows: 0 }, OK);
      expect(await settleHandoff(kind, s)).toEqual({ ok: false, message: HANDOFF_SETTLE_COPY.ticketNotMoved[kind] });
      expect(calls).toEqual(["ticket"]);
    });

    it(`${kind}: a save that changed no ticket (row security hid it) also stops it`, async () => {
      const { calls, s } = steps({ error: null, rows: 0 }, OK);
      const r = await settleHandoff(kind, s);
      expect(r.ok).toBe(false);
      expect(calls).toEqual(["ticket"]);
    });

    it(`${kind}: a network failure on the ticket save stops it`, async () => {
      const { calls, s } = steps(new Error("offline"), OK);
      expect((await settleHandoff(kind, s)).ok).toBe(false);
      expect(calls).toEqual(["ticket"]);
    });

    it(`${kind}: if the handoff record fails, the ticket is put back`, async () => {
      const { calls, s } = steps(OK, { error: { message: "denied" }, rows: 0 });
      expect(await settleHandoff(kind, s)).toEqual({ ok: false, message: HANDOFF_SETTLE_COPY.handoffNotSaved[kind] });
      expect(calls).toEqual(["ticket", "handoff", "undo"]);
    });
  }

  it("the error words are plain and never claim it was done", () => {
    for (const m of [...Object.values(HANDOFF_SETTLE_COPY.ticketNotMoved), ...Object.values(HANDOFF_SETTLE_COPY.handoffNotSaved)]) {
      expect(m).not.toMatch(/accepted\.|declined\.|row-level|RLS|error code/i);
      expect(m).not.toContain("—");
    }
  });
});
