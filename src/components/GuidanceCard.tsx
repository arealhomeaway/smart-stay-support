/**
 * Contextual guidance, rendered directly below Next Action.
 *
 * Three layers, in a fixed order of authority:
 *   A. workflow and policy truth — passed in by the caller, always shown first
 *   B. approved authored Playbook judgment — added underneath, never over it
 *   C. Coach — not here; it may explain A and B conversationally later
 *
 * Sections with nothing to say do not render at all.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { matchPlaybook, NO_APPROVED_GUIDANCE, type MatchContext } from "@/lib/playbook-match";
import { isTestPlaybook, parsePlaybook, type PlaybookRow } from "@/lib/playbooks";
import { recordGuidanceEvent } from "@/lib/guidance.functions";
import { useRole } from "@/hooks/useRole";

export type GuidanceCardProps = {
  subjectType: "ticket" | "work_order" | "recovery" | "claim";
  subjectId: string;
  /** Deterministic facts used to resolve a Playbook. */
  context: MatchContext;
  /** Computed from workflow and policy state. Always rendered first. */
  why: string[];
  /** Deterministic escalation triggers. Authored ones only supplement these. */
  escalations?: string[];
  /** From the existing evidence architecture. */
  requiredEvidence?: string[];
  /** Live property instruction — read, never copied. */
  specialHandling?: string[];
  /** Show the vendor brief only when a vendor is actually engaged. */
  vendorEngaged?: boolean;
};

function useActivePlaybooks() {
  return useQuery({
    queryKey: ["playbooks-contextual"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("*")
        // `active` is the legacy stored value for an approved Playbook.
        .in("status", ["approved", "active"]);

      if (error) throw error;
      // Scratch entries somebody made while learning the editor never guide work.
      return (data as PlaybookRow[]).map(parsePlaybook).filter((pb) => !isTestPlaybook(pb));
    },
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function GuidanceCard({
  subjectType,
  subjectId,
  context,
  why,
  escalations = [],
  requiredEvidence = [],
  specialHandling = [],
  vendorEngaged = false,
}: GuidanceCardProps) {
  const playbooks = useActivePlaybooks();
  const canEdit = useRole().can("playbooks_edit");
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(
    () => matchPlaybook(playbooks.data ?? [], context),
    [playbooks.data, context],
  );

  const primary = result.primary?.playbook ?? null;
  const authored = result.hasApprovedGuidance ? primary : null;
  const drift = result.primary?.driftWarnings ?? [];

  useEffect(() => {
    if (playbooks.isLoading) return;
    void recordGuidanceEvent({
      data: {
        event: primary ? "shown" : "no_guidance",
        subjectType,
        subjectId,
        playbookKey: primary?.playbook_key ?? null,
        playbookVersion: primary?.version ?? null,
      },
    }).catch(() => {
      // Telemetry must never interrupt the work in front of somebody.
    });
  }, [playbooks.isLoading, primary, subjectId, subjectType]);

  if (playbooks.isLoading) return null;

  // Judgment guidance, not a threshold: anything authored that restates one has
  // drifted from the policy engine and is withheld until it is reviewed.
  const suppressed = drift.length > 0;
  const riskFlags = suppressed ? [] : (authored?.risk_flags ?? []);
  const actions = suppressed ? [] : (authored?.immediate_actions ?? []);
  const authoredEscalations = suppressed ? [] : (authored?.escalate_if ?? []);
  const vendorBrief = vendorEngaged && !suppressed ? (authored?.vendor_brief ?? null) : null;

  const allEscalations = [...escalations, ...authoredEscalations];
  const hasDetail =
    riskFlags.length > 0 ||
    actions.length > 0 ||
    allEscalations.length > 0 ||
    requiredEvidence.length > 0 ||
    specialHandling.length > 0 ||
    Boolean(vendorBrief);

  return (
    <Card className="border-border/70 bg-secondary/20">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Compass className="size-4 text-muted-foreground" /> Guidance
          </CardTitle>
          {primary ? (
            <p className="text-sm text-muted-foreground">
              {primary.title}
              {!authored && " · steps only"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{NO_APPROVED_GUIDANCE}</p>
          )}
        </div>
        {hasDetail && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {expanded ? "Less" : "More"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {why.length > 0 && (
          <Section title="Why this needs attention">
            <Bullets items={why} />
          </Section>
        )}

        {suppressed && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              This Playbook states a threshold the policy engine owns. It is flagged for supervisor
              review and its guidance is withheld until then.
            </span>
          </div>
        )}

        {expanded && (
          <>
            {riskFlags.length > 0 && (
              <Section title="Things to consider">
                <ul className="space-y-1 text-sm">
                  {riskFlags.map((flag) => (
                    <li key={flag.title}>
                      <span className="font-medium">{flag.title}</span>
                      {flag.why ? (
                        <span className="text-muted-foreground"> — {flag.why}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {actions.length > 0 && (
              <Section title="Suggested operational steps">
                <Bullets items={actions} />
              </Section>
            )}

            {allEscalations.length > 0 && (
              <Section title="Escalation">
                <Bullets items={allEscalations} />
              </Section>
            )}

            {requiredEvidence.length > 0 && (
              <Section title="Required evidence">
                <div className="flex flex-wrap gap-1">
                  {requiredEvidence.map((item) => (
                    <Badge key={item} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {specialHandling.length > 0 && (
              <Section title="This home">
                <Bullets items={specialHandling} />
              </Section>
            )}

            {vendorBrief && (
              <Section title="Vendor context">
                <div className="space-y-1 text-sm">
                  {vendorBrief.scope && <p>{vendorBrief.scope}</p>}
                  {vendorBrief.must_check.length > 0 && <Bullets items={vendorBrief.must_check} />}
                  {vendorBrief.must_not_do.length > 0 && (
                    <p className="text-muted-foreground">
                      Do not: {vendorBrief.must_not_do.join("; ")}
                    </p>
                  )}
                </div>
              </Section>
            )}
          </>
        )}

        {/* Administration is not frontline work — only editors get the link. */}
        {primary && canEdit && (
          <Link
            to="/playbooks"
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() =>
              void recordGuidanceEvent({
                data: {
                  event: "opened",
                  subjectType,
                  subjectId,
                  playbookKey: primary.playbook_key,
                  playbookVersion: primary.version,
                },
              }).catch(() => {})
            }
          >
            View full Playbook
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
