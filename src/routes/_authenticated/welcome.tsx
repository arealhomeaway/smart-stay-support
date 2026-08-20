import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ClipboardList, ListChecks, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import walkthrough from "@/assets/resolve-executive-walkthrough.mp4.asset.json";

export const Route = createFileRoute("/_authenticated/welcome")({
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "How Resolve Works | ARHA Coordinator Training" },
      {
        name: "description",
        content:
          "Watch the Resolve walkthrough and learn how matters, response clocks, playbooks and handoffs keep guest issues resolved properly.",
      },
      { property: "og:title", content: "How Resolve Works | ARHA Coordinator Training" },
      {
        property: "og:description",
        content: "A 65-second executive walkthrough of intake, inbound sync, triage, playbook enforcement, handoffs and oversight in Resolve.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const basics = [
  {
    icon: ClipboardList,
    title: "One matter per issue",
    body: "Log it once. Resolve pulls live occupancy from OwnerRez and sets the priority floor, so nobody has to guess how urgent it is.",
    to: "/tickets/new" as const,
    cta: "Log a matter",
  },
  {
    icon: ListChecks,
    title: "Playbooks do the coaching",
    body: "Each work type carries required steps — test every smoke and CO device, replace anything removed, photograph the wall — and the matter cannot close until they are done.",
    to: "/playbooks" as const,
    cta: "See playbooks",
  },
  {
    icon: Users,
    title: "Work routes to seats",
    body: "The property determines the pod; priority and time determine who gets it. Coverage keeps routing working at lunch and after hours.",
    to: "/team" as const,
    cta: "Seats & coverage",
  },
  {
    icon: ShieldAlert,
    title: "Handoffs are accepted",
    body: "A handoff is not complete until the receiver accepts it. Until then the original owner is still accountable, and Oversight shows what is stalling.",
    to: "/oversight" as const,
    cta: "Open oversight",
  },
  {
    icon: Building2,
    title: "Homes stay in sync",
    body: "Import properties from OwnerRez, keep access notes and safety history in one place, and dispatch field work when Breezeway is connected.",
    to: "/properties" as const,
    cta: "View properties",
  },
];

function WelcomePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start here</p>
        <h1 className="font-display text-3xl font-semibold">How Resolve works</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Watch the walkthrough, then take the guided tour inside the app. Anyone new to the coordinator seat should do
          both before their first shift.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <video
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full bg-foreground"
          src={walkthrough.url}
        >
          Your browser does not support embedded video.
        </video>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div>
            <p className="font-medium">Resolve executive walkthrough — 1:05</p>
            <p className="text-sm text-muted-foreground">
              Intake, inbound sync, triage, playbook enforcement, handoff acceptance and oversight.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={walkthrough.url} download>
              Download
            </a>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {basics.map((b) => (
          <Card key={b.title}>
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                <b.icon className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">{b.title}</CardTitle>
                <CardDescription className="mt-1 leading-relaxed">{b.body}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild variant="ghost" size="sm" className="px-0 hover:bg-transparent hover:underline">
                <Link to={b.to}>{b.cta} →</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-secondary/40 p-6">
        <h2 className="font-display text-xl font-semibold">The rule behind all of it</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Common sense has to be written down to be reliable. If a coordinator or a vendor has to remember a step, the
          step will eventually be missed — so Resolve puts it in the playbook, on the clock, and in front of the person
          who owns the matter.
        </p>
      </section>
    </div>
  );
}
