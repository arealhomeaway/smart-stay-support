import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PhotoSummary } from "./marketing-photos";

const input = z.object({ propertyId: z.string().uuid() });

async function context(supabase: any, userId: string, propertyId: string) {
  const { decidePhotoAccess } = await import("./marketing-photos.server");
  const { ownerPropertyAccess } = await import("./owner-property-access.server");
  const staff = await supabase.rpc("is_staff", { _user_id: userId });
  const isStaff = !staff.error && staff.data === true;
  const ownsHome = isStaff ? false : await ownerPropertyAccess(supabase, userId, propertyId);
  const decision = decidePhotoAccess({ isStaff, ownsHome, signedIn: true });
  if (!decision.allow) throw new Error(decision.reason);
  // Only after access is confirmed: read the home's folder name fields.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const home = await supabaseAdmin.from("properties").select("address_line1, name, ownerrez_property_id").eq("id", propertyId).maybeSingle();
  if (home.error || !home.data) throw new Error("That home could not be found.");
  return { isStaff, home: home.data };
}

async function readSummary(home: any) {
  const { sharePointPhotoSource } = await import("./marketing-photos.server");
  const { summarizePhotos } = await import("./marketing-photos");
  const source = await sharePointPhotoSource();
  const listed = await source.list(home);
  return { listed, summary: summarizePhotos(listed.files, listed.hasPath) };
}

/** Owner card: photo count and date, or "not ready" (and a once-a-day notice to the project manager). */
export const marketingPhotoSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ context: ctx, data }): Promise<PhotoSummary> => {
    const { home } = await context(ctx.supabase, ctx.userId, data.propertyId);
    const { summary } = await readSummary(home);
    if (!summary.ready) {
      const notice = await ctx.supabase.rpc("notify_marketing_photos_missing" as never, { _property_id: data.propertyId } as never);
      if (notice.error) console.error("Marketing photos notice:", notice.error.message);
    }
    return summary;
  });

/** Logs the download and returns a single-use link that streams one zip. */
export const startMarketingPhotoDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ context: ctx, data }) => {
    const { home } = await context(ctx.supabase, ctx.userId, data.propertyId);
    const { summary } = await readSummary(home);
    const { PHOTOS_NOT_READY } = await import("./marketing-photos");
    if (!summary.ready) throw new Error(PHOTOS_NOT_READY);
    if (summary.tooLarge) throw new Error("This photo set is too large to download at once. Ask ARHA for help.");
    const { startPhotoDownloadCore } = await import("./marketing-photos.server");
    return startPhotoDownloadCore({
      propertyId: data.propertyId,
      count: summary.count,
      bytes: summary.bytes,
      log: async (args) => ctx.supabase.rpc("request_marketing_photo_download" as never, args as never) as never,
    });
  });

/** Staff only: link to open the home's Marketing Photos folder in SharePoint. */
export const marketingPhotosFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ context: ctx, data }) => {
    const { isStaff, home } = await context(ctx.supabase, ctx.userId, data.propertyId);
    if (!isStaff) throw new Error("Only ARHA staff can open the photos folder.");
    const { staffFolderResult } = await import("./marketing-photos");
    const { listed, summary } = await readSummary(home);
    return staffFolderResult(home, listed.webUrl, summary);
  });
