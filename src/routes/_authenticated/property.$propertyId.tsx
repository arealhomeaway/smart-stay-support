/**
 * Property Hub — the single place a person looks up one home.
 *
 * Staff see the operational picture; a homeowner sees only their own home and
 * only what Resolve has shared with them. The server decides both — this file
 * renders what it is given and never widens it.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  ListChecks,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPropertyHubFn } from "@/lib/property-hub.functions";
import { BreezewayWorkOrderPanel } from "@/components/BreezewayWorkOrderPanel";
import { PropertyCredentialsPanel } from "@/components/PropertyCredentialsPanel";
import { SpecialHandlingPanel } from "@/components/SpecialHandlingPanel";
import { SectionBand } from "@/components/ui/page";
import { PropertyDetailSections } from "@/components/PropertyDetailSections";
import { PropertyDocumentLibrary } from "@/components/PropertyDocumentLibrary";
import { OwnerLinkPanel } from "@/components/OwnerLinkPanel";
import { BackControl, useRecordOrigin } from "@/components/nav/NavContext";

export const Route = createFileRoute("/_authenticated/property/$propertyId")({
  head: () => ({
    meta: [
      { title: "Property Hub — Resolve" },
      {
        name: "description",
        content: "One home in Resolve: onboarding progress, operations, contacts, documents and approvals.",
      },
      { property: "og:title", content: "Property Hub — Resolve" },
      { property: "og:description", content: "Onboarding, operations, documents and approvals for one home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): { from?: string | undefined } =>
    typeof raw["from"] === "string" && raw["from"] ? { from: raw["from"] } : {},
  component: PropertyHubPage,
});

type Hub = Awaited<ReturnType<typeof getPropertyHubFn>>;

function PropertyHubPage() {
  const { propertyId } = Route.useParams();
  const { origin } = useRecordOrigin("property");
  const load = useServerFn(getPropertyHubFn);
  const q = useQuery({
    queryKey: ["property-hub", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">This home could not be opened</CardTitle>
          <CardDescription>
            {q.error instanceof Error ? q.error.message : "Resolve could not load this property right now."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/properties" className="text-sm text-primary underline">
            Back to properties
          </Link>
        </CardContent>
      </Card>
    );
  }

  const hub = q.data;

  return (
    <div className="space-y-6">
      <HubHeader hub={hub} />

      {hub.alerts.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {hub.alerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                a.tone === "danger"
                  ? "border-danger/40 bg-danger/5"
                  : a.tone === "warn"
                    ? "border-warning/40 bg-warning/5"
                    : "border-border bg-muted/30"
              }`}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {hub.viewer.staff && (
        <div id="special-handling">
          <SpecialHandlingPanel propertyId={propertyId} canEdit={hub.viewer.supervisor} />
        </div>
      )}

      {hub.viewer.staff && (
        <div id="credentials">
          <PropertyCredentialsPanel propertyId={propertyId} />
        </div>
      )}






      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Property details</TabsTrigger>
          {hub.viewer.staff && <TabsTrigger value="contacts">Contacts</TabsTrigger>}
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          {hub.viewer.staff && <TabsTrigger value="operations">Operations</TabsTrigger>}
          <TabsTrigger value="documents">Documents &amp; media</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab hub={hub} />
        </TabsContent>
        <TabsContent value="details" className="mt-4">
          <DetailsTab hub={hub} />
        </TabsContent>
        {hub.viewer.staff && (
          <TabsContent value="contacts" className="mt-4">
            <ContactsTab hub={hub} propertyId={propertyId} />
          </TabsContent>
        )}
        <TabsContent value="onboarding" className="mt-4">
          <OnboardingTab hub={hub} />
        </TabsContent>
        {hub.viewer.staff && (
          <TabsContent value="operations" className="mt-4">
            <OperationsTab hub={hub} />
          </TabsContent>
        )}
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab hub={hub} />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <ApprovalsTab hub={hub} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab hub={hub} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function HubHeader({ hub }: { hub: Hub }) {
  const p = hub.property;
  const facts = [
    p.bedrooms == null ? null : `${p.bedrooms} bd`,
    p.bathrooms == null ? null : `${p.bathrooms} ba`,
    p.maxGuests == null ? null : `sleeps ${p.maxGuests}`,
  ].filter(Boolean) as string[];
  return (
    <div className="surface overflow-hidden shadow-raised">
      <div className="grid gap-0 md:grid-cols-[320px_1fr]">
        <div className="relative aspect-[4/3] bg-muted md:aspect-auto md:min-h-[220px]">
          {p.photoUrl ? (
            <img
              src={p.photoUrl}
              alt={`${p.nickname || p.name} — primary listing photo`}
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Building2 className="size-8" />
              <span className="text-xs">No listing photo on file</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden="true" />
              Property hub
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{p.nickname || p.name}</h1>
              {p.isDemo && <Badge variant="outline">Demo</Badge>}
            </div>
            <p className="mt-1 text-muted-foreground">{p.address || "No address on file"}</p>
            {facts.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p>
            )}
            {hub.viewer.staff && hub.ownerRecord && (
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">Owner: </span>
                <span className="font-medium">{hub.ownerRecord.name ?? "Unnamed owner record"}</span>
                {hub.ownerRecord.propertyCount > 1 && (
                  <span className="text-muted-foreground"> · {hub.ownerRecord.propertyCount} homes</span>
                )}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {p.market && <Badge variant="secondary">{p.market}</Badge>}
              {p.neighborhood && <Badge variant="outline">{p.neighborhood}</Badge>}
              {p.lifecycleStatus && <Badge variant="outline">{label(p.lifecycleStatus)}</Badge>}
              {p.minStayMonths ? <Badge variant="outline">{p.minStayMonths}-month minimum</Badge> : null}
              {p.onboardingStage && <Badge variant="outline">Stage: {label(p.onboardingStage)}</Badge>}
              <Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "Active" : "Inactive"}</Badge>
            </div>
            {hub.viewer.staff && p.operatingNotes && (
              <div className="mt-4 max-w-2xl rounded-lg border border-warning/40 bg-warning/5 p-3">
                <div className="eyebrow">Special handling</div>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{p.operatingNotes}</p>
              </div>
            )}
          </div>
          {hub.viewer.staff && <BackControl origin={origin} className="shrink-0" />}
        </div>
      </div>
    </div>

  );
}

function Stat({ label: l, value, tone }: { label: string; value: string | number; tone?: "danger" | "ok" | undefined }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{l}</div>
      <div
        className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-danger" : tone === "ok" ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function OverviewTab({ hub }: { hub: Hub }) {
  const o = hub.overview;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {hub.viewer.staff && <Stat label="Open tickets" value={o.openTickets} tone={o.openTickets ? "danger" : undefined} />}
        {hub.viewer.staff && <Stat label="P1 open" value={o.p1Tickets} tone={o.p1Tickets ? "danger" : undefined} />}
        <Stat label="Onboarding complete" value={`${o.onboardingComplete}/${o.onboardingTotal}`} />
        <Stat label="Waiting on you" value={o.ownerActions} tone={o.ownerActions ? "danger" : "ok"} />
        {hub.viewer.staff && <Stat label="Blockers" value={o.blockers} tone={o.blockers ? "danger" : undefined} />}
        {hub.viewer.staff && <Stat label="Handoff gates open" value={o.handoffGatesOpen} />}
        <Stat label="Documents you can see" value={o.documents} />
        {hub.viewer.staff && o.unassignedTasks != null && (
          <Stat label="Unassigned tasks" value={o.unassignedTasks} tone={o.unassignedTasks ? "danger" : "ok"} />
        )}
      </div>

      {o.program && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">90-Day Owner Participation</CardTitle>
            <CardDescription>
              {o.program.ownerName ?? "Homeowner"} · {label(o.program.status)}
              {o.program.startedOn ? ` · ${o.program.startedOn} to ${o.program.endsOn ?? "—"}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/owner" className="text-sm text-primary underline">
              Open participation
            </Link>
          </CardContent>
        </Card>
      )}

      {!hub.viewer.staff && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What happens next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              Your home is {o.onboardingTotal ? `${Math.round((o.onboardingComplete / Math.max(o.onboardingTotal, 1)) * 100)}% through onboarding` : "being prepared"}.
            </p>
            <p>
              {o.ownerActions
                ? `${o.ownerActions} item${o.ownerActions === 1 ? "" : "s"} need your approval — see the Approvals tab.`
                : "Nothing is waiting on you right now. ARHA will let you know when something is."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailsTab({ hub }: { hub: Hub }) {
  const groups = hub.details.groups ?? [];
  const legacy = hub.details.sections;
  if (groups.length === 0 && legacy.length === 0) {
    return <Empty text="No property details have been shared for this home yet." />;
  }
  return (
    <div className="space-y-6">
      {groups.length > 0 && (
        <PropertyDetailSections
          groups={groups}
          onGoToCredentials={() => document.getElementById("credentials")?.scrollIntoView({ behavior: "smooth" })}
        />
      )}

      {legacy.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {legacy.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.title}</CardTitle>
                {s.blurb && <CardDescription>{s.blurb}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {s.fields.length === 0 && <p className="text-muted-foreground">Nothing recorded yet.</p>}
                {s.fields.map((fld) => (
                  <div
                    key={fld.key}
                    className="flex items-start justify-between gap-4 border-b border-border/50 pb-2 last:border-0"
                  >
                    <div>
                      <div className="font-medium">{fld.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {fld.source}
                        {fld.asOf ? ` · as of ${fld.asOf.slice(0, 10)}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      {fld.pending ? (
                        <Badge variant="outline">Awaiting field map</Badge>
                      ) : (
                        <span className={fld.value ? "" : "text-muted-foreground"}>{fld.value ?? "Not recorded"}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactsTab({ hub, propertyId }: { hub: Hub; propertyId: string }) {
  const owner = hub.ownerRecord;
  const canLink = hub.viewer.staff;
  if (!owner && hub.contacts.length === 0) {
    return (
      <div className="space-y-4">
        <Empty text="No structured contact records for this home yet. Contacts come from the owner record, not free text." />
        {canLink && <OwnerLinkPanel propertyId={propertyId} hasOwner={false} />}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {canLink && (
        <div className="flex justify-end">
          <OwnerLinkPanel propertyId={propertyId} hasOwner={Boolean(owner)} />
        </div>
      )}
      {owner && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              {owner.name ?? "Unnamed owner record"}
              <Badge variant="secondary">Owner of record</Badge>
            </CardTitle>
            <CardDescription>
              {owner.source === "ownerrez" ? "OwnerRez owner record" : owner.source}
              {owner.propertyCount > 1 ? ` · owns ${owner.propertyCount} homes with ARHA` : " · single home"}
              {` · as of ${owner.syncedAt.slice(0, 10)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
            <p>{owner.email ?? "No email on file"}</p>
            <p>{owner.phone ?? "No phone on file"}</p>
            <p className="text-muted-foreground">
              {[owner.city, owner.state].filter(Boolean).join(", ") || "No mailing city on file"}
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
      {hub.contacts.map((c) => (
        <Card key={c.id}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              {c.name ?? "Homeowner"}
            </CardTitle>
            <CardDescription>
              {c.source ?? "Resolve"}
              {c.matchStatus ? ` · ${label(c.matchStatus)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{c.email ?? "No email on file"}</p>
            <p>{c.phone ?? "No phone on file"}</p>
            {c.syncedAt && <p className="text-xs text-muted-foreground">as of {c.syncedAt.slice(0, 10)}</p>}
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}

function OnboardingTab({ hub }: { hub: Hub }) {
  const o = hub.onboarding;
  if (o.total === 0) return <Empty text="No onboarding project has been started for this home." />;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-primary" /> Project progress
          </CardTitle>
          <CardDescription>
            {o.complete} of {o.total} steps complete{o.stage ? ` · stage ${label(o.stage)}` : ""}
            {o.subtaskTotal
              ? ` · ${o.subtaskComplete} of ${o.subtaskTotal} subtasks complete`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={o.percent} />
          {o.handoff && (
            <p className="text-sm text-muted-foreground">
              Handoff: {label(String(o.handoff.status))}
              {o.handoff.gate_step ? ` · ${label(String(o.handoff.gate_step))}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {hub.viewer.staff && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-danger" /> Blockers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.blockers.length === 0 ? (
              <p className="text-muted-foreground">Nothing is blocked.</p>
            ) : (
              o.blockers.map((b) => (
                <div key={b.id}>
                  <span className="font-medium">{b.title}</span>{" "}
                  <span className="text-muted-foreground">— {b.blocker ?? "blocked"}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{hub.viewer.staff ? "Current tasks" : "What ARHA is working on"}</CardTitle>
          <CardDescription>The active work, not the full plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {o.current.length === 0 ? (
            <p className="text-muted-foreground">Every task is complete.</p>
          ) : (
            o.current.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {label(t.stage)}
                    {t.dueOn ? ` · due ${t.dueOn}` : ""}
                  </div>
                </div>
                {hub.viewer.staff && !t.assigned && <Badge variant="outline">Unassigned</Badge>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {hub.viewer.staff && (
        <Link to="/onboarding" className="inline-block text-sm text-primary underline">
          Open the onboarding workspace
        </Link>
      )}
    </div>
  );
}

// The groups a coordinator needs while a job is running: what is broken, how
// to get in, and where the shutoffs are. Same data as Property details — read
// once, shown where the work happens.
const OPERATIONAL_GROUPS = [
  "utilities_shutoffs",
  "hvac",
  "waste",
  "safety",
  "sprinklers_grounds",
  "pool_spa",
  "equipment",
  "other_systems",
  "special_handling",
];

function OperationsTab({ hub }: { hub: Hub }) {
  const ops = hub.operations;
  const opsGroups = (hub.details.groups ?? []).filter((g) => OPERATIONAL_GROUPS.includes(g.id));
  return (
    <div className="space-y-4">
      {opsGroups.length > 0 && (
        <section className="space-y-3">
          <SectionBand
            title="Utilities & building systems"
            hint="Providers, shutoffs, filters and equipment for this home."
          />
          <PropertyDetailSections
            groups={opsGroups}
            onGoToCredentials={() =>
              document.getElementById("credentials")?.scrollIntoView({ behavior: "smooth" })
            }
          />
        </section>
      )}


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" /> Tickets
          </CardTitle>
          <CardDescription>Open first, then the most recent closures.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {ops.tickets.length === 0 ? (
            <p className="text-muted-foreground">No tickets have been logged for this home.</p>
          ) : (
            ops.tickets.map((t) => (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0 hover:text-primary"
              >
                <span>
                  <span className="font-medium">ARHA-{t.ref}</span> {t.title}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={t.priority === "p1" ? "destructive" : "outline"}>{String(t.priority).toUpperCase()}</Badge>
                  <Badge variant="secondary">{label(t.status)}</Badge>
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Work orders</CardTitle>
          <CardDescription>Vendor execution dispatched from Resolve.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {ops.workOrders.length === 0 ? (
            <p className="text-muted-foreground">No work orders have been dispatched for this home.</p>
          ) : (
            ops.workOrders.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
                <span>{w.title}</span>
                <Badge variant="outline">{label(w.status)}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {hub.viewer.staff && <BreezewayWorkOrderPanel propertyId={hub.property.id} />}
    </div>
  );
}

function DocumentsTab({ hub }: { hub: Hub }) {
  return (
    <PropertyDocumentLibrary
      propertyId={hub.property.id}
      documents={hub.documents}
      links={hub.externalLinks ?? []}
      staff={hub.viewer.staff}
    />
  );
}

function ApprovalsTab({ hub }: { hub: Hub }) {
  const a = hub.approvals;
  const nothing = a.ownerActions.length === 0 && a.decided.length === 0 && a.records.length === 0;
  if (nothing) return <Empty text="Nothing is awaiting a decision for this home." />;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-danger" /> Awaiting homeowner approval
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {a.ownerActions.length === 0 ? (
            <p className="text-muted-foreground">Nothing is waiting on the homeowner.</p>
          ) : (
            a.ownerActions.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-4">
                <span>{x.title}</span>
                <Link to="/owner" className="text-primary underline">
                  Review
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-primary" /> Decision history
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {a.decided.length === 0 && a.records.length === 0 ? (
            <p className="text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            <>
              {a.decided.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-4">
                  <span>{x.title}</span>
                  <Badge variant="secondary">{label(x.status)}</Badge>
                </div>
              ))}
              {a.records.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4">
                  <span>{r.title}</span>
                  <Badge variant="outline">{label(r.status)}</Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityTab({ hub }: { hub: Hub }) {
  if (hub.activity.length === 0) {
    return <Empty text="No Resolve activity recorded for this home yet. Historical Notion, Asana and Breezeway history stays in those systems." />;
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-primary" /> Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {hub.activity.map((a) => (
          <div key={a.id} className="border-b border-border/50 pb-2 last:border-0">
            <div className="font-medium">{label(a.action)}</div>
            <div className="text-xs text-muted-foreground">
              {a.actor ?? "ARHA"} · {a.at.slice(0, 16).replace("T", " ")}
              {a.reason ? ` · ${a.reason}` : ""}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-10 text-muted-foreground">
      <Home className="size-4" />
      <p>{text}</p>
    </div>
  );
}

function label(v: string | null | undefined) {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
