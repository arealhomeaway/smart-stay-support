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
