import { createFileRoute } from "@tanstack/react-router";

/**
 * Microsoft Graph change notifications for the team inbox.
 *
 * Graph tells us "message X in the authorised mailbox changed" — in any
 * folder, because Outlook rules route mail to the team that owns it. It does not tell
 * us what changed, and it is not trusted to: Resolve reads the message back
 * through the allowlisted mailbox path and decides from the categories it
 * finds there. A notification for an ordinary read/unread change therefore
 * simply results in nothing happening.
 *
 * Deliveries can arrive twice, out of order, or late. That is safe here: the
 * durable per-message mapping (behind a unique index) is what guarantees one
 * email produces at most one Resolve record.
 */
export const Route = createFileRoute("/api/public/hooks/outlook/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);

        // Graph's subscription handshake: echo the token back as plain text.
        const validationToken = url.searchParams.get("validationToken");
        if (validationToken) {
          return new Response(validationToken, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }

        let payload: { value?: { clientState?: string; resourceData?: { id?: string } | null }[] };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { isTrustedNotification } = await import("@/lib/outlook-subscription.server");
        const notifications = (payload.value ?? []).filter((n) =>
          isTrustedNotification(n.clientState),
        );
        if (notifications.length === 0) {
          // Unsigned or unrecognised — acknowledge without doing any work, so
          // Graph does not retry, but nothing is processed.
          return new Response("", { status: 202 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { fetchMessage, processMessage } = await import("@/lib/mailbox.server");

        for (const notification of notifications.slice(0, 20)) {
          const id = notification.resourceData?.id;
          if (!id) continue;
          try {
            const message = await fetchMessage(id);
            if (!message) continue;
            await processMessage(supabaseAdmin, message);
          } catch (err) {
            console.error("Outlook notification failed:", err instanceof Error ? err.message : err);
          }
        }

        // Graph expects a fast 202 regardless; anything missed here is caught
        // by the reconciliation sweep.
        return new Response("", { status: 202 });
      },
    },
  },
});
