/**
 * A person's own account: their details, their photo and their notification
 * settings. Everything here is scoped to the signed-in person's own row.
 *
 * Photos live in the private `avatars` bucket, one folder per person, and are
 * handed out as short-lived signed links so a teammate's face can appear on the
 * work they are doing without the file being public on the internet.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  preferenceRow,
  readPreferences,
  type NotificationPreferences,
} from "./notification-preferences";

type Client = SupabaseClient<Database>;

export const AVATAR_BUCKET = "avatars";
/** Signed photo links last an hour; the page is refetched long before that. */
const SIGNED_TTL = 60 * 60;

export type PersonCard = {
  id: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  photoUrl: string | null;
};

/** Signed links for stored avatar paths, keyed by the path. */
export async function signAvatars(supabase: Client, paths: string[]) {
  const wanted = [...new Set(paths.filter(Boolean))];
  const signed = new Map<string, string>();
  if (wanted.length === 0) return signed;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(wanted, SIGNED_TTL);
  // A missing photo must never break a page that only wanted to show a face.
  if (error) return signed;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  return signed;
}

/** Everyone with a Resolve profile, with their photo, for showing on work. */
export async function loadPeopleDirectory(supabase: Client): Promise<PersonCard[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, job_title, avatar_url")
    .order("full_name");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const signed = await signAvatars(
    supabase,
    rows.map((r) => r.avatar_url).filter((p): p is string => Boolean(p)),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.full_name || r.email || "Teammate",
    email: r.email,
    jobTitle: r.job_title ?? null,
    photoUrl: r.avatar_url ? (signed.get(r.avatar_url) ?? null) : null,
  }));
}

export type MyAccount = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  signature: string | null;
  avatarPath: string | null;
  photoUrl: string | null;
  preferences: NotificationPreferences;
};

export async function loadMyAccount(supabase: Client, userId: string): Promise<MyAccount> {
  const [profile, prefs] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, job_title, email_signature, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  const row = profile.data;
  const signed = row?.avatar_url ? await signAvatars(supabase, [row.avatar_url]) : null;
  return {
    id: userId,
    fullName: row?.full_name ?? "",
    email: row?.email ?? null,
    phone: row?.phone ?? null,
    jobTitle: row?.job_title ?? null,
    signature: row?.email_signature ?? null,
    avatarPath: row?.avatar_url ?? null,
    photoUrl: row?.avatar_url ? (signed?.get(row.avatar_url) ?? null) : null,
    preferences: readPreferences(prefs.data as Record<string, unknown> | null),
  };
}

export type ProfileEdit = {
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  signature: string | null;
  avatarPath: string | null;
};

export async function saveMyProfileRow(supabase: Client, userId: string, edit: ProfileEdit) {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: edit.fullName,
      phone: edit.phone,
      job_title: edit.jobTitle,
      email_signature: edit.signature,
      avatar_url: edit.avatarPath,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return loadMyAccount(supabase, userId);
}

export async function saveMyPreferences(
  supabase: Client,
  userId: string,
  prefs: NotificationPreferences,
) {
  const { error } = await supabase
    .from("user_notification_preferences")
    .upsert({ user_id: userId, ...preferenceRow(prefs) }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return prefs;
}
