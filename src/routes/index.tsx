import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, LineChart, Repeat, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { PortalCard } from "@/components/PortalCard";
import { publicPortals } from "@/lib/portals";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-arha-property.jpg";

const TITLE = "Resolve — ARHA's Central Operating Hub";
const DESCRIPTION =
  "Keep Calm. Check Resolve. Tickets, properties, approvals and answers for the A Real Home Away team — finally in one place.";

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
    body: "Onboarding, tickets, vendor visits, homeowner decisions and reviews all attach to the same home, so one operating history follows a property for life.",
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
  { label: "Operations", note: "Tickets, guests, follow-up" },
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
            <BrandLogo className="h-10 sm:h-12" />
            <span className="h-8 w-px bg-sidebar-foreground/25" />
            <span className="font-display text-lg font-semibold">Resolve</span>
          </div>
          {signedIn ? (
            <div className="flex items-center gap-2">
              <Link
                to="/hub"
                className="inline-flex min-h-11 items-center rounded-md bg-sidebar-primary px-3 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90 sm:px-4"
              >
                Open Resolve
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSignedIn(false);
                }}
                className="inline-flex min-h-11 items-center rounded-md border border-sidebar-foreground/30 px-3 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-foreground/10 sm:px-4"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-sidebar-primary px-4 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-10 md:py-14">
          <div className="grid overflow-hidden rounded-3xl border border-border shadow-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="relative flex flex-col justify-center bg-sidebar p-8 text-sidebar-foreground md:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sidebar-primary">
                Resolve Overview
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] md:text-5xl">
                Keep Calm. Check Resolve.
              </h1>
              <p className="mt-4 text-lg text-sidebar-foreground/90 md:text-xl">
                Your new favorite place to find things.
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-sidebar-foreground/70 md:text-base">
                Because &ldquo;where is that?&rdquo; is not a workflow.
              </p>
            </div>
            <div className="relative min-h-64 lg:min-h-[30rem]">
              <img
                src={heroImage}
                alt="A living room in an A Real Home Away managed property, styled and ready for guests"
                width={1200}
                height={800}
                className="absolute inset-0 size-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/35 to-transparent lg:from-sidebar lg:via-sidebar/20"
              />
              <p className="absolute bottom-3 right-4 rounded-full bg-sidebar/70 px-3 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-sidebar-foreground/80">
                1039 Swinton Way &middot; Westfield, IN
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="why" className="border-t border-border py-14">
          <h2 id="why" className="text-2xl font-semibold">
            Why we built this thing
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Someone always knew where it was &mdash; in a chat, a spreadsheet, a vendor tool, or
            somebody&rsquo;s inbox. Great, unless that someone was off that day. Now it&rsquo;s
            Resolve: every team works in its own portal, and the whole company reads the same
            record.
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
            How work travels
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
            Onboarding decisions, every ticket and visit, vendor evidence, homeowner approvals and
            quarterly reviews accumulate on the same home — so anyone picking it up tomorrow can see
            what happened, who owns it, and what was promised.
          </p>
        </section>

        <section
          id="portals"
          aria-labelledby="portals-heading"
          className="border-t border-border py-14"
        >
          <h2 id="portals-heading" className="text-2xl font-semibold">
            Pick your lane.
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            One account, every portal you&rsquo;re cleared for. Choose yours and Resolve drops you
            straight in after sign-in.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {portals.map((portal) => (
              <PortalCard key={portal.id} portal={portal} authenticated={signedIn} wholeCardLink />
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Leadership and finance workspaces show up on their own for the people who hold that
            access. Portal missing after sign-in? Ask an Admin &mdash; not a group chat.
          </p>
        </section>
      </main>

      <footer className="mt-6 border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center">
          <BrandLogo className="h-14 sm:h-16" />
          <p className="text-base font-semibold">Fewer tabs. Fewer mysteries. Better Mondays.</p>
          <p className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">
            Every home. Every guest. Every time.
          </p>
        </div>
      </footer>
    </div>
  );
}
