import { describe, expect, it, mock } from "bun:test";
let delivery: "failed" | "skipped" = "failed";
let emailAttempts = 0;
mock.module("@/lib/email.server", () => ({
  sendEmail: async () => {
    emailAttempts++;
    return { status: delivery, error: "Delivery unavailable in test" };
  },
  emailShell: () => "Test only",
}));
const { sendToAccounting, routeOwnerDecision } = await import("../onboarding-finance.server");

function ownerDeliveryDb(sent: boolean, contactEmail: string | null = "owner@example.invalid") {
  const writes: unknown[] = [];
  const rows: Record<string, unknown> = {
    approvals: {
      id: "approval",
      status: "pending",
      ref: null,
      owner_email_sent_at: sent ? "2026-09-14T00:00:00Z" : null,
      owner_email_to: sent ? "owner@example.invalid" : null,
    },
    properties: { name: "QA home" },
    property_owner_contacts: { owner_name: "QA owner", owner_email: contactEmail },
    owner_program_properties: [],
    owner_programs: [],
  };
  return {
    writes,
    db: {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          not: () => query,
          limit: () => query,
          maybeSingle: async () => ({ data: rows[table], error: null }),
          update: (value: unknown) => {
            writes.push(value);
            return query;
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: rows[table], error: null }).then(resolve),
        };
        return query;
      },
    },
  };
}

describe("owner delivery retries", () => {
  it("does not send again when delivery is already recorded", async () => {
    const { db } = ownerDeliveryDb(true);
    emailAttempts = 0;
    const result = await routeOwnerDecision(db as never, "staff", {
      propertyId: "property",
      approvalId: "approval",
      subject: "QA",
      detail: "",
      amount: 500,
    });
    expect(result.channel).toBe("email");
    expect(emailAttempts).toBe(0);
  });
  it("keeps failed delivery retryable without recording a sent timestamp", async () => {
    const { db, writes } = ownerDeliveryDb(false);
    delivery = "failed";
    emailAttempts = 0;
    let message = "";
    try {
      await routeOwnerDecision(db as never, "staff", {
        propertyId: "property",
        approvalId: "approval",
        subject: "QA",
        detail: "",
        amount: 500,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("email was not sent");
    expect(emailAttempts).toBe(1);
    expect(writes.length).toBe(0);
  });
  it("surfaces a missing homeowner email instead of claiming delivery", async () => {
    const { db } = ownerDeliveryDb(false, null);
    emailAttempts = 0;
    let message = "";
    try {
      await routeOwnerDecision(db as never, "staff", {
        propertyId: "property",
        approvalId: "approval",
        subject: "QA",
        detail: "",
        amount: 500,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("Add the homeowner's email address");
    expect(emailAttempts).toBe(0);
  });
});

describe("financial delivery honesty", () => {
  for (const status of ["failed", "skipped"] as const)
    it(`${status} delivery never marks accounting sent`, async () => {
      delivery = status;
      const writes: unknown[] = [];
      const rows: Record<string, unknown> = {
        financial_requests: {
          id: "request",
          property_id: "property",
          title: "QA repair",
          status: "invoiced",
          estimate_amount: 150,
          approved_amount: 150,
          invoice_amount: 150,
        },
        app_settings: { value: { email: "accounting@example.invalid" } },
        properties: { name: "QA property" },
      };
      const db = {
        rpc: async () => ({ data: true, error: null }),
        from: (table: string) => {
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: async () => ({ data: rows[table], error: null }),
            update: (value: unknown) => {
              writes.push(value);
              return query;
            },
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve({ data: rows[table], error: null }).then(resolve),
          };
          return query;
        },
      };
      let message = "";
      try {
        await sendToAccounting(db as never, "staff", { requestId: "request" });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("was not sent");
      expect(writes.length).toBe(0);
    });
});
