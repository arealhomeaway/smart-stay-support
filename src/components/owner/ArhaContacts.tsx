import { Mail, Phone } from "lucide-react";
import type { ArhaContact, ContactsView } from "@/lib/arha-contacts";

function ContactRow({ contact }: { contact: ArhaContact }) {
  return (
    <li className="rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">{contact.name}</p>
      <p className="text-xs text-muted-foreground">{contact.role}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{contact.use}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
        >
          <Mail className="size-3.5" /> {contact.email}
        </a>
        {contact.phone && (
          <a
            href={`tel:${contact.phone.replace(/[^\d]/g, "")}`}
            className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
          >
            <Phone className="size-3.5" /> {contact.phone}
          </a>
        )}
      </div>
    </li>
  );
}

/** Who to talk to, in the order the homeowner should try them. */
export function ArhaContacts({ contacts, supports = null }: { contacts: ContactsView; supports?: string | null }) {
  return (
    <section
      aria-labelledby="owner-contacts-heading"
      className="rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <h2 id="owner-contacts-heading" className="font-display text-lg font-semibold">
        My Team
      </h2>
      {supports ? <p className="mt-1 text-sm text-muted-foreground">Supporting {supports}</p> : null}

      {contacts.primary && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your primary contact
          </p>
          <ul className="mt-2 grid gap-2">
            <ContactRow contact={contacts.primary} />
          </ul>
        </div>
      )}

      {contacts.dayToDay.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Day to day
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {contacts.dayToDay.map((s) => (
              <li key={s.seat} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold">{s.name ?? s.seat}</p>
                <p className="text-xs text-muted-foreground">
                  {s.name ? s.seat : "Assigned shortly — use an escalation contact meanwhile"}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Escalation
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {contacts.escalation.map((c) => (
            <ContactRow key={c.email} contact={c} />
          ))}
        </ul>
      </div>
    </section>
  );
}
