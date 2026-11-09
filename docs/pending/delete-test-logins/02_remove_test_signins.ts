/**
 * Delete the 18 fake test sign-ins, part 2 of 2 (Emily, Nov 8, 2026; register S6). Run only after
 * part 1 (01_detach_and_remove_test_accounts.sql) has been applied:
 *   bun docs/pending/delete-test-logins/02_remove_test_signins.ts --check   (reads only)
 *   bun docs/pending/delete-test-logins/02_remove_test_signins.ts --remove  (removes the sign-ins)
 * Before touching an id it checks that the sign-in still has exactly the address written next to
 * it, and that the id has no profile, no role and no program place (every real person has a
 * profile). Any id that fails a check is skipped and reported; nothing else is touched. Afterwards
 * it reads every sign-in back and reports the total and whether each remaining sign-in has a
 * profile. Needs the server's service key in the environment; prints no secrets.
 * Undo: none (a removed sign-in cannot be brought back); the database rows are in the backup.
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

const mode = process.argv.includes("--remove") ? "remove" : "check";
const db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});

async function count(table: string, column: string, id: string) {
  const { count: n, error } = await db.from(table).select(column, { count: "exact", head: true }).eq(column, id);
  if (error) throw new Error(`could not read ${table}: ${error.message}`);
  return n ?? 0;
}

let removed = 0;
let ready = 0;
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
  const held =
    (await count("profiles", "id", id)) + (await count("user_roles", "user_id", id)) + (await count("program_members", "user_id", id));
  if (held > 0) {
    console.log(`${id} ${email}: SKIPPED, it still has a profile, role or program place`);
    continue;
  }
  ready++;
  if (mode === "check") {
    console.log(`${id} ${email}: checks passed, would be removed`);
    continue;
  }
  const del = await db.auth.admin.deleteUser(id);
  if (del.error) console.log(`${id} ${email}: NOT removed (${del.error.message})`);
  else {
    removed++;
    console.log(`${id} ${email}: removed`);
  }
}

const all: { id: string }[] = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(`could not list sign-ins: ${error.message}`);
  all.push(...data.users);
  if (data.users.length < 200) break;
}
const { data: profiles } = await db.from("profiles").select("id");
const profileIds = new Set((profiles ?? []).map((p: { id: string }) => p.id));
const withoutProfile = all.filter((u) => !profileIds.has(u.id)).length;
console.log(`mode ${mode}: ${ready} of ${ACCOUNTS.length} passed the checks, ${removed} removed`);
console.log(`sign-ins now ${all.length}; profiles ${profileIds.size}; sign-ins without a profile ${withoutProfile}`);
