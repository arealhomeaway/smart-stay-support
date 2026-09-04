/**
 * Shared, browser-safe SharePoint connector constants.
 *
 * The scope list here is the single source of truth for what the OAuth
 * consent prompt asks Microsoft for. Nothing broader is ever requested:
 * site reach comes from the tenant admin's site-level grant on
 * /sites/ARHAResolve, not from a tenant-wide Files.* or Sites.*.All scope.
 */

export const SHAREPOINT_CONNECTOR_ID = "microsoft_sharepoint";

export const SHAREPOINT_GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

/** Exactly the six delegated scopes admin-consented for app 203e49b8-…. */
export const SHAREPOINT_SCOPES = [
  "openid",
  "profile",
  "email",
  "User.Read",
  "offline_access",
  "Sites.Selected",
] as const;

/** Only this Microsoft identity may hold the SharePoint connection. */
export const REQUIRED_SHAREPOINT_IDENTITY = "resolve.integration@arealhomeaway.com";

/** The ARHA Resolve site the site-level grant covers. */
export const ARHA_RESOLVE_SITE_PATH = "/sites/arealhomeaway.sharepoint.com:/sites/ARHAResolve";
