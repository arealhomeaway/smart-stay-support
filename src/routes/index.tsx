import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, ListChecks, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Resolve — A Real Home Away Operations App" },
      {
        name: "description",
        content:
          "Internal ticketing for A Real Home Away: guided playbooks, property history, and guest-confirmed resolutions for every maintenance issue.",
      },
      { property: "og:title", content: "Resolve — A Real Home Away Operations App" },
      {
        property: "og:description",
        content: "Guided playbooks and tickets so every guest issue gets solved completely the first time.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ClipboardCheck,
    title: "Every issue becomes a ticket",
    body: "Logged against the exact property, with guest details, priority, and a response clock.",
  },
  {
    icon: ListChecks,
    title: "Playbooks do the thinking",
    body: "Pick a category and the ticket loads the required steps — including the ones people forget.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing closes half-done",
    body: "Required steps and written guest confirmation are enforced before a ticket can be resolved.",
  },
  {
    icon: Timer,
    title: "History that answers questions",
    body: "See every past issue at a unit so recurring problems get fixed at the root.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-semibold text-primary-foreground">
              R
            </span>
            <span className="font-display text-lg font-semibold">Resolve</span>
          </div>
          <Button asChild size="sm">
            <Link to="/auth">Team sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 md:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            A Real Home Away · Internal
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Solve guest issues completely, the first time.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Resolve turns every guest message and maintenance request into a tracked ticket with a
            step-by-step playbook, so the handyman never leaves a leak half-fixed or a detector
            hanging off the wall.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Open the app</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Create a team account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 pb-20 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        A Real Home Away — internal operations tool
      </footer>
    </div>
  );
}
