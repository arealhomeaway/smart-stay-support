/**
 * Property details, grouped the way staff ask questions.
 *
 * A find bar filters across every imported operating field. Credential values
 * are never in this data — a credential-shaped search simply points at the
 * secure Guest Access & Credentials panel.
 */
import { useMemo, useState } from "react";
import { KeyRound, Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page";
import {
  filterPropertyDetailGroups,
  matchesCredentialSearch,
  type PropertyDetailGroup,
} from "@/lib/property-details";

export function PropertyDetailSections({
  groups,
  onGoToCredentials,
}: {
  groups: PropertyDetailGroup[];
  onGoToCredentials?: () => void;
}) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length >= 2;
  const visible = useMemo(() => filterPropertyDetailGroups(groups, query), [groups, query]);
  const credentialHint = searching && matchesCredentialSearch(query);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No operating detail recorded yet"
        hint="Onboarding fills this in as the property is prepared."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find in this property — wifi, trash day, gate, water shutoff, air filter, HOA, warranty…"
          aria-label="Find in this property"
          className="pl-9"
        />
      </div>

      {credentialHint && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/8 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Codes and passwords live in Guest Access &amp; Credentials, not here.
          </span>
          {onGoToCredentials && (
            <Button size="sm" variant="outline" onClick={onGoToCredentials}>
              Go to credentials
            </Button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          Nothing recorded on this home matches “{query.trim()}”.
        </p>
      ) : (
        // Property details are daily-use reference, so every section opens by
        // default; staff collapse what they don't need rather than dig for
        // what they do.
        <Accordion
          type="multiple"
          {...(searching ? { value: visible.map((g) => g.id) } : {})}
          defaultValue={groups.map((g) => g.id)}
          className="divide-y divide-border/60"
        >
          {visible.map((g) => (
            <AccordionItem key={g.id} value={g.id} className="border-0">
              <AccordionTrigger className="py-3 text-left hover:no-underline">
                <span className="flex items-baseline gap-2">
                  <span className="text-[0.9375rem] font-semibold tracking-tight">{g.title}</span>
                  <span className="numeric text-xs text-muted-foreground">{g.fields.length}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {g.fields.map((f) => (
                    <div key={f.key} className="min-w-0">
                      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-line text-[0.9375rem] leading-snug">
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
