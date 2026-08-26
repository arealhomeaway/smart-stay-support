# Scope down SharePoint access to ARHA Resolve only

Admin-side change only. No app code, database records, connections, folders, or feature flags change during this work. No file reads or writes happen at any point.

## Target end state

| Item | Value |
|---|---|
| Site | ARHA Resolve, `https://arealhomeaway.sharepoint.com/sites/ARHAResolve` |
| Site ID | `arealhomeaway.sharepoint.com,973560d0-454a-41fd-804c-659e7e460f83,67ecd2c1-b4e6-40d9-9eac-00c4b241c0bc` |
| Library | `Documents` (Shared Documents), drive ID `b!0GA1l0pF_UGATGWefkYPg8HS7GfmtNlAnqwAxLJBwLwYFC_w8_PAQZ-W78Pw_f6p` |
| Graph permission | Delegated `Sites.Selected` only |
| Site grant | `read` role on ARHA Resolve, nothing else |
| Kept | `User.Read` |
| Removed | `Sites.Read.All`, `Sites.ReadWrite.All`, `Files.Read.All`, `Files.ReadWrite.All`, and any other tenant-wide SharePoint or OneDrive data permission |
| Not in scope | Customer Service legacy folders, other sites, OneDrive, write access, offline access, `onboarding_sharepoint_docs` |

Customer Service legacy folders are excluded entirely: not referenced, not allowlisted, not read, not migrated. ARHA Resolve is a fresh start.

## Why Sites.Selected

`Sites.Selected` grants nothing by itself. It is two parts:

1. The app registration holds the permission, which alone resolves to zero sites.
2. A tenant admin grants that specific app a role on one specific site. Only granted sites respond.

Site enumeration then returns nothing useful, and OneDrive is out of reach because `Sites.Selected` does not cover personal drives.

Use the delegated flavor, since the connector signs in as `resolve.integration@arealhomeaway.com`. Effective access becomes the intersection of what that account can see and what the site grant allows, which is tighter than app-only.

## Stage A - Entra app registration

Sign in at `https://entra.microsoft.com` as Global Administrator or Application Administrator, open **Applications > App registrations**, select the registration behind the "ARHA Resolve Integration" connector client, and open **API permissions**.

1. Review the full permission list first and note every Microsoft Graph SharePoint or OneDrive data permission present.
2. Remove each of these if listed, delegated or application: `Sites.Read.All`, `Sites.ReadWrite.All`, `Sites.Manage.All`, `Sites.FullControl.All`, `Files.Read`, `Files.Read.All`, `Files.ReadWrite`, `Files.ReadWrite.All`, `Files.ReadWrite.AppFolder`. Use the "..." menu next to each row, then **Remove permission**.
3. Keep `User.Read`. Keep `openid`, `profile`, `email`, and `offline_access` sign-in scopes.
4. Click **Add a permission > Microsoft Graph > Delegated permissions**, search `Sites.Selected`, tick it, then **Add permissions**. Do not add the Application variant.
5. Click **Grant admin consent for A Real Home Away** and confirm. The `Sites.Selected` row should read "Granted for A Real Home Away".
6. Under **Authentication**, confirm `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` is still a redirect URI. Do not remove it.
7. Copy the **Application (client) ID** from **Overview**. Stage B needs it.

Screenshot the API permissions list before and after, so the removal is evidenced.

## Stage B - Grant read on ARHA Resolve only

There is no portal UI for this. It is one Graph call by an admin holding `Sites.FullControl.All`.

**Option 1 - Graph Explorer** (`https://developer.microsoft.com/graph/graph-explorer`), signed in as SharePoint or Global Administrator with `Sites.FullControl.All` consented in the permissions tab:

```
POST https://graph.microsoft.com/v1.0/sites/arealhomeaway.sharepoint.com,973560d0-454a-41fd-804c-659e7e460f83,67ecd2c1-b4e6-40d9-9eac-00c4b241c0bc/permissions
Content-Type: application/json

{
  "roles": ["read"],
  "grantedToIdentities": [
    {
      "application": {
        "id": "<APPLICATION_CLIENT_ID_FROM_STAGE_A_STEP_7>",
        "displayName": "ARHA Resolve Integration"
      }
    }
  ]
}
```

`"roles": ["read"]` is required. Do not use `write`, `manage`, or `fullcontrol`. Save the permission `id` from the response, since a future revoke uses it.

**Option 2 - PnP PowerShell:**

```powershell
Connect-PnPOnline -Url "https://arealhomeaway.sharepoint.com/sites/ARHAResolve" -Interactive
Grant-PnPAzureADAppSitePermission `
  -AppId "<APPLICATION_CLIENT_ID>" `
  -DisplayName "ARHA Resolve Integration" `
  -Site "https://arealhomeaway.sharepoint.com/sites/ARHAResolve" `
  -Permissions Read
```

Grant this site and no other.

## Stage C - Verify the grant

In Graph Explorer as admin:

```
GET https://graph.microsoft.com/v1.0/sites/arealhomeaway.sharepoint.com,973560d0-454a-41fd-804c-659e7e460f83,67ecd2c1-b4e6-40d9-9eac-00c4b241c0bc/permissions
```

Expect one entry naming ARHA Resolve Integration with role `read`. If other apps appear, review them separately. Do not delete anything as part of this change.

## Stage D - Reconnect and re-test, on your go-ahead

The current build-time connection still carries the old tenant-wide grant, so it must be revoked and re-authorized.

1. Revoke the current build-time connection.
2. A workspace admin sets the connector client's scope list to `openid profile email Sites.Selected` and removes `Sites.Read.All`. Offline access stays off.
3. Sign the consent prompt as `resolve.integration@arealhomeaway.com`, with no other Microsoft session active in that browser.
4. Re-run read-only verification, expecting:
   - `/me` returns the service account.
   - Site search returns nothing, or only ARHA Resolve.
   - ARHA Resolve and its `Documents` library resolve normally.
   - Any other site returns `403`.
   - Any OneDrive path for another user returns `403`.
   - Any write attempt returns `403`.

## Library-level scoping

Microsoft's permission model stops at the site. No Graph permission narrows access to a single library, so "Documents library only" is enforced app-side: pin the drive ID above and reject any path outside it. That is Resolve code work, proposed separately after Stage D verifies, and no legacy-folder allowlist or deny list is part of it.

## Rollback

An admin deletes the site permission (`DELETE /sites/{site-id}/permissions/{permission-id}`) and re-adds the prior permissions in the app registration. The connection then needs one more re-authorization.

## Unchanged throughout

- `onboarding_sharepoint_docs` stays disabled.
- Offline access on the connector client stays off.
- No write permission is added at any stage.
- No workflow, sync job, or feature flag is enabled.
- No Resolve code or database change is made in Stages A through D.
