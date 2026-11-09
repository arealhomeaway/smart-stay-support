/**
 * Clean slate, part 2c (replaces 2b). Emily, Nov 9, 2026, answer 1: keep all 18 test sign-ins
 * (sign-ins are blocked, never deleted) and block the 4 that were not blocked yet:
 * QA Kati, QA Micah, Avery Lindqvist (demo owner), QA Signup Test.
 * Run as an Admin step after 02:
 *   bun docs/pending/clean-slate/02c_block_test_logins.ts
 * Checks each address first and skips (and reports) any id whose address is not the expected one.
 * Blocks for 876000 hours (about 100 years), the same length as the other 14. Deletes nothing.
 * Then reads all 18 back and reports each one's block. Needs the server's service key in the
 * environment; prints no secrets.
 * Undo: set ban_duration "none" on the same 4 ids (not needed; they are test accounts).
 */
import { createClient } from "@supabase/supabase-js";

const TO_BLOCK: [string, string][] = [
  ["d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8", "qa.kati@resolve-test.invalid"],
  ["8fac5aa5-ba70-42f2-afa0-6d77382383b3", "qa.micah@resolve-test.invalid"],
  ["f8a9d111-3416-47f7-abc1-48f5e8aac2ab", "qa.owner@resolve-test.invalid"],
  ["eeaf39c4-3b22-4733-9ba5-b275476bc5a8", "qa.signup@resolve-test.invalid"],
];

const ALL_18 = [
  "81a80bac-2655-4994-9651-a9afb81ec721", "ea98f339-1ccc-437a-88bb-06ac94be655a",
  "77a301f0-161c-40a4-8266-0c0e05cefa45", "f44ecf9a-a358-430c-9c64-0ffaa31740b4",
  "e3c913e4-1562-4143-a6ff-1f17cd5deda6", "ec5405ff-4722-4a85-a22e-069e68bd3c7f",
  "d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8", "8fac5aa5-ba70-42f2-afa0-6d77382383b3",
  "d13885de-6178-4f32-8560-997d182f245f", "f8a9d111-3416-47f7-abc1-48f5e8aac2ab",
  "eeaf39c4-3b22-4733-9ba5-b275476bc5a8", "d1b80a3e-3b42-46e5-aacb-43276ef272eb",
  "0a6d5dc9-8159-4850-9b5e-421308d2e464", "06fd8599-c7aa-40b2-8161-cafae4da99b7",
  "3a476833-49ff-4aa3-996d-18913422f8e4", "c6579620-2ee4-41fe-ad10-07f451d7ae97",
  "5557f537-6847-4f33-af90-1e78b5c344fa", "9f3b6143-b693-4067-9a3c-d645b5ecd716",
];

const db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});

for (const [id, email] of TO_BLOCK) {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error || !data.user) {
    console.log(`${id}: no sign-in found, nothing to do`);
    continue;
  }
  if ((data.user.email ?? "").toLowerCase() !== email) {
    console.log(`${id}: SKIPPED, the address is not the expected one`);
    continue;
  }
  const upd = await db.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  console.log(`${id} ${email}: ${upd.error ? `not blocked (${upd.error.message})` : "blocked"}`);
}

let blocked = 0;
for (const id of ALL_18) {
  const { data } = await db.auth.admin.getUserById(id);
  const until = (data.user as { banned_until?: string } | null)?.banned_until ?? null;
  const ok = Boolean(until && Date.parse(until) > Date.now() + 50 * 365 * 86_400_000);
  if (ok) blocked++;
  console.log(`${id}: ${data.user ? (ok ? `blocked until ${until}` : "NOT BLOCKED") : "no sign-in"}`);
}
console.log(`blocked ${blocked} of ${ALL_18.length}`);
