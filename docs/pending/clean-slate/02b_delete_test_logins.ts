/**
 * Clean slate, part 2b. STAGED ONLY: run after 02, with Emily's go, as an Admin step:
 *   bun docs/pending/clean-slate/02b_delete_test_logins.ts
 * Removes the sign-ins of exactly the 18 accounts in 02 through the sign-in service. It checks
 * each address first and skips (and reports) any id whose address is not the expected one.
 * Needs the server's service key in the environment; prints no secrets.
 */
import { createClient } from "@supabase/supabase-js";

const ACCOUNTS: [string, string][] = [
  ["81a80bac-2655-4994-9651-a9afb81ec721", "riley.alder@demo.arha.test"],
  ["ea98f339-1ccc-437a-88bb-06ac94be655a", "emily.test@example.com"],
  ["77a301f0-161c-40a4-8266-0c0e05cefa45", "pr10-owner-a-20260917@example.invalid"],
  ["f44ecf9a-a358-430c-9c64-0ffaa31740b4", "pr10-owner-b-20260917@example.invalid"],
  ["e3c913e4-1562-4143-a6ff-1f17cd5deda6", "emily.r.jimenez4@gmail.com"],
  ["ec5405ff-4722-4a85-a22e-069e68bd3c7f", "qa.james@resolve-test.invalid"],
  ["d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8", "qa.kati@resolve-test.invalid"],
  ["8fac5aa5-ba70-42f2-afa0-6d77382383b3", "qa.micah@resolve-test.invalid"],
  ["d13885de-6178-4f32-8560-997d182f245f", "qa.outsider@resolve-test.invalid"],
  ["f8a9d111-3416-47f7-abc1-48f5e8aac2ab", "qa.owner@resolve-test.invalid"],
  ["eeaf39c4-3b22-4733-9ba5-b275476bc5a8", "qa.signup@resolve-test.invalid"],
  ["d1b80a3e-3b42-46e5-aacb-43276ef272eb", "qa.tech@resolve-test.invalid"],
  ["0a6d5dc9-8159-4850-9b5e-421308d2e464", "qa.um.admin@resolve-test.invalid"],
  ["06fd8599-c7aa-40b2-8161-cafae4da99b7", "qa.um.manager@resolve-test.invalid"],
  ["3a476833-49ff-4aa3-996d-18913422f8e4", "qa.um.pending@resolve-test.invalid"],
  ["c6579620-2ee4-41fe-ad10-07f451d7ae97", "qa.um.target@resolve-test.invalid"],
  ["5557f537-6847-4f33-af90-1e78b5c344fa", "qa.um.tech@resolve-test.invalid"],
  ["9f3b6143-b693-4067-9a3c-d645b5ecd716", "qa.vendor@resolve-test.invalid"],
];

const db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});

for (const [id, email] of ACCOUNTS) {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error || !data.user) {
    console.log(`${id}: no sign-in found, nothing to do`);
    continue;
  }
  if ((data.user.email ?? "").toLowerCase() !== email) {
    console.log(`${id}: SKIPPED, the address is not the expected one`);
    continue;
  }
  const del = await db.auth.admin.deleteUser(id);
  console.log(`${id} ${email}: ${del.error ? `not removed (${del.error.message})` : "removed"}`);
}
