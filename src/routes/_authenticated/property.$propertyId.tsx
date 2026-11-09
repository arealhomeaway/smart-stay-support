/**
 * The property page: one home, organized like the Notion PID (register P1).
 *
 * Staff only. The server decides what each person may read; this file renders
 * it. Codes stay encrypted behind a logged Show. Nothing here deletes data.
 */
import { HomeRepeatFlags } from "@/components/work-entry/HomeRepeatFlags";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Activity, ChevronDown, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmailComposer } from "@/components/EmailComposer";
import { TwoStepHandoff } from "@/components/onboarding/TwoStepHandoff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, ticketTone } from "@/components/ui/status";
import { usDate, usDateTime } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/ui/page";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyFeedbackTab } from "@/components/feedback/PropertyFeedbackTab";
import { PropertyWorkHistory } from "@/components/work-entry/PropertyWorkHistory";
import { PropertyDepartureReviews } from "@/components/departure/DepartureReviewQueue";
import { ExpensesCard } from "@/components/finance/ExpensesCard";
import { getPropertyHubFn } from "@/lib/property-hub.functions";
import { marketingPhotosFolder } from "@/lib/marketing-photos.functions";
import { BreezewayWorkOrderPanel } from "@/components/BreezewayWorkOrderPanel";
import { SpecialHandlingPanel } from "@/components/SpecialHandlingPanel";
import { PropertyFactsCard } from "@/components/PropertyFactsCard";
import { PropertyDocumentLibrary } from "@/components/PropertyDocumentLibrary";
import { OwnerLinkPanel } from "@/components/OwnerLinkPanel";
import { HomeownerCard } from "@/components/property/HomeownerCard";
import { ArrivalReadyCard } from "@/components/scorecard/ArrivalReadyCard";
import { LifecycleSwitcher } from "@/components/property/LifecycleSwitcher";
import { ActiveOwnerEnrollForm } from "@/components/property/ActiveOwnerEnrollForm";
import { ActualClosingCorrection } from "@/components/property/ActualClosingCorrection";
import { CompletedOnboardingRecords } from "@/components/property/CompletedOnboardingRecords";
import { VendorCoveragePanel } from "@/components/onboarding/VendorCoveragePanel";
import { OwnerRezListingCard } from "@/components/property/OwnerRezListingCard";
import { LabelChip, PropertyLabelsSection, useHomeLabels } from "@/components/property/PropertyLabels";
import { HomeProfileTab, goToProfileItem, useProfileContext } from "@/components/property/HomeProfileTab";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { COMPLIANCE_ITEMS, displayValue, missingForHandoff } from "@/lib/home-profile";
import {
  MORE_MENU_LABELS,
  departmentFor,
  handoffBanner,
  headerLine,
  isOnboardingHome,
  moreMenuItems,
  propertyTabsFor,
  resolveTab,
  splitActivity,
  stageLabel,
  type MoreMenuItem,
  type PropertyTabId,
} from "@/lib/property-page";

export const Route = createFileRoute("/_authenticated/property/$propertyId")({
  head: () => ({
    meta: [
      { title: "Property | Resolve" },
      { name: "description", content: "One home in Resolve: its profile, codes behind Show, owner, work and history." },
      { property: "og:title", content: "Property | Resolve" },
      { property: "og:description", content: "One home in Resolve: its profile, owner, work and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): { from?: string | undefined; tab?: string | undefined } => ({
    ...(typeof raw["from"] === "string" && raw["from"] ? { from: raw["from"] } : {}),
    ...(typeof raw["tab"] === "string" && raw["tab"] ? { tab: raw["tab"] } : {}),
  }),
  component: PropertyPage,
});

type Hub = Awaited<ReturnType<typeof getPropertyHubFn>>;

function PropertyPage() {
  const { propertyId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const role = useRole();
  const load = useServerFn(getPropertyHubFn);
  const q = useQuery({
    queryKey: ["property-hub", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });
  const access = useQuery({
    queryKey: ["home-profile-access"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_home_profile_access");
      if (error) throw error;
      return data as { edit: boolean; admin: boolean };
    },
    staleTime: 5 * 60 * 1000,
  });
  const tab = resolveTab(search.tab);
  const setTab = (next: string) => void navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });

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
            {q.error instanceof Error ? q.error.message : "Resolve could not load this home right now."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const hub = q.data;
  if (!hub.viewer.staff) {
    return <Empty text="This page is for the ARHA team." />;
  }
  const canEdit = access.data?.edit === true && !role.readOnly;
  const tabs = propertyTabsFor({ staff: hub.viewer.staff, properties: role.can("properties") });
  const department = departmentFor({ onboardingOnly: role.onboardingOnly });

  return (
    <PropertyPageBody
      hub={hub}
      propertyId={propertyId}
      tab={tab}
      setTab={setTab}
      tabs={tabs}
      canEdit={canEdit}
      isAdmin={access.data?.admin === true && !role.readOnly}
      department={department}
    />
  );
}

function PropertyPageBody({
  hub,
  propertyId,
  tab,
  setTab,
  tabs,
  canEdit,
  isAdmin,
  department,
}: {
  hub: Hub;
  propertyId: string;
  tab: PropertyTabId;
  setTab: (t: string) => void;
  tabs: { id: PropertyTabId; label: string }[];
  canEdit: boolean;
  isAdmin: boolean;
  department: "operations" | "onboarding";
}) {
  const role = useRole();
  const { ctx } = useProfileContext(propertyId, hub.profile);
  const missing = useMemo(() => missingForHandoff(ctx), [ctx]);
  const onboarding = isOnboardingHome(hub.property.lifecycleStatus);
  const banner = handoffBanner({ onboarding, department, missing: missing.length, carriedOver: hub.carryovers.length });

  const showMissing = () => {
    setTab("onboarding");
    window.setTimeout(() => document.getElementById("missing-for-handoff")?.scrollIntoView({ behavior: "smooth" }), 80);
  };
  const showCarry = () => {
    setTab("onboarding");
    window.setTimeout(() => document.getElementById("carried-over")?.scrollIntoView({ behavior: "smooth" }), 80);
  };
  const fillIn = () => {
    const first = missing[0];
    setTab("profile");
    if (first) window.setTimeout(() => goToProfileItem(first.item.key), 120);
  };

  return (
    <div className="space-y-6">
      <PropertyHeader hub={hub} propertyId={propertyId} />

      {banner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4" role="status">
          <div className="space-y-1">
            <p className="font-medium">{banner.title}</p>
            {banner.note ? <p className="text-sm text-muted-foreground">{banner.note}</p> : null}
          </div>
          <Button
            className="min-h-11"
            variant="outline"
            onClick={banner.target === "carry" ? showCarry : department === "onboarding" ? fillIn : showMissing}
          >
            {banner.button}
          </Button>
        </div>
      ) : null}

      <PropertyLabelsSection propertyId={propertyId} canEdit={canEdit} isAdmin={isAdmin} userId={role.userId} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="min-h-11">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <HomeProfileTab propertyId={propertyId} profile={hub.profile} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="inspections" className="mt-4">
          <SectionCard title="Inspections for this home">
            <NothingYet />
          </SectionCard>
        </TabsContent>
        <TabsContent value="onboarding" className="mt-4">
          <OnboardingInformationTab
            hub={hub}
            propertyId={propertyId}
            missing={missing.map((m) => ({ key: m.item.key, label: m.item.label, section: m.section.title }))}
            onGoTo={(key) => {
              setTab("profile");
              window.setTimeout(() => goToProfileItem(key), 120);
            }}
            showOnboardingInformation={department === "onboarding" || role.isAdmin}
          />
        </TabsContent>
        <TabsContent value="house-items" className="mt-4 space-y-4">
          <SectionCard title="Household and Appliances">
            <NothingYet />
          </SectionCard>
          <SectionCard title="Furniture and TVs">
            <NothingYet />
          </SectionCard>
        </TabsContent>
        <TabsContent value="utilities" className="mt-4">
          <SectionCard title="Utility Info">
            <NothingYet />
          </SectionCard>
        </TabsContent>
        <TabsContent value="vendors" className="mt-4 space-y-2">
          <h2 className="text-base font-semibold">Vendors for this home</h2>
          <VendorCoveragePanel propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="owner" className="mt-4">
          <OwnerTab hub={hub} propertyId={propertyId} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="operations" className="mt-4">
          <OperationsTab hub={hub} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="reviews" className="mt-4 space-y-2">
          <h2 className="text-base font-semibold">Reviews from OwnerRez</h2>
          <PropertyFeedbackTab propertyId={propertyId} kind="external_review" isDemo={!!hub.property.isDemo} isSupervisor={!!hub.viewer.supervisor} />
        </TabsContent>
        <TabsContent value="surveys" className="mt-4 space-y-2">
          <h2 className="text-base font-semibold">Guest surveys</h2>
          <PropertyFeedbackTab propertyId={propertyId} kind="internal_survey" isDemo={!!hub.property.isDemo} isSupervisor={!!hub.viewer.supervisor} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab hub={hub} propertyId={propertyId} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab hub={hub} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function PropertyHeader({ hub, propertyId }: { hub: Hub; propertyId: string }) {
  const role = useRole();
  const p = hub.property;
  const labels = useHomeLabels(propertyId);
  const onboarding = isOnboardingHome(p.lifecycleStatus);
  const program = hub.overview.program;
  const activeOwner = Boolean(program && program.status !== "complete");
  const getFolder = useServerFn(marketingPhotosFolder);
  const [dialog, setDialog] = useState<MoreMenuItem | null>(null);
  const canCorrect = useQuery({
    queryKey: ["can-correct-actual-closing"],
    queryFn: async () => (await supabase.rpc("can_correct_actual_closing")).data === true,
    staleTime: 5 * 60 * 1000,
  });

  const items = moreMenuItems({
    staff: hub.viewer.staff,
    readOnly: role.readOnly,
    onboarding,
    activeOwner,
    canChangeOwner: hub.viewer.staff,
    canMoveToOnboarding: hub.viewer.supervisor,
    canEnrollActiveOwner: role.can("active_owner_enroll"),
    canCorrectClosing: canCorrect.data === true,
  });

  const line = headerLine({
    onboarding,
    handedOffOn: hub.header?.handedOffOn ? usDate(hub.header.handedOffOn) : null,
    projectManager: hub.header?.projectManager ?? null,
    handoffOn: hub.header?.handoffOn ? usDate(hub.header.handoffOn) : null,
    carriedOver: hub.carryovers.length,
  });
  const showToggle = role.can("onboarding_workspace") && Boolean(hub.header?.hasProject);

  const choose = async (item: MoreMenuItem) => {
    if (item === "photos_folder") {
      try {
        const r = await getFolder({ data: { propertyId } });
        if (r.url) window.open(r.url, "_blank", "noopener");
        else toast.message(r.note ?? "The photos folder could not be found.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "The photos folder could not be opened.");
      }
      return;
    }
    setDialog(item);
  };

  return (
    <div className="surface space-y-3 p-5 shadow-raised">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{line}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showToggle ? (
            <nav aria-label="Switch view" className="flex rounded-lg bg-muted p-1">
              <Link
                to="/property/$propertyId"
                params={{ propertyId }}
                aria-current="page"
                className="inline-flex min-h-11 items-center rounded-md bg-background px-3 text-sm font-medium shadow-sm"
              >
                Operations view
              </Link>
              <Link
                to="/onboarding/$propertyId"
                params={{ propertyId }}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Onboarding view
              </Link>
            </nav>
          ) : null}
          {items.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-h-11">
                  More <ChevronDown className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {items.map((item) => (
                  <DropdownMenuItem key={item} className="min-h-11" onSelect={() => void choose(item)}>
                    {MORE_MENU_LABELS[item]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={onboarding ? "waiting" : "resolved"}>{stageLabel(p.lifecycleStatus)}</StatusBadge>
        {activeOwner ? <StatusBadge tone="context">Active Owner</StatusBadge> : null}
        {hub.overview.openTickets > 0 ? (
          <StatusBadge tone="escalated">
            {hub.overview.openTickets} open ticket{hub.overview.openTickets === 1 ? "" : "s"}
          </StatusBadge>
        ) : null}
        {(labels.data?.labels ?? []).map((l) => (
          <LabelChip key={l.id} name={l.name} />
        ))}
      </div>

      {/* The More menu opens the same windows the rest of Resolve uses. */}
      {dialog === "change_owner" ? (
        <OwnerLinkPanel
          propertyId={propertyId}
          hasOwner={Boolean(hub.ownerRecord)}
          open
          hideTrigger
          onOpenChange={(v) => (!v ? setDialog(null) : undefined)}
        />
      ) : null}
      {dialog === "move_to_onboarding" ? (
        <LifecycleSwitcher
          propertyId={propertyId}
          propertyName={p.name}
          lifecycleStatus={p.lifecycleStatus ?? null}
          canManage={hub.viewer.supervisor}
          open
          dialogOnly
          onOpenChange={(v) => (!v ? setDialog(null) : undefined)}
        />
      ) : null}
      {dialog === "enroll_active_owner" ? (
        <ActiveOwnerEnrollForm
          propertyId={propertyId}
          propertyName={p.name}
          showTrigger={false}
          open
          onOpenChange={(v) => (!v ? setDialog(null) : undefined)}
        />
      ) : null}
      <Dialog open={dialog === "correct_closing"} onOpenChange={(v) => (!v ? setDialog(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct actual closing</DialogTitle>
          </DialogHeader>
          {dialog === "correct_closing" ? (
            <ActualClosingCorrection propertyId={propertyId} startOpen onDone={() => setDialog(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NothingYet() {
  return <p className="text-sm text-muted-foreground">Nothing here yet</p>;
}

/* ---------------------------------------------------------------- */

function OnboardingInformationTab({
  hub,
  propertyId,
  missing,
  onGoTo,
  showOnboardingInformation,
}: {
  hub: Hub;
  propertyId: string;
  missing: { key: string; label: string; section: string }[];
  onGoTo: (key: string) => void;
  showOnboardingInformation: boolean;
}) {
  const role = useRole();
  const navigate = Route.useNavigate();
  const o = hub.onboarding;
  return (
    <div className="space-y-4">
      <div id="missing-for-handoff" className="scroll-mt-24">
        <SectionCard title="Missing for handoff">
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything needed for handoff is filled in.</p>
          ) : (
            <ul className="divide-y divide-border">
              {missing.map((m) => (
                <li key={m.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.section}</p>
                  </div>
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => onGoTo(m.key)}>
                    Go to it
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div id="carried-over" className="scroll-mt-24">
        <SectionCard title="Carried over from onboarding">
          {hub.carryovers.length === 0 ? (
            <NothingYet />
          ) : (
            <ul className="divide-y divide-border">
              {hub.carryovers.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.category, c.dueOn ? `due ${usDate(c.dueOn)}` : null, c.acceptedAt ? `carried over ${usDate(c.acceptedAt)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {c.ticketId ? (
                    <Button asChild size="sm" variant="outline" className="min-h-11">
                      <Link to="/tickets/$ticketId" params={{ ticketId: c.ticketId }}>
                        Open ticket
                      </Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {hub.header?.hasProject ? (
        <SectionCard title="Handoff review">
          {/* Same handoff component and server checks as the Onboarding page; nothing duplicated. */}
          <TwoStepHandoff
            propertyId={propertyId}
            readOnly={role.readOnly}
            onOpenTask={(task) =>
              void navigate({ to: "/onboarding/$propertyId", params: { propertyId }, search: { task } as never })
            }
          />
        </SectionCard>
      ) : null}

      {showOnboardingInformation ? (
        <SectionCard title="Onboarding Information">
          {o.total === 0 ? (
            <p className="text-sm text-muted-foreground">No onboarding project has been started for this home.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                {o.complete} of {o.total} steps complete
                {o.subtaskTotal ? ` · ${o.subtaskComplete} of ${o.subtaskTotal} subtasks complete` : ""}
              </p>
              <Progress value={o.percent} />
              {o.current.length > 0 ? (
                <ul className="divide-y divide-border">
                  {o.current.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="font-medium">{t.title}</span>
                        {t.dueOn ? <span className="text-xs text-muted-foreground"> · due {usDate(t.dueOn)}</span> : null}
                      </span>
                      {!t.assigned ? <Badge variant="outline">Unassigned</Badge> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Every task is complete.</p>
              )}
              {role.can("onboarding_workspace") ? (
                <Link to="/onboarding/$propertyId" params={{ propertyId }} className="inline-flex min-h-11 items-center text-primary underline">
                  Open the onboarding workspace
                </Link>
              ) : null}
            </div>
          )}
        </SectionCard>
      ) : null}

      {/* Completed onboarding records are shared with Operations after handoff (read only). */}
      <CompletedOnboardingRecords propertyId={propertyId} />
    </div>
  );
}

function OwnerTab({ hub, propertyId, canEdit }: { hub: Hub; propertyId: string; canEdit: boolean }) {
  const owner = hub.ownerRecord;
  return (
    <div className="space-y-4">
      <SectionCard title="Owner and Contacts">
        {owner ? (
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <p className="font-medium sm:col-span-2">{owner.name ?? "Owner of record"}</p>
            <p>{owner.email ?? "No email on file"}</p>
            <p>{owner.phone ?? "No phone on file"}</p>
            <p className="text-muted-foreground">{[owner.city, owner.state].filter(Boolean).join(", ") || "No mailing city on file"}</p>
            {owner.propertyCount > 1 ? <p className="text-muted-foreground">Owns {owner.propertyCount} homes with ARHA</p> : null}
          </div>
        ) : (
          <div className="space-y-2">
            <NothingYet />
            {canEdit ? <OwnerLinkPanel propertyId={propertyId} hasOwner={false} /> : null}
          </div>
        )}
      </SectionCard>
      <SectionCard title="Owner" actions={<EmailComposer context="property" recordId={propertyId} label="Email owner" />}>
        <HomeownerCard propertyId={propertyId} canManage={hub.viewer.staff} />
      </SectionCard>
      <div id="special-handling">
        <SectionCard title="Special handling">
          {hub.property.operatingNotes ? (
            <p className="mb-3 whitespace-pre-line text-sm">{hub.property.operatingNotes}</p>
          ) : null}
          <SpecialHandlingPanel propertyId={propertyId} canEdit={hub.viewer.supervisor} />
        </SectionCard>
      </div>
      <SectionCard title="Amenities">
        <PropertyFactsCard propertyId={propertyId} />
      </SectionCard>
    </div>
  );
}

function OperationsTab({ hub, canEdit }: { hub: Hub; canEdit: boolean }) {
  const ops = hub.operations;
  const { originSearch } = useWorkspaceOrigin(
    hub.property.name,
    ops.tickets.map((t) => ({ id: t.id, label: t.title, sub: `ARHA-${t.ref}` })),
  );
  return (
    <div className="space-y-4">
      <HomeRepeatFlags propertyId={hub.property.id} />
      <ArrivalReadyCard propertyId={hub.property.id} />
      <OwnerRezListingCard propertyId={hub.property.id} listingId={hub.property.ownerRezListingId} canEdit={canEdit} />
      <SectionCard title="Breezeway work orders">
        <div className="space-y-3">
          <BreezewayWorkOrderPanel propertyId={hub.property.id} />
          {ops.workOrders.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {ops.workOrders.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-4 py-2">
                  <span>{w.title}</span>
                  <Badge variant="outline">{label(w.status)}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SectionCard>
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" /> Tickets
          </span>
        }
      >
        {ops.tickets.length === 0 ? (
          <NothingYet />
        ) : (
          <div className="space-y-1 text-sm">
            {ops.tickets.map((t) => (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                search={{ from: originSearch.from }}
                className="flex min-h-11 items-center justify-between gap-4 border-b border-border/50 last:border-0 hover:text-primary"
              >
                <span>
                  <span className="font-medium">ARHA-{t.ref}</span> {t.title}
                </span>
                <span className="flex items-center gap-2">
                  {t.notionBadge && <StatusBadge tone="context">{t.notionBadge}</StatusBadge>}
                  <StatusBadge tone={ticketTone(t.status)}>{label(t.status)}</StatusBadge>
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
      <PropertyDepartureReviews propertyId={hub.property.id} />
      <PropertyWorkHistory propertyId={hub.property.id} />
      <SectionCard title="Purchases from Ramp">
        <ExpensesCard propertyId={hub.property.id} />
      </SectionCard>
    </div>
  );
}

function DocumentsTab({ hub, propertyId }: { hub: Hub; propertyId: string }) {
  const getFolder = useServerFn(marketingPhotosFolder);
  const links = hub.externalLinks ?? [];
  const compliance = COMPLIANCE_ITEMS.map((i) => ({
    item: i,
    value: displayValue(i, { property: hub.profile?.raw ?? {}, credentials: [], photos: [], links: [], system: {} }),
  })).filter((c) => c.value);
  return (
    <div className="space-y-4">
      <SectionCard title="Links">
        {links.length === 0 ? (
          <NothingYet />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {links.map((l) => (
              <li key={l.id} className="py-1">
                <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-primary underline">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Folders">
        <div className="space-y-4">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              try {
                const r = await getFolder({ data: { propertyId } });
                if (r.url) window.open(r.url, "_blank", "noopener");
                else toast.message(r.note ?? "The photos folder could not be found.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "The photos folder could not be opened.");
              }
            }}
          >
            Open the photos folder
          </Button>
          <PropertyDocumentLibrary propertyId={propertyId} documents={hub.documents} links={[]} staff={hub.viewer.staff} />
        </div>
      </SectionCard>
      <SectionCard title="Compliance">
        {compliance.length === 0 ? (
          <NothingYet />
        ) : (
          <dl className="space-y-2 text-sm">
            {compliance.map((c) => (
              <div key={c.item.key}>
                <dt className="font-medium">{c.item.label}</dt>
                <dd className="whitespace-pre-line text-muted-foreground">{c.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </SectionCard>
    </div>
  );
}

function ActivityTab({ hub }: { hub: Hub }) {
  const [full, setFull] = useState(false);
  const { recent, older } = splitActivity(hub.activity);
  const rows = full ? [...recent, ...older] : recent;
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Activity className="size-4 text-primary" aria-hidden="true" /> Activity
        </span>
      }
      description="Newest first."
    >
      {rows.length === 0 ? (
        <NothingYet />
      ) : (
        <div className="space-y-2 text-sm">
          {rows.map((a) => (
            <div key={a.id} className="border-b border-border/50 pb-2 last:border-0">
              <div className="font-medium">
                {label(a.action)}
                {a.label ? <span className="font-normal text-muted-foreground"> · {a.label}</span> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {a.actor ?? "ARHA"} · {usDateTime(a.at)}
                {a.reason ? ` · ${a.reason}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {full ? (
          <Button variant="outline" className="min-h-11" onClick={() => setFull(false)}>
            Show the last 30 days
          </Button>
        ) : older.length > 0 ? (
          <Button variant="outline" className="min-h-11" onClick={() => setFull(true)}>
            Show the full history ({older.length} more)
          </Button>
        ) : null}
      </div>
    </SectionCard>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-10 text-muted-foreground">
      <p>{text}</p>
    </div>
  );
}

function label(v: string | null | undefined) {
  if (!v) return "";
  return v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
