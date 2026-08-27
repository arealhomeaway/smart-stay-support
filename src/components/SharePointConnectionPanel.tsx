import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, PlugZap, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRole } from "@/hooks/useRole";
import {
  REQUIRED_SHAREPOINT_IDENTITY,
  SHAREPOINT_CONNECTOR_ID,
  SHAREPOINT_SCOPES,
} from "@/lib/sharepoint";
import {
  completeSharePointConnect,
  inspectSharePointAuthRequest,
  revokeSharePointConnect,
  sharePointConnectionStatus,
  startSharePointConnect,
  validateSharePointAccess,
} from "@/lib/sharepoint.functions";

type Inspection = Awaited<ReturnType<typeof inspectSharePointAuthRequest>>;
type Validation = Awaited<ReturnType<typeof validateSharePointAccess>>;


function waitForOAuthCompletion(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== SHAREPOINT_CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("Authorization failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The sign-in window closed before authorization finished."));
    }, 500);
  });
}

/**
 * Admin-only control for the ARHA Resolve SharePoint connection.
 *
 * The UI gate below is cosmetic — every server function it calls runs
 * `assertAdmin` before doing anything, including the callback/exchange.
 */
export function SharePointConnectionPanel() {
  const { isPlatformOwner, readOnly, isLoading } = useRole();
  const qc = useQueryClient();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);


  const statusFn = useServerFn(sharePointConnectionStatus);
  const inspectFn = useServerFn(inspectSharePointAuthRequest);
  const startFn = useServerFn(startSharePointConnect);
  const completeFn = useServerFn(completeSharePointConnect);
  const revokeFn = useServerFn(revokeSharePointConnect);
  const validateFn = useServerFn(validateSharePointAccess);


  const status = useQuery({
    queryKey: ["sharepoint-connection"],
    enabled: isPlatformOwner,
    queryFn: () => statusFn(),
  });

  const inspect = useMutation({
    mutationFn: () => inspectFn(),
    onSuccess: (data) => {
      setInspection(data);
      toast.success("Authorization request generated and inspected.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connect = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "arha-sharepoint-oauth", "width=600,height=720");
      if (!popup) throw new Error("Popup blocked. Allow popups and try again.");
      let code: string | null;
      try {
        const { authorizationUrl } = await startFn();
        const completion = waitForOAuthCompletion(popup);
        popup.location.href = authorizationUrl;
        code = await completion;
      } catch (error) {
        popup.close();
        throw error;
      }
      if (!code) throw new Error("Authorization returned no exchange code.");
      return completeFn({ data: { code } });
    },
    onSuccess: (result) => {
      if (result && "ok" in result && !result.ok) toast.error(result.message);
      else toast.success(`Connected as ${REQUIRED_SHAREPOINT_IDENTITY}.`);
      void qc.invalidateQueries({ queryKey: ["sharepoint-connection"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: () => revokeFn(),
    onSuccess: () => {
      toast.success("Connection revoked.");
      void qc.invalidateQueries({ queryKey: ["sharepoint-connection"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validate = useMutation({
    mutationFn: () => validateFn(),
    onSuccess: (data) => {
      setValidation(data);
      toast.success("Read-only validation finished.");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading || !isPlatformOwner) return null;

  const connected = status.data?.connected ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlugZap className="size-4" /> SharePoint — ARHA Resolve site
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3" /> Administrators only
          </Badge>
        </CardTitle>
        <CardDescription>
          Authorization is restricted to administrators and enforced on the server for both starting
          the connection and completing the callback. The connection is only kept when Microsoft
          confirms the identity is {REQUIRED_SHAREPOINT_IDENTITY}; anything else is revoked on the
          spot. Requested scopes are pinned to: {SHAREPOINT_SCOPES.join(" ")}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {connected && status.data?.identity ? (
          <p className="text-muted-foreground">
            Held by <span className="font-medium text-foreground">{status.data.identity}</span>
            {status.data.updatedAt
              ? ` · updated ${new Date(status.data.updatedAt).toLocaleString()}`
              : null}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={readOnly || inspect.isPending}
            onClick={() => inspect.mutate()}
          >
            <Search className="size-4" /> Verify authorization request
          </Button>
          <Button
            disabled={readOnly || connect.isPending || !inspection?.matchesPinnedScopes}
            onClick={() => connect.mutate()}
          >
            Open Microsoft sign-in
          </Button>
          {connected ? (
            <Button variant="ghost" disabled={readOnly || revoke.isPending} onClick={() => revoke.mutate()}>
              Revoke
            </Button>
          ) : null}
        </div>

        {!inspection ? (
          <p className="text-xs text-muted-foreground">
            Verify the request first — sign-in stays disabled until the generated request matches the
            approved scope list exactly.
          </p>
        ) : (
          <dl className="grid gap-2 rounded-lg border border-border p-4 text-xs sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Client ID</dt>
            <dd className="font-mono break-all">{inspection.clientId ?? "—"}</dd>
            <dt className="text-muted-foreground">Tenant</dt>
            <dd className="font-mono break-all">
              {inspection.tenant ?? "—"} <span className="text-muted-foreground">({inspection.authority})</span>
            </dd>
            <dt className="text-muted-foreground">Redirect URI</dt>
            <dd className="font-mono break-all">{inspection.redirectUri ?? "—"}</dd>
            <dt className="text-muted-foreground">Decoded scopes</dt>
            <dd className="font-mono break-all">{inspection.scopes.join(" ") || "—"}</dd>
            <dt className="text-muted-foreground">Scope check</dt>
            <dd>
              {inspection.matchesPinnedScopes ? (
                <Badge>Matches approved list</Badge>
              ) : (
                <Badge variant="destructive">Does not match — do not sign in</Badge>
              )}
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
