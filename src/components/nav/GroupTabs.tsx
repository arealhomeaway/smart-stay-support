/**
 * Top-of-page tab bar for grouped destinations (My Work, Properties, Work
 * Orders, Claims, Reports, Admin). One sidebar item opens the group's first
 * page; every page in the group shows the same tabs, and each tab appears
 * only for people who can open that page. The registry lives in
 * lib/shell-nav.ts (PAGE_TAB_GROUPS) so the rules stay testable.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useRole } from "@/hooks/useRole";
import { pageTabGroupFor } from "@/lib/shell-nav";
import { cn } from "@/lib/utils";

export function GroupTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, canOpen } = useRole();
  const group = pageTabGroupFor(pathname);
  if (!group) return null;
  const tabs = group.tabs.filter((t) => (!t.capability || can(t.capability)) && canOpen(t.to));
  if (tabs.length < 2) return null;

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1" aria-label={`${group.key} views`}>
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.to
          : pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link
            key={t.label}
            to={t.to}
            search={(t.search ?? {}) as never}
            className={cn(
              "rounded-md border border-transparent px-3 py-1.5 text-sm font-medium",
              active
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
