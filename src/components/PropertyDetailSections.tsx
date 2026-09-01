/**
 * Property details, grouped the way staff ask questions.
 *
 * A find bar filters across every imported operating field. Credential values
 * are never in this data — a credential-shaped search simply points at the
 * secure Guest Access & Credentials panel.
 */
import { useMemo, useState } from "react";
import { KeyRound, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">No operating detail recorded yet</CardTitle>
          <CardDescription>
            Nothing has been imported or entered for this home. Onboarding fills this in as the property is prepared.
          </CardDescription>
        </CardHeader>
      </Card>
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
        <Card className="border-primary/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              Codes and passwords live in Guest Access &amp; Credentials, not in property details.
            </span>
            {onGoToCredentials && (
              <Button size="sm" variant="outline" onClick={onGoToCredentials}>
                Go to credentials
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          Nothing recorded on this home matches “{query.trim()}”.
        </p>
      ) : (
        <Accordion
          type="multiple"
          // While searching, every surviving section opens so the answer is on screen.
          {...(searching ? { value: visible.map((g) => g.id) } : {})}
          defaultValue={groups.slice(0, 3).map((g) => g.id)}
          className="rounded-xl border border-border bg-card px-4"
        >
          {visible.map((g) => (
            <AccordionItem key={g.id} value={g.id}>
              <AccordionTrigger className="text-left">
                <span className="flex items-center gap-2">
                  {g.title}
                  <Badge variant="outline">{g.fields.length}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {g.fields.map((f) => (
                    <div key={f.key} className="border-b border-border/50 pb-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                      <dd className="whitespace-pre-line text-sm">{f.value}</dd>
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
