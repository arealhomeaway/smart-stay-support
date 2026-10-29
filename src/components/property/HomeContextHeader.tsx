import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { readHomeContext } from "@/lib/home-context.functions";
import { homeLifecycle, showOnboardingView } from "@/lib/home-context";
import { useRole } from "@/hooks/useRole";
import { Chip } from "@/components/ui/page";

/** Same compact header on both home pages, with a switch to the other view of this home. */
export function HomeContextHeader({ propertyId, current }: { propertyId: string; current: "operations" | "onboarding" }) {
  const read = useServerFn(readHomeContext);
  const { can } = useRole();
  const q = useQuery({ queryKey: ["home-context", propertyId], queryFn: () => read({ data: { propertyId } }) });
  if (!q.data) return null;
  const h = q.data;
  const life = homeLifecycle({ lifecycleStatus: h.lifecycleStatus, handoffState: h.project?.handoffState ?? null });
  const onboarding = showOnboardingView(Boolean(h.project), can("onboarding_workspace"));
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
