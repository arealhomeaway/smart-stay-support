// One-time approved account operation. Never log session tokens or passwords.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertAdmin, applyRole } from "../../../src/lib/access.server";
import { findOrCreateOwnerLogin } from "../../../src/lib/active-owner-enrollment.server";

const minted = JSON.parse(readFileSync("/root/.cache/lovable-auth/session.json", "utf8"));
const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
if (!url || !key) throw new Error("Authenticated runtime configuration unavailable.");
const actor = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } },
});
const user = await actor.auth.getUser(minted.session.access_token);
if (user.error || user.data.user?.id !== "98bd6696-4018-4965-b645-0471c5ae3925") throw new Error("Emily's authenticated identity could not be verified.");
await assertAdmin(actor, user.data.user.id);
const { supabaseAdmin } = await import("../../../src/integrations/supabase/client.server");
const account = await findOrCreateOwnerLogin(supabaseAdmin, "rlee07@gmail.com", "Ryan Lee");
const receipt = { phase: "A", userId: account.id, emailMasked: "rl***@gmail.com", created: account.created, created_at: null as string | null, roleConfirmed: false, membershipConfirmedAbsent: false, noEmailRequested: true };
const path = "docs/pending/lee-swap/receipt.json";
writeFileSync(path, JSON.stringify(receipt, null, 2) + "\n");
const auth = await supabaseAdmin.auth.admin.getUserById(account.id);
if (auth.error || !auth.data.user) throw new Error("Login receipt lookup failed.");
receipt.created_at = auth.data.user.created_at;
writeFileSync(path, JSON.stringify(receipt, null, 2) + "\n");
await applyRole(account.id, "owner");
console.log("Phase A canonical login created; receipt saved. Owner-only verification is next.");