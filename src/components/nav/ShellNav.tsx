import { formatPropertyLabel } from "@/lib/property-label";
/**
 * Shell-level navigation, rendered once by AppShell above every page:
 * department menu + functional breadcrumbs + Back to the logical parent.
 * Pages may name their current view with `useShellPageLabel`, nothing more.
 */
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { buildTrail, departmentFor, parentOf } from "@/lib/shell-nav";

const PageLabelCtx = createContext<(label: string | null) => void>(() => {});

export function ShellNavProvider({ children }: { children: (label: string | null) => ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setLabel(null), [pathname]);
  return <PageLabelCtx.Provider value={setLabel}>{children(label)}</PageLabelCtx.Provider>;
}

/** Let a page name its current view in the breadcrumb (e.g. a template name). */
export function useShellPageLabel(label: string | null | undefined) {
  const set = useContext(PageLabelCtx);
  useEffect(() => {
    set(label ?? null);
    return () => set(null);
  }, [label, set]);
}

function usePropertyName(propertyId: string | undefined) {
  const { data } = useQuery({
    queryKey: ["shell-property-name", propertyId],
    enabled: Boolean(propertyId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id")
        .eq("id", propertyId!)
        .maybeSingle();
      return (formatPropertyLabel(data).primary) as string | null;
    },
  });
  return data ?? null;
}

export function ShellNav({
  pageLabel,
  hideDepartmentMenu = false,
}: {
  pageLabel: string | null;
  /** The sidebar already lists this department's destinations. */
  hideDepartmentMenu?: boolean;
}) {
  const location = useRouterState({ select: (s) => s.location });
  const params = useParams({ strict: false }) as { propertyId?: string };
  const { can } = useRole();
  const propertyName = usePropertyName(params.propertyId);
  const search = (location.search ?? {}) as Record<string, unknown>;
  const trail = buildTrail({ pathname: location.pathname, search, propertyName, pageLabel });
  const parent = parentOf(trail);
  const dept = departmentFor(location.pathname);
  const links = hideDepartmentMenu
    ? []
    : (dept?.links.filter((l) => !l.capability || can(l.capability)) ?? []);

  if ((!dept || links.length === 0) && trail.length < 2) return null;

  return (
    <div className="mb-5 space-y-3">
      {dept && links.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1" aria-label={`${dept.label} navigation`}>
          {links.map((l) => {
            const active =
              location.pathname === l.to &&
              (l.search
                ? Object.entries(l.search).every(([k, v]) => search[k] === v)
                : !l.exact || !("lens" in search) || search["lens"] !== "all");
            const activeNested = !l.exact && location.pathname.startsWith(l.to + "/");
            return (
              <Link
                key={l.label}
                to={l.to}
                search={(l.search ?? {}) as never}
                className={cn(
                  "rounded-md border border-transparent px-3 py-1.5 text-sm font-medium",
                  active || activeNested
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
      {trail.length >= 2 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {parent && (
            <Link
              to={parent.to}
              search={(parent.search ?? {}) as never}
              className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to {parent.label}
            </Link>
          )}
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center text-xs text-muted-foreground"
          >
            {trail.map((c, i) => {
              const last = i === trail.length - 1;
              return (
                <span key={`${c.label}-${i}`} className="inline-flex items-center">
                  {i > 0 && <ChevronRight className="mx-1 size-3 opacity-60" aria-hidden="true" />}
                  {last ? (
                    <span className="text-foreground" aria-current="page">
                      {c.label}
                    </span>
                  ) : (
                    <Link
                      to={c.to}
                      search={(c.search ?? {}) as never}
                      className="hover:text-foreground hover:underline"
                    >
                      {c.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
