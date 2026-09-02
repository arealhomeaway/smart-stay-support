import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3, Plus, Search, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { ROLE_LABELS } from "@/lib/permissions";
import { PORTAL_REGISTRY, portalsFor, recentPortalId } from "@/lib/portals";
import { OPEN_STATUSES } from "@/lib/tickets";
import { OPEN_STAGES as CLAIM_OPEN_STAGES } from "@/lib/claims";
import { OPEN_STAGES as RECOVERY_OPEN_STAGES } from "@/lib/guest-recovery";
import { OPEN_STAGES as LEAD_OPEN_STAGES } from "@/lib/leads";
import {
  attentionItems,
  workflowCue,
  workflowsFor,
  type HomeSignals,
} from "@/lib/home-workflows";
import heroArt from "@/assets/hub-hero.png";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({
    meta: [
      { title: "Home — Resolve by ARHA" },
      {
        name: "description",
        content:
          "The front door to Resolve: what needs attention now, where you left off, and every ARHA workflow you are authorised for.",
      },
      { property: "og:title", content: "Home — Resolve by ARHA" },
      {
        property: "og:description",
        content: "Keep calm. Check Resolve. Your new favorite place to find things.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Hub,
});

function Hub() {
  const { roles, primary, can, isLoading, userId } = useRole();
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
  const workflows = workflowsFor(roles, can);
  const recentPortal = recent ? PORTAL_REGISTRY.find((p) => p.id === recent) : undefined;

  /**
   * Every number below is read live. Where a query is not permitted or fails,
   * the value stays undefined and the UI simply says nothing.
   */
  const { data: signals } = useQuery<HomeSignals>({
    queryKey: ["hub-signals", demoMode, userId],
    staleTime: 60_000,
    queryFn: async () => {
      const out: HomeSignals = {};
      const today = new Date().toISOString().slice(0, 10);

      const tickets = await supabase
        .from("tickets")
        .select("priority, assigned_to")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .in("status", OPEN_STATUSES);
      if (!tickets.error && tickets.data) {
        out.ticketsOpen = tickets.data.length;
        out.ticketsP1 = tickets.data.filter((t) => t.priority === "p1").length;
        if (userId) {
          out.ticketsMine = tickets.data.filter((t) => t.assigned_to === userId).length;
        }
      }

      const wo = await supabase
        .from("work_orders")
        .select("approval_status")
        .eq("is_demo", demoMode)
        .is("closed_at", null);
      if (!wo.error && wo.data) {
        out.workOrdersOpen = wo.data.length;
        out.workOrdersAwaitingOwner = wo.data.filter((w) => w.approval_status === "pending").length;
      }

      const claims = await supabase
        .from("claims")
        .select("deadline_on")
        .eq("is_demo", demoMode)
        .in("stage", CLAIM_OPEN_STAGES);
      if (!claims.error && claims.data) {
        out.claimsOpen = claims.data.length;
        out.claimsOverdue = claims.data.filter(
          (c) => c.deadline_on && c.deadline_on < today,
        ).length;
      }

      const recovery = await supabase
        .from("guest_recovery")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", demoMode)
        .in("stage", RECOVERY_OPEN_STAGES);
      if (!recovery.error) out.recoveryOpen = recovery.count ?? 0;

      const leads = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", demoMode)
        .in("stage", LEAD_OPEN_STAGES);
      if (!leads.error) out.leadsOpen = leads.count ?? 0;

      const props = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", demoMode);
      if (!props.error) out.properties = props.count ?? 0;

      return out;
    },
  });

  /** Pick up where you left off: your own open tickets, most recently touched. */
  const { data: mine } = useQuery({
    queryKey: ["hub-mine", demoMode, userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, title, priority, status, updated_at")
        .eq("is_demo", demoMode)
        .is("archived_at", null)
        .eq("assigned_to", userId!)
        .in("status", OPEN_STATUSES)
        .order("updated_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attention = attentionItems(signals ?? {});

  return (
    <div className="space-y-10 pb-4">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the front door                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-2xl border border-brand-ink/20 bg-brand-ink text-background shadow-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_10%,color-mix(in_oklab,var(--brand-teal)_55%,transparent),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-teal via-brand-gold to-module-override"
        />
        <div className="relative grid gap-8 p-8 md:grid-cols-[1.35fr_1fr] md:items-center md:p-12">
          <div>
            <p className="eyebrow text-brand-gold">A Real Home Away · Resolve</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              Keep calm. Check Resolve.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-background/75">
              Your new favorite place to find things — the property, the code, the ticket, the
              answer, and whoever owns it next.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {can("ticket_create") && (
                <Button asChild size="lg" variant="secondary" className="resolve-press">
                  <Link to="/tickets/new">
                    <Plus aria-hidden="true" />
                    Log a ticket
                  </Link>
                </Button>
              )}
              {can("properties") && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="resolve-press border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
                >
                  <Link to="/properties">
                    <Search aria-hidden="true" />
                    Find a property
                  </Link>
                </Button>
              )}
              {workflows[0] && (
                <Link
                  to={workflows[0].route}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-background/80 underline-offset-4 hover:text-background hover:underline"
                >
                  Go to {workflows[0].label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2 text-sm text-background/60">
              <Badge className="border-background/25 bg-background/10 text-background">
                {ROLE_LABELS[primary]}
              </Badge>
              <span>Signed in{name ? ` as ${name.split(" ")[0]}` : ""}</span>
            </div>
          </div>

          <div className="relative hidden justify-self-end md:block">
            <img
              src={heroArt}
              alt=""
              width={1024}
              height={1024}
              className="w-full max-w-[320px] drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Needs attention now + pick up where you left off                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">Needs attention now</h2>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Live</span>
          </div>

          {attention.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-border bg-sunken p-5 text-sm text-muted-foreground">
              Nothing is flagged for you right now. That is a good sign — pick a workflow below when
              you are ready.
            </p>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.route}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-9 w-1.5 shrink-0 rounded-full ${
                        item.tone === "urgent"
                          ? "bg-danger"
                          : item.tone === "warning"
                            ? "bg-warning"
                            : "bg-state-active"
                      }`}
                    />
                    <span className="numeric text-2xl font-semibold tabular-nums">{item.count}</span>
                    <span className="flex-1 text-sm text-muted-foreground">{item.label}</span>
                    <ArrowRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Pick up where you left off</h2>

          {recentPortal && (
            <Link
              to={recentPortal.route}
              className="mt-5 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm font-medium transition-colors hover:bg-primary/10"
            >
              <Clock3 className="size-4 text-primary" aria-hidden="true" />
              Back to {recentPortal.name}
              <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          )}

          {mine && mine.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {mine.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/tickets/$ticketId"
                    params={{ ticketId: t.id }}
                    className="block rounded-xl border border-border bg-background p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <p className="line-clamp-1 text-sm font-medium">{t.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(t.priority ?? "").toUpperCase()} · assigned to you
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing is assigned to you at the moment. Anything you claim will show up here.
            </p>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Main workflows                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Main workflows</h2>
          <p className="text-sm text-muted-foreground">Everything your access allows</p>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : workflows.length === 0 && portals.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-border bg-card p-8">
            <ShieldAlert className="size-6 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold">No workspace is assigned to you yet</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Your account is active, but nobody has granted it access to a workspace. Ask a
              Platform Owner or your supervisor to assign your access, then sign in again.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {workflows.map((w) => {
              const cue = workflowCue(w.key, signals ?? {});
              return (
                <Link
                  key={w.key}
                  to={w.route}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${w.accent.bar}`} />
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${w.accent.tint} ${w.accent.text}`}
                  >
                    {w.label}
                  </span>
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">{w.description}</p>
                  {cue && (
                    <p className="mt-3 text-xs font-medium tabular-nums text-foreground/80">{cue}</p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {w.cta}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Portals — the other doors this account can open. */}
      {portals.length > 1 && (
        <section className="rounded-2xl border border-border bg-sunken p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Portals
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {portals.map((p) => (
              <Button key={p.id} asChild variant="outline" size="sm">
                <Link to={p.route}>{p.name}</Link>
              </Button>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            One account covers every portal you are authorised for. You can always read the{" "}
            <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
              Resolve overview
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
