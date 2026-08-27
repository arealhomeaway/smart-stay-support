import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SHAREPOINT_CONNECTOR_ID } from "@/lib/sharepoint";

/**
 * App-side landing page for the connector-gateway redirect.
 *
 * This is NOT the registered OAuth redirect URI — Microsoft only ever sees
 * https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback.
 * The gateway completes the provider handshake and then forwards the browser
 * here with a one-time code, which this page hands to the opener window. The
 * connection key itself never reaches the browser.
 */
export const Route = createFileRoute("/oauth/sharepoint/return")({
  ssr: false,
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing the SharePoint connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: SHAREPOINT_CONNECTOR_ID, code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Authorization did not complete.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      setMessage("Authorization completed without an exchange code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);

  return <p className="p-6 text-sm text-muted-foreground">{message}</p>;
}
