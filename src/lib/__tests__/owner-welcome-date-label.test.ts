import { expect, it } from "bun:test";
import { welcomeDateLabel } from "../owner-welcome";
const f = (d: string) => d.slice(0, 10);
it("queued rows say Queued", () => expect(welcomeDateLabel({ status: "queued", sent_at: null, queued_at: "2026-10-08T01" }, f)).toBe("Queued 2026-10-08"));
it("reconciled delivery without a sent time never invents one", () => expect(welcomeDateLabel({ status: "sent", sent_at: null, queued_at: "2026-10-08T01" }, f)).toBe("Exact sent time unknown"));
it("real sends show the sent time", () => expect(welcomeDateLabel({ status: "sent", sent_at: "2026-10-09T01", queued_at: "2026-10-08T01" }, f)).toBe("Sent 2026-10-09"));
