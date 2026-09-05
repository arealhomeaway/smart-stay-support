import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalCard } from "@/components/PortalCard";
import { EmptyState } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
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
  const { roles, identityLabel, previewing, can, isLoading } = useRole();
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
        .is("archived_at", null)
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
    return `${attention.open} open ${attention.open === 1 ? "ticket" : "tickets"}${
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
          {/* A preview shows the previewed identity, never the real signed-in
              admin's own name — the badge below already names who this is. */}
          Welcome back{!previewing && name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground">
          <StatusBadge tone="brand">{identityLabel}</StatusBadge>
          <span>A Real Home Away</span>
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : portals.length === 0 ? (
          <EmptyState
            className="mt-10 border border-border bg-card"
            title="No portal is assigned to you yet"
            hint="Ask a Platform Owner or your supervisor to give you access, then sign in again."
          />
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
