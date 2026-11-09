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
        const { handleNotifications } = await import("@/lib/email-intake.server");

        // While the email intake switch is off nothing is fetched or created.
        const outcome = await handleNotifications(
          supabaseAdmin,
          notifications.map((n) => n.resourceData?.id ?? "").filter(Boolean),
        );
        if (outcome.refused) {
          return new Response(outcome.message ?? "Email intake is off.", {
            status: 202,
            headers: { "Content-Type": "text/plain" },
          });
        }

        // Graph expects a fast 202 regardless; anything missed here is caught
        // by the reconciliation sweep.
        return new Response("", { status: 202 });
      },
    },
  },
});
