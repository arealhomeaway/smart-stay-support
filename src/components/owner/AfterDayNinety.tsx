import { CalendarCheck } from "lucide-react";
import type { ArhaContact } from "@/lib/arha-contacts";

/**
 * What happens as the program closes on December 31.
 *
 * States what changes and what continues under the management agreement. It
 * deliberately makes no claim about any tax outcome.
 */
export function AfterDayNinety({
  daysLeft,
  completed,
  primaryContact,
}: {
  daysLeft: number;
  completed: boolean;
  primaryContact: ArhaContact | null;
}) {
  return (
    <section
      aria-labelledby="owner-closeout-heading"
      className="rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <CalendarCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="owner-closeout-heading" className="font-display text-lg font-semibold">
            {completed ? "Your year-end review is complete" : "As your year-end review approaches"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {completed
              ? "The structured participation period has closed. Your home stays under your management agreement and nothing about its day-to-day care changes."
              : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} remain in the structured participation period. Here is what changes when it closes.`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">What changes</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
            <li>The structured participation prompts and check-ins stop.</li>
            <li>Your participation record is finalised and available to download.</li>
            <li>Your primary ARHA contact moves to owner relations.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">What continues</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
            <li>Everyday management of your home under your management agreement.</li>
            <li>Approvals and updates whenever a decision needs you.</li>
            <li>Your documents, reports and history stay here.</li>
          </ul>
        </div>
      </div>

      {primaryContact && (
        <p className="mt-3 text-xs text-muted-foreground">
          Invoicing, billing and ongoing owner questions go to{" "}
          <span className="font-medium text-foreground">{primaryContact.name}</span>,{" "}
          {primaryContact.role} —{" "}
          <a
            href={`mailto:${primaryContact.email}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {primaryContact.email}
          </a>
          .
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        ARHA does not provide tax or legal advice. Talk to your own adviser about how your
        participation applies to your situation.
      </p>
    </section>
  );
}
