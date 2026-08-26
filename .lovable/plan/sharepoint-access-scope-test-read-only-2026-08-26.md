# SharePoint access-scope test (read-only)

Goal: prove what the linked "ARHA Resolve Integration" SharePoint connector can and cannot see when authorized with resolve.integration@arealhomeaway.com — without writing anything anywhere.

## How the test will run

The connector is linked to the project, but nothing in Resolve calls SharePoint yet, and nothing in this test will add such a call. Instead I will use a **build-time connection**: a one-off authorization used only from this chat session, never wired into the app, never exposed to staff, and never used by a scheduled job.

Steps:

1. I open a Microsoft consent prompt for the SharePoint connector. **You sign in as resolve.integration@arealhomeaway.com** — no other account. If any other account is already signed in on that browser, use a private window.
2. Once consent completes, I make a short list of **read-only** calls (all GET, no writes of any kind):
   - list SharePoint sites the account can see
   - list document libraries on each visible site
   - list the top-level folders of the ARHA Shared Folder library
   - attempt a OneDrive read (expected to fail or return nothing) to prove the boundary
3. I report the results and stop.

## What the report will contain

1. Whether authorization succeeded, and as which account.
2. The exact list of sites and document libraries the account can reach.
3. Whether any OneDrive path, or any SharePoint site outside ARHA Resolve, is reachable.
4. A specific statement about whether Josh's OneDrive is reachable, based on the actual call result.
5. Confirmation that only GET calls were made and no file, folder, permission, or setting changed.

## Explicit guard rails

- No create, upload, edit, move, rename, or delete — GET requests only.
- No OneDrive authorization is requested; a OneDrive read is attempted only to demonstrate that it is blocked.
- `onboarding_sharepoint_docs` and every other workflow flag stay off.
- Offline access stays disabled on the connector client, so no background job can use this authorization.
- No application code, database records, permissions, or scheduled jobs are changed.
- The build-time connection is disposable and separate from any future runtime per-user connection.

## Known limits of what the test can prove

The result reflects **what Microsoft grants this account through the app registration's consented scopes**. If the registration was consented with a tenant-wide scope such as Sites.Read.All, the test may show more sites than just ARHA Resolve — that is a finding to act on in your Microsoft admin center, not something fixable in Resolve. The report will say plainly which of those two situations you are in.

## Technical notes

- Connector: `microsoft_sharepoint`, client "ARHA Resolve Integration" (`allow_offline_access: false`), already linked.
- Calls go through the Lovable connector gateway to Microsoft Graph v1.0: `/sites?search=*`, `/sites/{id}/drives`, `/sites/{id}/drive/root/children`, plus a probe of `/me/drive/root/children` for the OneDrive boundary check.
- Before consent, the Microsoft app registration must list `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` as an authorized redirect URI, or sign-in will fail.
