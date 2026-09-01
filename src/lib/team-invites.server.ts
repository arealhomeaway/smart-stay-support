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
export async function sendInviteEmail(input: {
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
    html: emailShell(
      "You're invited to Resolve",
      body,
      { label: "Create your account", url: `${appUrl}/auth` },
      input.role === "vendor" ? "vendor" : input.role === "owner" ? "owner" : "staff",
    ),
    purpose: "team_invite",
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
    .select("id, role, invitee_email, expires_at, revoked_at, redeemed_by, seat_role_code")
    .eq("code", code)
    .maybeSingle();
  if (invite.error) throw invite.error;
  if (!invite.data) {
    // Homeowner participation codes live in owner_invites. A brand-new homeowner
    // lands on the awaiting-access screen before they hold any role, so this is
    // the only redemption box they can reach.
    const { redeemOwnerInvite } = await import("./owner-portal.server");
    await redeemOwnerInvite(supabaseAdmin, userId, userEmail, code);
    return { ok: true as const, role: "owner" as AppRole };
  }
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

  // The invite already says which seat this person was hired into, so the real
  // auth user is seated the moment it exists. No duplicate account, no phantom
  // seat holder before redemption, and an already-filled seat is never taken
  // over silently.
  const seatCode = (invite.data as { seat_role_code?: string | null }).seat_role_code ?? null;
  if (seatCode) {
    const { data: seat } = await supabaseAdmin
      .from("functional_roles")
      .select("id, code, current_seat_holder, current_seat_name")
      .eq("code", seatCode)
      .maybeSingle();
    if (seat && !(seat as { current_seat_holder: string | null }).current_seat_holder) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();
      const label =
        (profile as { full_name: string | null; email: string | null } | null)?.full_name ??
        (seat as { current_seat_name: string | null }).current_seat_name ??
        userEmail;
      await supabaseAdmin
        .from("functional_roles")
        .update({ current_seat_holder: userId, current_seat_name: label })
        .eq("code", seatCode);
      const { writeAudit } = await import("./audit.server");
      await writeAudit({
        actorId: userId,
        action: "seat.assigned_on_redemption",
        entityType: "functional_role",
        entityId: seatCode,
        entityLabel: seatCode,
        before: { current_seat_holder: null },
        after: { current_seat_holder: userId },
        reason: "Invited staff member redeemed their invitation.",
      });
    }
  }

  return { ok: true as const, role: invite.data.role as AppRole };
}

/** Admin: re-send an existing, still-usable invite code to its locked email address. */
export async function resendTeamInvite(supabase: Client, userId: string, inviteId: string) {
  await assertAdmin(supabase, userId);
  const { data, error } = await supabase
    .from("team_invites")
    .select("code, role, invitee_email, invitee_name, note, expires_at, revoked_at, redeemed_at")
    .eq("id", inviteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That invite no longer exists.");
  if (data.redeemed_at) throw new Error("That code has already been redeemed.");
  if (data.revoked_at) throw new Error("That code was revoked.");
  if (!data.invitee_email) throw new Error("That code has no email address on it — copy the message instead.");

  return sendInviteEmail({
    email: data.invitee_email,
    name: data.invitee_name ?? "",
    role: data.role,
    code: data.code,
    note: data.note ?? "",
    expiresAt: data.expires_at,
  });
}
