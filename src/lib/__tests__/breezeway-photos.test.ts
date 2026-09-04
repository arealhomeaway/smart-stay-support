/**
 * Breezeway task photo upload, tested as the request we actually send.
 *
 * `breezewayRequest` is stubbed, so no real Breezeway call is ever made and no
 * photo can land on a live task. What is asserted is the contract Breezeway
 * confirmed: multipart/form-data, field `file`, `include_in_task_report` off
 * unless explicitly chosen, and no automatic retry on a non-idempotent create.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";

class FakeBreezewayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Captured = {
  path: string;
  options: { method?: string; form?: FormData; retry?: boolean; allowWrite?: boolean };
};
let captured: Captured | null = null;
let responder: () => unknown = () => ({
  id: 873177778,
  url: "https://s3.amazonaws.com/brzw-photos/x.png",
  include_in_task_report: false,
});

mock.module("@/lib/breezeway.server", () => ({
  BreezewayError: FakeBreezewayError,
  breezewayRequest: async (path: string, options: Captured["options"] = {}) => {
    captured = { path, options };
    return responder();
  },
}));

mock.module("@/lib/breezeway-mapping.server", () => ({
  propertyWriteEligibility: async () => ({
    eligible: true,
    homeId: "555",
    reason: null,
    state: "verified",
  }),
  propertyForHomeId: async () => null,
  verifiedHomeIds: async () => [],
}));

const photoRows: Record<string, unknown>[] = [];
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () =>
          table === "feature_flags"
            ? { data: { enabled: true }, error: null }
            : table === "breezeway_work_orders"
              ? {
                  data: {
                    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    breezeway_task_id: 166182176,
                    property_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    breezeway_home_id: "555",
                    name: "Task",
                    assignees: [],
                    photo_count: 0,
                    comment_count: 0,
                  },
                  error: null,
                }
              : { data: null, error: null },
        single: async () => ({ data: null, error: null }),
        upsert: (payload: Record<string, unknown>) => {
          if (table === "breezeway_work_order_photos") photoRows.push(payload);
          return { error: null };
        },
        insert: () => ({ error: null }),
        update: () => chain,
      };
      return chain;
    },
  },
}));

const { uploadWorkOrderPhoto } = await import("@/lib/breezeway-workorders.server");

const WO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const png = () => ({
  name: "shot.png",
  type: "image/png",
  bytes: new Uint8Array([1, 2, 3, 4]).buffer,
});

describe("Breezeway task photo upload", () => {
  beforeEach(() => {
    captured = null;
    photoRows.length = 0;
    responder = () => ({ id: 1, url: "https://example.test/p.png", include_in_task_report: false });
  });

  it("posts multipart to the task photos endpoint with the file field", async () => {
    const res = await uploadWorkOrderPhoto(WO, png(), false, "Tester");
    expect(res.ok).toBe(true);
    expect(captured?.path).toBe("/task/166182176/photos");
    expect(captured?.options.method).toBe("POST");
    expect(captured?.options.allowWrite).toBe(true);
    // Non-idempotent: Breezeway exposes no photo delete, so never auto-retry.
    expect(captured?.options.retry).toBe(false);
    const form = captured?.options.form as FormData;
    expect(form instanceof FormData).toBe(true);
    expect(form.get("file") instanceof Blob).toBe(true);
  });

  it("defaults the owner/client report flag to false", async () => {
    await uploadWorkOrderPhoto(WO, png(), false, "Tester");
    expect((captured?.options.form as FormData).get("include_in_task_report")).toBe("false");
  });

  it("sends true only when the staff member opted in", async () => {
    responder = () => ({ id: 2, url: "https://example.test/p.png", include_in_task_report: true });
    const res = await uploadWorkOrderPhoto(WO, png(), true, "Tester");
    expect((captured?.options.form as FormData).get("include_in_task_report")).toBe("true");
    expect(res.ok && res.includeInTaskReport).toBe(true);
  });

  it("refuses a non-image before any Breezeway call", async () => {
    const res = await uploadWorkOrderPhoto(
      WO,
      { name: "notes.txt", type: "text/plain", bytes: new Uint8Array([1]).buffer },
      false,
      "Tester",
    );
    expect(res.ok).toBe(false);
    expect(captured).toBeNull();
  });

  it("refuses a file over 15 MB before any Breezeway call", async () => {
    const res = await uploadWorkOrderPhoto(
      WO,
      { name: "big.jpg", type: "image/jpeg", bytes: new ArrayBuffer(16 * 1024 * 1024) },
      false,
      "Tester",
    );
    expect(res.ok).toBe(false);
    expect(captured).toBeNull();
  });

  it("reports a Breezeway refusal as a failure, never a success", async () => {
    responder = () => {
      throw new FakeBreezewayError(422, "Invalid Photo");
    };
    const res = await uploadWorkOrderPhoto(WO, png(), false, "Tester");
    expect(res.ok).toBe(false);
    expect(photoRows.length).toBe(0);
  });

  it("mirrors a successful upload so the existing photo view shows it", async () => {
    await uploadWorkOrderPhoto(WO, png(), false, "Tester");
    expect(photoRows.length).toBe(1);
    expect(photoRows[0]!["source"]).toBe("resolve");
    expect(photoRows[0]!["breezeway_task_id"]).toBe(166182176);
  });
});
