/**
 * Build 18 item 1 (Emily, Nov 10): the Breezeway safety sweep refreshes the copies of Breezeway
 * work on every run, whatever the bridge switch says, as the published Nov 6 refresh did. Only
 * making tickets and reviews is gated by the switch and its start line; that lives in the
 * database trigger and is covered by breezeway-bridge-sql.test.ts. No Breezeway call is made here.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runBreezewaySafetySweep, SWEEP_DEFAULT_HOMES, SWEEP_MAX_HOMES } from "../breezeway-bridge.server";

function fakeDeps(on: boolean) {
  const calls: string[] = [];
  const portfolioLimits: number[] = [];
  const notes: boolean[] = [];
  return {
    calls,
    portfolioLimits,
    notes,
    deps: {
      readGate: async () => ({ on }),
      syncPeople: async () => (calls.push("people"), { synced: 3 }),
      syncPortfolio: async (limit: number) => (calls.push("portfolio"), portfolioLimits.push(limit), { homes: 2 }),
      note: async (ran: boolean) => void notes.push(ran),
      recordFailure: async () => void calls.push("failure"),
    },
  };
}

describe("Build 18 item 1: the sweep refreshes copies whatever the bridge says", () => {
  it("with the bridge OFF a run still refreshes the people and the verified homes' work orders", async () => {
    const f = fakeDeps(false);
    const result = await runBreezewaySafetySweep(undefined, f.deps);
    expect(result.ok).toBe(true);
    expect(f.calls).toEqual(["people", "portfolio"]);
    expect(f.notes).toEqual([true]);
    expect((result as { bridgeOn: boolean }).bridgeOn).toBe(false);
  });

  it("with the bridge ON a run does the same refresh", async () => {
    const f = fakeDeps(true);
    const result = await runBreezewaySafetySweep(undefined, f.deps);
    expect(f.calls).toEqual(["people", "portfolio"]);
    expect((result as { bridgeOn: boolean }).bridgeOn).toBe(true);
  });

  it("uses the Nov 6 batch: 20 homes by default, never more than 60", async () => {
    expect(SWEEP_DEFAULT_HOMES).toBe(20);
    expect(SWEEP_MAX_HOMES).toBe(60);
    const f = fakeDeps(false);
    await runBreezewaySafetySweep(undefined, f.deps);
    await runBreezewaySafetySweep(500, f.deps);
    expect(f.portfolioLimits).toEqual([20, 60]);
  });

  it("a failed refresh is recorded and reported, never hidden", async () => {
    const f = fakeDeps(false);
    f.deps.syncPortfolio = async () => {
      throw new Error("Breezeway did not answer");
    };
    const result = await runBreezewaySafetySweep(undefined, f.deps);
    expect(result.ok).toBe(false);
    expect(f.notes).toEqual([false]);
    expect(f.calls).toContain("failure");
  });

  it("the sweep never makes tickets or reviews itself: only the database trigger does, behind the switch", () => {
    const src = readFileSync("src/lib/breezeway-bridge.server.ts", "utf8");
    const body = src.slice(src.indexOf("export async function runBreezewaySafetySweep"), src.indexOf("const ORDER_SELECT"));
    expect(body).not.toMatch(/from\("tickets"\)|from\("routine_controls"\)|insert\(/);
    expect(body).not.toMatch(/if \(!gate\.on\)/);
  });
});
