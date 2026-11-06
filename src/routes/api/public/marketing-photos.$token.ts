import { createFileRoute } from "@tanstack/react-router";

/**
 * Streams one home's marketing photos as a zip.
 *
 * The link comes only from startMarketingPhotoDownload, which checks the
 * signed-in caller owns the home (or is staff) and logs the download. The
 * token is single use and expires after two minutes; only its hash is stored.
 */
export const Route = createFileRoute("/api/public/marketing-photos/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "");
        if (!/^[a-f0-9]{64}$/.test(token)) return new Response("This download link is not valid.", { status: 404 });
        const { sha256Hex, sharePointPhotoSource, streamPhotoZip } = await import("@/lib/marketing-photos.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const claim = await supabaseAdmin.rpc("claim_marketing_photo_download" as never, { _token_hash: await sha256Hex(token) } as never);
        const row = (claim.data as unknown as { property_id: string }[] | null)?.[0];
        if (claim.error || !row) return new Response("This download link has expired. Go back and press Download all photos again.", { status: 410 });
        const home = await supabaseAdmin.from("properties").select("address_line1, name, ownerrez_property_id").eq("id", row.property_id).maybeSingle();
        if (home.error || !home.data) return new Response("That home could not be found.", { status: 404 });
        try {
          const source = await sharePointPhotoSource();
          const listed = await source.list(home.data);
          if (!listed.files?.length) return new Response("Photos aren't ready yet.", { status: 404 });
          const name = `${(home.data.address_line1 || home.data.name || "Home").replace(/[^\w .-]/g, "")} marketing photos.zip`;
          return new Response(streamPhotoZip(listed.files, source.open), {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": `attachment; filename="${name}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error("Marketing photos download:", e);
          return new Response("Photos could not be read right now. Please try again later.", { status: 502 });
        }
      },
    },
  },
});
