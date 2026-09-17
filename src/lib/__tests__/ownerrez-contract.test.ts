import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { currentGuestForListing, stayForListing } from "@/lib/ownerrez.server";

const originalFetch = globalThis.fetch;
const originalUser = process.env["OWNERREZ_USERNAME"];
const originalToken = process.env["OWNERREZ_ACCESS_TOKEN"];
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

beforeEach(() => {
  process.env["OWNERREZ_USERNAME"] = "synthetic@example.test";
  process.env["OWNERREZ_ACCESS_TOKEN"] = "synthetic-token";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUser === undefined) delete process.env["OWNERREZ_USERNAME"];
  else process.env["OWNERREZ_USERNAME"] = originalUser;
  if (originalToken === undefined) delete process.env["OWNERREZ_ACCESS_TOKEN"];
  else process.env["OWNERREZ_ACCESS_TOKEN"] = originalToken;
});

describe("OwnerRez read-only booking contract", () => {
  it("uses a synthetic Basic header and returns only the requested listing's stay", async () => {
    const requests: Array<{ url: string; authorization: string | null }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return Response.json({
        items: [
          { id: 21, property_id: 999, arrival: yesterday(), departure: tomorrow(), guest_name: "Wrong home" },
          { id: 22, property_id: 123, arrival: yesterday(), departure: tomorrow(), guest_name: "Right home" },
        ],
      });
    };

    const guest = await currentGuestForListing("123");
    expect(guest.status).toBe("match");
    expect(guest.reservation_id).toBe("22");
    expect(guest.guest_name).toBe("Right home");
    expect(requests.length).toBe(1);
    expect(new URL(requests[0]!.url).searchParams.get("property_ids")).toBe("123");
    expect(requests[0]!.authorization).toBe(
      `Basic ${Buffer.from("synthetic@example.test:synthetic-token").toString("base64")}`,
    );
  });

  it("does not treat a mismatched or cancelled booking as occupancy", async () => {
    globalThis.fetch = async () =>
      Response.json({
        items: [
          { id: 31, property_id: 999, arrival: yesterday(), departure: tomorrow() },
          { id: 32, property_id: 123, arrival: yesterday(), departure: tomorrow(), status: "Cancelled" },
        ],
      });
    expect((await currentGuestForListing("123")).status).toBe("no_stay");
    const occupancy = await stayForListing("123");
    expect(occupancy.occupancy_status).toBe("vacant");
    expect(occupancy.booking_id).toBeNull();
  });

  it("marks two active bookings for the same listing as ambiguous", async () => {
    globalThis.fetch = async () =>
      Response.json({
        items: [
          { id: 41, property_id: 123, arrival: yesterday(), departure: tomorrow() },
          { id: 42, property_id: 123, arrival: yesterday(), departure: tomorrow() },
        ],
      });
    const guest = await currentGuestForListing("123");
    expect(guest.status).toBe("ambiguous");
    expect(guest.reservation_id).toBeNull();
  });
});
