import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { readHomeContext } from "@/lib/home-context.functions";
import { homeLifecycle, showOnboardingView } from "@/lib/home-context";
import { useRole } from "@/hooks/useRole";
import { Chip } from "@/components/ui/page";

/**
 * Same compact header on both home pages, with a switch to the other view of this home.
 * `line` (onboarding home, Nov 12 item 31) puts everything on one header line:
 * the breadcrumb (`before`), the home name, the status chip, `after` (Follow this home)
 * and a small view toggle. The Operations home keeps the boxed layout.
 */
export function HomeContextHeader({
  propertyId,
  current,
  line,
  toggleOnly = false,
}: {
  propertyId: string;
  current: "operations" | "onboarding";
  line?: { before?: ReactNode; after?: ReactNode };
  /** Property page Part 1: only the small Operations view / Onboarding view switch. */
  toggleOnly?: boolean;
}) {
  const read = useServerFn(readHomeContext);
  const { can } = useRole();
  const q = useQuery({ queryKey: ["home-context", propertyId], queryFn: () => read({ data: { propertyId } }) });
  if (!q.data) return null;
  const h = q.data;
  const life = homeLifecycle({ lifecycleStatus: h.lifecycleStatus, handoffState: h.project?.handoffState ?? null });
  const onboarding = showOnboardingView(Boolean(h.project), can("onboarding_workspace"));
  if (line || toggleOnly) {
    const pill = (active: boolean) =>
      `inline-flex min-h-11 items-center rounded px-2.5 text-xs sm:min-h-8 ${active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`;
    const toggle = (
      <nav aria-label="Switch view" className="ml-auto flex rounded-md bg-muted p-0.5">
        <Link to="/property/$propertyId" params={{ propertyId }} className={pill(current === "operations")} aria-current={current === "operations" ? "page" : undefined}>
          Operations view
        </Link>
        {onboarding ? (
          <Link to="/onboarding/$propertyId" params={{ propertyId }} className={pill(current === "onboarding")} aria-current={current === "onboarding" ? "page" : undefined}>
            Onboarding view
          </Link>
        ) : null}
      </nav>
    );
    if (toggleOnly || !line) return toggle;
    return (
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="This home">
        {line.before}
        <h1 className="min-w-0 truncate font-display text-2xl leading-tight sm:text-3xl">{h.name}</h1>
        <Chip>{life}</Chip>
        {line.after}
        <nav aria-label="Switch view" className="ml-auto flex rounded-md bg-muted p-0.5">
          <Link to="/property/$propertyId" params={{ propertyId }} className={pill(current === "operations")} aria-current={current === "operations" ? "page" : undefined}>
            Operations view
          </Link>
          {onboarding ? (
            <Link to="/onboarding/$propertyId" params={{ propertyId }} className={pill(current === "onboarding")} aria-current={current === "onboarding" ? "page" : undefined}>
              Onboarding view
            </Link>
          ) : null}
        </nav>
      </header>
    );
  }
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-2.5" aria-label="This home">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{h.name}</p>
        {h.address ? <p className="truncate text-xs text-muted-foreground">{h.address}</p> : null}
      </div>
      <Chip>{life}</Chip>
      <nav aria-label="Switch view" className="flex rounded-lg bg-muted p-1">
        <Link to="/property/$propertyId" params={{ propertyId }} className={tab(current === "operations")} aria-current={current === "operations" ? "page" : undefined}>
          Operations view
        </Link>
        {onboarding ? (
          <Link to="/onboarding/$propertyId" params={{ propertyId }} className={tab(current === "onboarding")} aria-current={current === "onboarding" ? "page" : undefined}>
            Onboarding view
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
