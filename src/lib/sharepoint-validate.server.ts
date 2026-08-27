/**
 * Read-only validation probes for the stored ARHA Resolve SharePoint
 * connection.
 *
 * Every probe is a GET. Nothing is created, uploaded, modified, moved or
 * deleted, and no credential, token or connection key is ever returned.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getSharePointConnectionKey } from "@/lib/sharepoint-connection.server";
import { SHAREPOINT_CONNECTOR_ID, SHAREPOINT_GATEWAY_BASE_URL } from "@/lib/sharepoint";

export type Probe = {
  label: string;
  path: string;
  expectation: "allow" | "deny";
  status: number | null;
  ok: boolean;
  /** Short, non-secret summary of the response body. */
  detail: string;
  verdict: "accessible" | "denied" | "not-found" | "error" | "untested";
};

const JOSH_UPN = "josh@arealhomeaway.com";
const ARHA_RESOLVE_SITE = "/sites/arealhomeaway.sharepoint.com:/sites/ARHAResolve";

function summarize(status: number, body: string): { detail: string; code: string | null } {
  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: string; message?: string };
      id?: string;
      name?: string;
      displayName?: string;
      webUrl?: string;
      mail?: string;
      userPrincipalName?: string;
      value?: Array<{ name?: string; id?: string }>;
    };
    if (parsed.error) {
      return {
        detail: `${parsed.error.code ?? "error"}: ${(parsed.error.message ?? "").slice(0, 200)}`,
        code: parsed.error.code ?? null,
      };
    }
    if (Array.isArray(parsed.value)) {
      return { detail: parsed.value.map((v) => v.name ?? v.id ?? "?").join(", ") || "(empty)", code: null };
    }
    const name =
      parsed.mail ?? parsed.userPrincipalName ?? parsed.displayName ?? parsed.name ?? parsed.id ?? "";
    return { detail: [name, parsed.webUrl].filter(Boolean).join(" · ").slice(0, 300), code: null };
  } catch {
    return { detail: `${status} (non-JSON response)`, code: null };
  }
}

async function probe(
  connectionAPIKey: string,
  label: string,
  path: string,
  expectation: "allow" | "deny",
): Promise<Probe> {
  try {
    const res = await callAsAppUser({
      gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL,
      connectorId: SHAREPOINT_CONNECTOR_ID,
      connectionAPIKey,
      path,
    });
    const body = await res.text();
    const { detail, code } = summarize(res.status, body);
    let verdict: Probe["verdict"];
    if (res.ok) verdict = "accessible";
    else if (res.status === 401 || res.status === 403) verdict = "denied";
    else if (res.status === 404 || code === "itemNotFound" || code === "resourceNotFound")
      verdict = "not-found";
    else verdict = "error";
    return { label, path, expectation, status: res.status, ok: res.ok, detail, verdict };
  } catch (error) {
    return {
      label,
      path,
      expectation,
      status: null,
      ok: false,
      detail: error instanceof Error ? error.message.slice(0, 200) : "request failed",
      verdict: "error",
    };
  }
}

export async function runSharePointReadOnlyValidation(userId: string) {
  const key = await getSharePointConnectionKey(userId);
  if (!key) {
    return {
      ranAt: new Date().toISOString(),
      connectionFound: false as const,
      probes: [] as Probe[],
    };
  }

  const probes: Probe[] = [];

  // 1. Live identity of the saved connection.
  probes.push(
    await probe(key, "Live identity (/me)", "/me?$select=mail,userPrincipalName,displayName", "allow"),
  );

  // 2. Granted site + its Documents library.
  const site = await probe(key, "ARHA Resolve site", `${ARHA_RESOLVE_SITE}?$select=id,displayName,webUrl`, "allow");
  probes.push(site);
  probes.push(
    await probe(key, "ARHA Resolve document libraries", `${ARHA_RESOLVE_SITE}:/drives?$select=name,id`, "allow"),
  );
  probes.push(
    await probe(
      key,
      "ARHA Resolve default Documents library (metadata only)",
      `${ARHA_RESOLVE_SITE}:/drive?$select=name,id,webUrl`,
      "allow",
    ),
  );

  // 3. Denial probes against known, valid resource identifiers. Metadata only —
  //    no listing of children, so nothing inside them is enumerated or read.
  probes.push(await probe(key, "Josh's OneDrive (known UPN)", `/users/${JOSH_UPN}/drive?$select=id,name`, "deny"));
  probes.push(
    await probe(key, "Service account's own OneDrive", "/me/drive?$select=id,name", "deny"),
  );
  probes.push(
    await probe(key, "Tenant root SharePoint site", "/sites/root?$select=id,displayName", "deny"),
  );
  probes.push(
    await probe(
      key,
      "Legacy Customer Service location (path lookup)",
      "/sites/arealhomeaway.sharepoint.com:/sites/CustomerService?$select=id,displayName",
      "deny",
    ),
  );
  probes.push(
    await probe(key, "Cross-site discovery (search all sites)", "/sites?search=*&$select=id,displayName", "deny"),
  );

  return { ranAt: new Date().toISOString(), connectionFound: true as const, probes };
}
