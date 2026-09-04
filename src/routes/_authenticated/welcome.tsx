import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ClipboardList, ListChecks, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionBand } from "@/components/ui/page";
import walkthrough from "@/assets/resolve-executive-walkthrough.mp4.asset.json";

export const Route = createFileRoute("/_authenticated/welcome")({
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "How Resolve Works | ARHA Coordinator Training" },
      {
        name: "description",
        content:
          "Watch the Resolve walkthrough and learn how tickets, response clocks, playbooks and handoffs keep guest issues resolved properly.",
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
    title: "One ticket per issue",
    body: "Log it once. Resolve pulls live occupancy from OwnerRez and sets the priority floor, so nobody has to guess how urgent it is.",
    to: "/tickets/new" as const,
    cta: "Report an issue",
  },
  {
    icon: ListChecks,
    title: "Playbooks do the coaching",
    body: "Each work type carries required steps — test every smoke and CO device, replace anything removed, photograph the wall — and the ticket cannot close until they are done.",
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
    body: "Import properties from OwnerRez, keep access notes and safety history in one place, and dispatch field work to vendors from the vendor portal.",
    to: "/properties" as const,
    cta: "View properties",
  },
];

function WelcomePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Start here"
        title="How Resolve works"
        description="Watch the walkthrough, then take the guided tour inside the app. Do both before your first shift."
      />

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
          <div key={b.title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
              <b.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold">{b.title}</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">{b.body}</p>
              <Button asChild variant="ghost" size="sm" className="-ml-3 mt-1 px-3 hover:bg-transparent hover:underline">
                <Link to={b.to}>{b.cta} →</Link>
              </Button>
            </div>
          </div>
        ))}
      </section>

      <SectionBand title="The rule behind all of it" />
      <p className="-mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        If a step has to be remembered, it will eventually be missed. So Resolve writes it into the playbook, on the
        clock, in front of the person who owns the ticket.
      </p>
    </div>
  );
}
