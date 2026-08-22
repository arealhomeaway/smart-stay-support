import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalCard } from "@/components/PortalCard";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { ROLE_LABELS } from "@/lib/permissions";
import { portalsFor, recentPortalId } from "@/lib/portals";
import { OPEN_STATUSES } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({
    meta: [
      { title: "Your portals — Resolve" },
      {
        name: "description",
        content: "Personalised Resolve home: the ARHA portals you are authorised to open.",
      },
      { property: "og:title", content: "Your portals — Resolve" },
      { property: "og:description", content: "The ARHA portals you are authorised to open." },
    ],
  }),
  component: Hub,
});

function Hub() {
  const { roles, primary, can, isLoading } = useRole();
  const { demoMode } = useDemo();
  const [recent, setRecent] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setRecent(recentPortalId());
    void supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      setName(meta?.full_name ?? data.user?.email ?? null);
    });
  }, []);

  const portals = portalsFor(roles);

  // Attention counts are only shown where Resolve can truthfully derive them.
  const { data: attention } = useQuery({
    queryKey: ["hub-attention", demoMode],
    enabled: can("matters_assigned") || can("matters_all"),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("status, priority")
        .eq("is_demo", demoMode)
        .in("status", OPEN_STATUSES);
      if (error) throw error;
      const open = data?.length ?? 0;
      const urgent = (data ?? []).filter((t) => t.priority === "p1").length;
      return { open, urgent };
    },
  });

  function attentionFor(id: string) {
    if (id !== "operations" || !attention) return undefined;
    if (attention.open === 0) return "Nothing open right now.";
    return `${attention.open} open ${attention.open === 1 ? "matter" : "matters"}${
      attention.urgent ? ` · ${attention.urgent} at P1` : ""
    }`;
  }

  return (
    <div>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Your Resolve home
        </p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
          Welcome back{name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge variant="secondary">{ROLE_LABELS[primary]}</Badge>
          <span>A Real Home Away</span>
        </p>

        {isLoading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : portals.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border bg-card p-8">
            <ShieldAlert className="size-6 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">No portal is assigned to you yet</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Your account is active, but nobody has granted it access to a workspace. Ask a
              Platform Owner or your supervisor to assign your access, then sign in again.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mt-12 text-xl font-semibold">Portals you can open</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {portals.map((portal) => (
                <PortalCard
                  key={portal.id}
                  portal={portal}
                  authenticated
                  recent={recent === portal.id && portals.length > 1}
                  attention={attentionFor(portal.id)}
                />
              ))}
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              One account covers every portal you are authorised for. Return here any time to switch
              workspaces, or read the{" "}
              <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
                Resolve overview
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
