<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Navigation rule (Resolve V2 standing rule)
NO NEW PAGE OR FEATURE IS COMPLETE IF THE USER CANNOT NAVIGATE INTO IT AND BACK OUT OF IT WHILE PRESERVING THEIR PROPERTY/DEPARTMENT CONTEXT.
Department menus, breadcrumbs and Back come from the app shell (`src/lib/shell-nav.ts` + `src/components/nav/ShellNav.tsx`). New routes register their department/label there; pages never build their own. A page may name its current view with `useShellPageLabel`.

## Help & Feedback rule (Resolve standing rule)
Every current and future Resolve page inherits the global ? Help & Feedback control from the shared app shell (`src/components/HelpFeedback.tsx`, rendered once in `AppShell`). Never add it per page. It files Resolve Help Tickets (`help_tickets`), never Operations tickets.
- Homeowner⇄ARHA conversations live in append-only `owner_request_messages` (one thread per owner-facing request, written only via post/resolve/reopen RPCs); status is derived from the last speaker — never store it twice.
- STR cleaner-time nightly check (cron `str-cleaner-time-nightly`, 07:00/07:30/08:00/08:30 UTC): the 07:00 UTC pass is primary (2 a.m. Central in CDT; 1 a.m. in CST); the 07:30, 08:00 and 08:30 passes are retries that resume an unfinished run and are no-ops once that night's run is complete (08:00 is the 2 a.m. pass in CST). Why: resumable slices survive timeouts without duplicate work.
