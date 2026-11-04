import { describe, expect, it } from "bun:test";
import { dispatchNextStep, ownerRezGuestUpdate } from "@/lib/dispatch-next-step";

const base = {
  closed: false,
  dispatched: false,
  handoffStatus: "not_sent",
  accepted: null as { name: string } | null,
  candidate: { id: "c1", name: "Steve Carroll" } as { id: string; name: string } | null,
  auth: { satisfied: true, label: "No approval required" },
  hasAppointment: false,
  sendBy: null as "breezeway" | "email" | null,
};

describe("dispatch next step", () => {
  it("asks for acceptance first, naming the vendor", () => {
    const s = dispatchNextStep(base)!;
    expect(s.kind).toBe("accept");
    expect(s.kind === "accept" && s.button).toBe("Mark Steve Carroll accepted");
  });
  it("asks for a vendor when none is on the Work Order", () => {
    expect(dispatchNextStep({ ...base, candidate: null })!.kind).toBe("add_vendor");
  });
  it("then authorization, saying what is missing", () => {
    const s = dispatchNextStep({ ...base, accepted: { name: "Steve Carroll" }, auth: { satisfied: false, label: "Waiting on owner approval" } })!;
    expect(s.kind).toBe("authorize");
    expect(s.body).toContain("Waiting on owner approval");
  });
  it("then the appointment", () => {
    const s = dispatchNextStep({ ...base, accepted: { name: "Steve Carroll" } })!;
    expect(s.kind === "appointment" && s.button).toBe("Set the appointment");
  });
  it("then Send to Breezeway for Breezeway vendors, email for others", () => {
    const ready = { ...base, accepted: { name: "Steve Carroll" }, hasAppointment: true };
    expect(dispatchNextStep({ ...ready, sendBy: "breezeway" })!.kind).toBe("send_breezeway");
    expect(dispatchNextStep({ ...ready, sendBy: "email" })!.kind).toBe("send_email");
    const retry = dispatchNextStep({ ...ready, sendBy: "breezeway", handoffStatus: "failed" })!;
    expect(retry.kind === "send_breezeway" && retry.retry).toBe(true);
  });
  it("never offers a send while a past send is uncertain, and stops once sent", () => {
    expect(dispatchNextStep({ ...base, handoffStatus: "uncertain" })!.kind).toBe("reconcile");
    expect(dispatchNextStep({ ...base, handoffStatus: "sent" })).toBeNull();
    expect(dispatchNextStep({ ...base, dispatched: true })).toBeNull();
    expect(dispatchNextStep({ ...base, closed: true })).toBeNull();
  });
});

describe("guest reply update", () => {
  const now = new Date("2026-11-04T23:00:00Z");
  it("records the same guest update fields, note optional", () => {
    const u = ownerRezGuestUpdate("", "2026-11-05T01:00:00.000Z", now);
    expect(u.patch).toEqual({ guest_update_at: now.toISOString(), guest_update_note: "Responded to the guest.", next_guest_update_at: "2026-11-05T01:00:00.000Z" });
    expect(ownerRezGuestUpdate(" Told them 3 pm ", null, now).patch.guest_update_note).toBe("Responded to the guest. Told them 3 pm");
  });
});
