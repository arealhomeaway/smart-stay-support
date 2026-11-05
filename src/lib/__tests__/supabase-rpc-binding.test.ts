import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Regression guard for Help Ticket #62: supabase-js `rpc` reads `this.rest`,
 * so storing `client.rpc` in a variable and calling it detached crashes with
 * "Cannot read properties of undefined (reading 'rest')". Every RPC helper
 * must bind the client first.
 */
describe("supabase rpc binding", () => {
  const client = createClient("https://example.supabase.co", "sb_publishable_test");

  it("a detached rpc reference crashes with the reported error", async () => {
    const detached = client.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    await expect(detached("any_function", {})).rejects.toThrow(
      "Cannot read properties of undefined (reading 'rest')",
    );
  });

  it("a bound rpc reference gets past the client and only fails on the network", async () => {
    const bound = client.rpc.bind(client) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    await expect(bound("any_function", {})).rejects.not.toThrow(
      "Cannot read properties of undefined (reading 'rest')",
    );
  });
});
