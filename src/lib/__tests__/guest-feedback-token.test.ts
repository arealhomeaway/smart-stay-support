import { describe, expect, it, beforeAll } from "bun:test";

beforeAll(() => {
  process.env["GUEST_SURVEY_SECRET"] = "test-secret-for-unit-tests-only-0123456789";
});

describe("survey tokens", () => {
  it("round-trips, rejects tampering and expiry", async () => {
    const { signSurveyToken, verifySurveyToken } = await import("@/lib/guest-feedback.server");
    const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const stay = { b: "123", p: "prop", g: "Dana Reed", gid: null, a: null, d, ch: "Airbnb", demo: true };
    const t = await signSurveyToken(stay);
    expect((await verifySurveyToken(t))?.b).toBe("123");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...stay, b: "999", exp: 9999999999 })).toString("base64url");
    expect(await verifySurveyToken(`${forged}.${sig}`)).toBeNull();
    expect(await verifySurveyToken(`${body}.x${sig!.slice(1)}`)).toBeNull();
    const old = await signSurveyToken({ ...stay, d: "2020-01-01" });
    expect(await verifySurveyToken(old)).toBeNull();
  });
});
