import { describe, expect, it } from "bun:test";
import { canRecordInvoice, type FinancialRequest } from "../onboarding-finance";
import {
  recordInvoice,
  recordUtilityCost,
  saveUtilityAccount,
  sendToAccounting,
  createFinancialRequest,
} from "../onboarding-finance.server";

async function expectFailure(promise: Promise<unknown>, message: string) {
  let actual = "";
  try {
    await promise;
  } catch (error) {
    actual = (error as Error).message;
  }
  expect(actual).toContain(message);
}

const request = (patch: Partial<FinancialRequest> = {}) =>
  ({
    id: "request",
    status: "estimate",
    estimate_amount: 100,
    authority_tier: "proceed",
    emergency: false,
    emergency_reason: null,
    approved_amount: null,
    invoice_amount: null,
    invoice_at: null,
    ...patch,
  }) as FinancialRequest;

function client(row: unknown) {
  const filters: unknown[][] = [];
  let patch: unknown;
  const query = {
    select: () => query,
    eq: (...args: unknown[]) => {
      filters.push(args);
      return query;
    },
    is: (...args: unknown[]) => {
      filters.push(args);
      return query;
    },
    neq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
    update: (value: unknown) => {
      patch = value;
      return query;
    },
    insert: () => {
      throw new Error("Unexpected insert");
    },
  };
  return {
    db: { rpc: async () => ({ data: true, error: null }), from: () => query },
    filters,
    getPatch: () => patch,
  };
}

describe("financial transition guards", () => {
  it("reuses a recorded accounting handoff without sending another email", async () => {
    const fake = client(
      request({
        status: "settled",
        invoice_amount: 100,
        accounting_sent_at: "2026-09-01",
        accounting_recipient: "qa@example.invalid",
      }),
    );
    expect(await sendToAccounting(fake.db as never, "staff", { requestId: "request" })).toEqual({
      ok: true,
      to: "qa@example.invalid",
      delivery: "sent",
    });
    expect(fake.getPatch()).toBe(undefined);
  });
  it("rejects an accounting handoff with an inconsistent lifecycle", async () => {
    const fake = client(request({ status: "awaiting_approval", invoice_amount: 100 }));
    await expectFailure(
      sendToAccounting(fake.db as never, "staff", { requestId: "request" }),
      "Only an invoiced request",
    );
  });
  it("rejects a financial request linked to another property's task", async () => {
    const fake = client(null);
    await expectFailure(
      createFinancialRequest(fake.db as never, "staff", {
        propertyId: "property",
        taskId: "other-task",
        kind: "repair",
        title: "QA",
        estimateAmount: 100,
      }),
      "task is not available for this property",
    );
    expect(
      fake.filters.some(
        (filter) => JSON.stringify(filter) === JSON.stringify(["id", "other-task"]),
      ),
    ).toBe(true);
    expect(
      fake.filters.some(
        (filter) => JSON.stringify(filter) === JSON.stringify(["property_id", "property"]),
      ),
    ).toBe(true);
  });
  it("requires authority before recording an invoice", () => {
    expect(canRecordInvoice(request())).toBe(true);
    expect(canRecordInvoice(request({ authority_tier: "owner" }))).toBe(false);
    expect(canRecordInvoice(request({ status: "approved", approved_amount: 100 }))).toBe(true);
    expect(canRecordInvoice(request({ status: "approved" }))).toBe(false);
    for (const status of [
      "awaiting_approval",
      "declined",
      "invoiced",
      "sent_to_accounting",
      "settled",
      "cancelled",
      "unknown",
    ])
      expect(canRecordInvoice(request({ status }))).toBe(false);
  });
  it("requires a documented emergency and preserves an existing invoice", () => {
    expect(
      canRecordInvoice(
        request({ authority_tier: "emergency", emergency: true, emergency_reason: " " }),
      ),
    ).toBe(false);
    expect(
      canRecordInvoice(
        request({ authority_tier: "emergency", emergency: true, emergency_reason: "Active leak" }),
      ),
    ).toBe(true);
    expect(canRecordInvoice(request({ invoice_amount: 0 }))).toBe(false);
  });
  it("rejects a direct invoice call before any write when approval is pending", async () => {
    const fake = client(request({ status: "awaiting_approval" }));
    await expectFailure(
      recordInvoice(fake.db as never, "staff", { requestId: "request", invoiceAmount: 100 }),
      "needs approval",
    );
    expect(fake.getPatch()).toBe(undefined);
  });
});

describe("utility property boundaries", () => {
  it("does not move an account or erase omitted notes and dates", async () => {
    const fake = client(null);
    await expectFailure(
      saveUtilityAccount(fake.db as never, "staff", {
        id: "account",
        propertyId: "property",
        utilityType: "water",
        provider: "QA",
        accountLabel: "QA",
        status: "active",
        responsible: "owner",
      }),
      "not available for this property",
    );
    expect(
      fake.filters.some((filter) => JSON.stringify(filter) === JSON.stringify(["id", "account"])),
    ).toBe(true);
    expect(
      fake.filters.some(
        (filter) => JSON.stringify(filter) === JSON.stringify(["property_id", "property"]),
      ),
    ).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(fake.getPatch(), "notes")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fake.getPatch(), "service_start_on")).toBe(false);
  });
  it("rejects costs for a missing or differently owned account before inserting", async () => {
    const fake = client(null);
    await expectFailure(
      recordUtilityCost(fake.db as never, "staff", {
        accountId: "account",
        propertyId: "property",
        amount: 50,
      }),
      "not available for this property",
    );
    expect(
      fake.filters.some(
        (filter) => JSON.stringify(filter) === JSON.stringify(["property_id", "property"]),
      ),
    ).toBe(true);
  });
  it("rejects reversed billing periods", async () => {
    const fake = client(null);
    await expectFailure(
      recordUtilityCost(fake.db as never, "staff", {
        accountId: "account",
        propertyId: "property",
        amount: 50,
        periodStart: "2026-09-30",
        periodEnd: "2026-09-01",
      }),
      "billing period",
    );
    expect(fake.filters.length).toBe(0);
  });
});
