/**
 * Account settings — server calls.
 *
 * Every call acts as the signed-in person and only ever touches their own row.
 * The people directory is readable by any signed-in teammate because faces are
 * shown on shared work; it carries no private detail beyond name, role title
 * and work email.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  type NotificationPreferences,
} from "./notification-preferences";

type Ctx = { supabase: never; userId: string };

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMyAccount } = await import("./account.server");
    return loadMyAccount((context as unknown as Ctx).supabase, context.userId);
  });

export const peopleDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadPeopleDirectory } = await import("./account.server");
    return loadPeopleDirectory((context as unknown as Ctx).supabase);
  });

function text(value: unknown, max: number, label: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length > max) throw new Error(`Keep ${label} under ${max} characters.`);
  return trimmed;
}

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      fullName: string;
      phone?: string;
      jobTitle?: string;
      signature?: string;
      avatarPath?: string | null;
    }) => {
      const fullName = text(input?.fullName, 120, "your name");
      if (!fullName) throw new Error("Please enter your name.");
      const avatarPath =
        typeof input?.avatarPath === "string" && input.avatarPath ? input.avatarPath : null;
      return {
        fullName,
        phone: text(input?.phone, 40, "your phone number") || null,
        jobTitle: text(input?.jobTitle, 80, "your role") || null,
        signature: text(input?.signature, 600, "your signature") || null,
        avatarPath,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { saveMyProfileRow } = await import("./account.server");
    // A photo path is only ever accepted inside the person's own folder.
    if (data.avatarPath && !data.avatarPath.startsWith(`${context.userId}/`)) {
      throw new Error("That photo does not belong to your account.");
    }
    return saveMyProfileRow((context as unknown as Ctx).supabase, context.userId, data);
  });

export const saveMyNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NotificationPreferences) => {
    const prefs: NotificationPreferences = {
      emailEnabled: input?.emailEnabled !== false,
      email: { ...DEFAULT_PREFERENCES.email },
      inApp: { ...DEFAULT_PREFERENCES.inApp },
    };
    for (const { key } of NOTIFICATION_CATEGORIES) {
      prefs.email[key] = input?.email?.[key] !== false;
      prefs.inApp[key] = input?.inApp?.[key] !== false;
    }
    return prefs;
  })
  .handler(async ({ data, context }) => {
    const { saveMyPreferences } = await import("./account.server");
    return saveMyPreferences((context as unknown as Ctx).supabase, context.userId, data);
  });
