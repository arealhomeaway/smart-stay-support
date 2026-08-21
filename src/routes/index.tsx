import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, LineChart, Repeat, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { PortalCard } from "@/components/PortalCard";
import { publicPortals } from "@/lib/portals";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Resolve — ARHA's Central Operating Hub";
const DESCRIPTION =
  "Resolve connects A Real Home Away's properties, people, partners, workflows, communications and performance data in one coordinated operating system.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

const pillars = [
  {
    icon: Building2,
    title: "The property is the spine",
    body: "Onboarding, matters, vendor visits, homeowner decisions and reviews all attach to the same home, so one operating history follows a property for life.",
  },
  {
    icon: Repeat,
    title: "Departments hand off, not drop off",
    body: "Work moves between onboarding, operations, vendors and homeowners through recorded handoffs — the original owner stays responsible until the receiving side accepts.",
  },
  {
    icon: ShieldCheck,
    title: "Standards are built in",
    body: "Response clocks, required evidence, safety rules and approval limits come from ARHA's own playbooks rather than living in someone's memory.",
  },
  {
    icon: LineChart,
    title: "One source for performance",
    body: "Because the work is recorded once, department health, vendor performance and homeowner experience are measured from the same records leadership reviews.",
  },
];

const chain = [
  { label: "Onboarding", note: "Contract through launch" },
  { label: "Operations", note: "Matters, guests, follow-up" },
  { label: "Vendors", note: "Scheduled work and evidence" },
  { label: "Homeowners", note: "Decisions, reports, updates" },
  { label: "Oversight", note: "Health and accountability" },
];

function Overview() {
  const portals = publicPortals();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-9" />
            <span className="h-8 w-px bg-sidebar-foreground/25" />
            <span className="font-display text-lg font-semibold">Resolve</span>
          </div>
          <Button
            asChild
            size="sm"
            className="min-h-11 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 md:min-h-9"
          >
            <Link to={signedIn ? "/hub" : "/auth"}>{signedIn ? "Go to my portals" : "Sign in"}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-16 md:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            A Real Home Away · Internal system
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            ARHA&rsquo;s Central Operating Hub
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
            Resolve connects ARHA&rsquo;s properties, people, partners, workflows, communications and
            performance data in one coordinated operating system. Select the portal that applies to
            your role to securely access your work.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="min-h-11">
              <a href="#portals">
                Choose your portal
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-h-11">
              <Link to={signedIn ? "/hub" : "/auth"}>
                {signedIn ? "Go to my portals" : "Sign in"}
              </Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="why" className="border-t border-border py-14">
          <h2 id="why" className="text-2xl font-semibold">
            Why ARHA built Resolve
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            ARHA&rsquo;s work used to live in separate places — chats, spreadsheets, vendor tools and
            individual inboxes. A decision made in one department was invisible to the next, and the
            property paid for it. Resolve holds the whole operation together: every department works
            in its own portal, while the company keeps one shared, auditable record.
          </p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {pillars.map((p) => (
              <li key={p.title} className="rounded-xl border border-border bg-card p-6">
                <p.icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="connects" className="border-t border-border py-14">
          <h2 id="connects" className="text-2xl font-semibold">
            How the portals connect
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Each portal is a different view of the same property record. Work travels left to right,
            and everything it touches is written back to the home&rsquo;s operating history.
          </p>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {chain.map((step, i) => (
              <li
                key={step.label}
                className="relative rounded-xl border border-border bg-card p-4 text-center"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Step {i + 1}
                </span>
                <p className="mt-1 font-semibold">{step.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{step.note}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
            <strong className="text-foreground">One operating history per property.</strong>{" "}
            Onboarding decisions, every matter and visit, vendor evidence, homeowner approvals and
            quarterly reviews accumulate on the same home — so anyone picking it up tomorrow can see
            what happened, who owns it, and what was promised.
          </p>
        </section>

        <section id="portals" aria-labelledby="portals-heading" className="border-t border-border py-14">
          <h2 id="portals-heading" className="text-2xl font-semibold">
            Enter your portal
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            One Resolve account covers every portal you are authorised for. Choose yours and
            you&rsquo;ll be taken there straight after signing in.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {portals.map((portal) => (
              <PortalCard key={portal.id} portal={portal} authenticated={false} />
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Leadership and finance workspaces appear automatically once an authorised person signs
            in. If a portal you expect is missing after sign-in, ask a Platform Owner to review your
            access.
          </p>
        </section>
      </main>

      <footer className="mt-6 border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center">
          <BrandLogo className="h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">
            Every home. Every guest. Every time.
          </p>
        </div>
      </footer>
    </div>
  );
}
