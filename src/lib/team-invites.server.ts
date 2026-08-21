import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertAdmin, applyRole, type AppRole } from "./access.server";

type Client = SupabaseClient<Database>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — read aloud safely

function newInviteCode() {
  const pick = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}

export async function loadTeamInvites(supabase: Client) {
  const { data, error } = await supabase
    .from("team_invites")
    .select("id, code, role, invitee_email, invitee_name, note, expires_at, revoked_at, redeemed_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

/** Admin-only: issue a single-use code that grants one role when redeemed. */
export async function createTeamInvite(
  supabase: Client,
  userId: string,
  input: { role: AppRole; email: string; name: string; note: string; expiresInDays: number },
) {
  await assertAdmin(supabase, userId);
  const expires = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    const { data, error } = await supabase
      .from("team_invites")
      .insert({
        code,
        role: input.role,
        invitee_email: input.email || null,
        invitee_name: input.name || null,
        note: input.note || null,
        expires_at: expires,
        created_by: userId,
      })
      .select("code, expires_at")
      .maybeSingle();
    if (!error && data) {
      const emailed = await sendInviteEmail({
        email: input.email,
        name: input.name,
        role: input.role,
        code: data.code,
        note: input.note,
        expiresAt: data.expires_at,
      });
      return { code: data.code, expiresAt: data.expires_at, emailed };
    }
    if (error && error.code !== "23505") throw error;
  }
  throw new Error("Could not generate an invite code. Please try again.");
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Platform Owner",
  manager: "Supervisor",
  tech: "Staff",
  onboarding: "Onboarding",
  vendor: "Vendor",
  owner: "Homeowner",
};

/** Emails the invite code. Returns how the send went so the UI can say so. */
async function sendInviteEmail(input: {
  email: string;
  name: string;
  role: string;
  code: string;
  note: string;
  expiresAt: string | null;
}) {
  if (!input.email) return { status: "skipped" as const, error: "No email address was provided." };

  const { sendEmail, emailShell } = await import("./email.server");
  const appUrl = "https://smart-stay-support.lovable.app";
  const expires = input.expiresAt ? new Date(input.expiresAt).toLocaleDateString() : null;

  const body = [
    `Hi${input.name ? ` ${input.name}` : ""},`,
    "",
    `You've been invited to join Resolve, the A Real Home Away operations platform, as ${ROLE_LABEL[input.role] ?? input.role}.`,
    "",
    `Your invite code: ${input.code}`,
    "",
    "How to get in:",
    `1. Go to ${appUrl}/auth and create your account with this email address.`,
    `2. Once you're signed in, open ${appUrl}/join and enter the code above.`,
    "",
    input.note ? `Note from your team: ${input.note}` : "",
    expires ? `This code expires on ${expires} and can only be used once.` : "",
    "",
    "Welcome aboard.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const result = await sendEmail({
    to: input.email,
    subject: "Your invite to Resolve — A Real Home Away",
    html: emailShell("You're invited to Resolve", body, { label: "Create your account", url: `${appUrl}/auth` }),
  });
  return { status: result.status, error: result.error };
}


export async function revokeTeamInvite(supabase: Client, userId: string, inviteId: string) {
  await assertAdmin(supabase, userId);
  const { error } = await supabase
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("redeemed_at", null);
  if (error) throw error;
  return { ok: true as const };
}

/**
 * Redeems a code for the signed-in account and applies the invited role.
 * Runs with the service-role client because the redeemer is not an admin yet.
 */
export async function redeemTeamInvite(userId: string, userEmail: string | null, rawCode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = rawCode.trim().toUpperCase();

  const invite = await supabaseAdmin
    .from("team_invites")
    .select("id, role, invitee_email, expires_at, revoked_at, redeemed_by")
    .eq("code", code)
    .maybeSingle();
  if (invite.error) throw invite.error;
  if (!invite.data) throw new Error("That code was not recognised. Check it and try again.");
  if (invite.data.revoked_at) throw new Error("That code was revoked. Ask an admin for a new one.");
  if (invite.data.redeemed_by) throw new Error("That code has already been used.");
  if (new Date(invite.data.expires_at) < new Date()) throw new Error("That code has expired.");
  if (
    invite.data.invitee_email &&
    invite.data.invitee_email.toLowerCase() !== (userEmail ?? "").toLowerCase()
  ) {
    throw new Error("That code was issued to a different email address.");
  }

  const claim = await supabaseAdmin
    .from("team_invites")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("id", invite.data.id)
    .is("redeemed_by", null)
    .select("id")
    .maybeSingle();
  if (claim.error) throw claim.error;
  if (!claim.data) throw new Error("That code has already been used.");

  await applyRole(userId, invite.data.role as AppRole);
  return { ok: true as const, role: invite.data.role as AppRole };
}
