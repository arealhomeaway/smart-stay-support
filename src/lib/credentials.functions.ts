/**
 * Credential server functions. Thin wrappers — every access decision is made
 * (and re-made) inside credentials.server.ts on each call.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CredentialCategory } from "@/lib/credentials.server";

export const listCredentialsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/credentials.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.listCredentials(viewer, data.propertyId);
  });

export const revealCredentialFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { credentialId: string; action: "reveal" | "copy" }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/credentials.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.revealCredential(viewer, data.credentialId, data.action);
  });

export const saveCredentialFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      propertyId: string;
      category: CredentialCategory;
      label: string;
      username?: string | null;
      secret?: string | null;
      instructions?: string | null;
      lastVerifiedOn?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/credentials.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.saveCredential(viewer, data);
  });

export const verifyCredentialFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { credentialId: string }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/credentials.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.verifyCredential(viewer, data.credentialId);
  });

export const archiveCredentialFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { credentialId: string }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/credentials.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.archiveCredential(viewer, data.credentialId);
  });
