import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { portalsFor, rememberPortal } from "@/lib/portals";

export const Route = createFileRoute("/_authenticated/demo")({
  head: () => ({
    meta: [
      { title: "Demo — Resolve" },
      {
        name: "description",
        content: "Try any Resolve portal you have access to, using demo records only.",
      },
      { property: "og:title", content: "Demo — Resolve" },
      {
        property: "og:description",
        content: "Try any Resolve portal you have access to, using demo records only.",
      },
    ],
  }),
  component: DemoHome,
});

/**
 * The Demo home: one card per portal the signed-in person may open, and
 * nothing else. No personas, no property pickers, no seeding controls —
 * demo is simply on, and every portal behind these cards shows demo records.
 */
function DemoHome() {
  const router = useRouter();
  const { roles, isLoading } = useRole();
  const { demoMode, canDemo, enterDemo } = useDemo();
  const portals = portalsFor(roles);

  // Landing here is itself the request to demo.
  useEffect(() => {
    if (canDemo && !demoMode) enterDemo();
  }, [canDemo, demoMode, enterDemo]);

  function open(id: string, route: string) {
    rememberPortal(id);
    void router.navigate({ to: route });
  }

  return (
    <div>
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Demo</p>
      <h1 className="mt-3 flex items-center gap-3 text-3xl font-semibold md:text-4xl">
        <FlaskConical className="size-7 text-primary" /> Try Resolve safely
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Open any portal below and work it exactly as you normally would. Everything you see and
        change here is demo material — real homes, homeowners, guests and vendors are untouched, and
        nothing leaves Resolve.
      </p>

      {isLoading ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : portals.length === 0 ? (
        <EmptyState
          className="mt-10 border border-border bg-card"
          title="No portal is assigned to you yet"
          hint="Ask a Admin for access, then sign in again."
        />
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <Card key={portal.id} className="flex flex-col">
                <CardHeader>
                  <Icon className="size-6 text-primary" />
                  <CardTitle className="mt-2">{portal.name}</CardTitle>
                  <CardDescription>{portal.audience}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{portal.description}</p>
                  <Button className="w-full" onClick={() => open(portal.id, portal.route)}>
                    {portal.action}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
