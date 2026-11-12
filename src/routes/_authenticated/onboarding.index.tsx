/**
 * Onboarding Home as the project database (approved by the Admin, Nov 12). Replaces the old
 * Onboarding Home: slim banner, tiles by role (behind onboarding_home_tiles), one list of homes
 * with My homes / All homes, two tabs, filters, saved views, CSV and five views. Everything the
 * page shows lives in the address, so Back and the breadcrumb restore it exactly.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Database, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingPage } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import heroImage from "@/assets/hero-arha-property.jpg";
import { bannerCaption, dailyHomePhoto } from "@/lib/daily-home-photo";
import { useHomeBannerPhotos } from "@/hooks/useHomeBannerPhotos";
import { centralHour, firstNameOf } from "@/lib/onboarding-board";
import { useRole } from "@/hooks/useRole";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useFeatureFlags } from "@/lib/feature-flags";
import { applyTestDataFilter } from "@/lib/test-data";
import {
  anyFilter,
  clearAll,
  defaultScope,
  filtersOf,
  greetingForHour,
  homesCsv,
  isLead,
  mayManageHomes,
  openAtFor,
  otherTabMatches,
  parseHomeSearch,
  scopeCounts,
  searchFromSaved,
  tabFor,
  tileClick,
  tileLabel,
  tileValue,
  tilesFor,
  viewOnlyFor,
  viewToSave,
  visibleRows,
  OPTIONAL_COLUMNS,
  type FilterKey,
  type HomeRow,
  type HomeSearch,
  type OptionalColumn,
  type OwnerRezRow,
  type SavedView,
} from "@/lib/onboarding-home";
import {
  archiveHomeViewFn,
  assignFromListFn,
  contractFellThroughFn,
  dismissOwnerRezListingFn,
  getOnboardingHomeFn,
  notInResolveYetFn,
  saveHomeColumnsFn,
  saveHomeViewFn,
  setProjectStagersFn,
} from "@/lib/onboarding-home.functions";
import { getOnboardingWorkspace, resolveExternalRecordFn } from "@/lib/onboarding.functions";
import { HomeBanner } from "@/components/onboarding/project-db/HomeBanner";
import { HomeTiles } from "@/components/onboarding/project-db/HomeTiles";
import { FilterBar } from "@/components/onboarding/project-db/FilterBar";
import { HomesTable, PastProjects } from "@/components/onboarding/project-db/HomesTable";
import { GalleryView, GanttView, StatusView, WorkloadView } from "@/components/onboarding/project-db/HomeViews";
import { ROLE_NAME, type AssignChoice } from "@/components/onboarding/project-db/TeamCircles";
import { AddHomePanel, type AddResult, type AddStart } from "@/components/onboarding/project-db/AddHomePanel";
import { ExternalRecordsPanel } from "@/components/onboarding/ExternalRecordsPanel";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  head: () => ({
    meta: [
      { title: "Onboarding Home: Resolve" },
      { name: "description", content: "Every onboarding home in one list: tiles for what needs you, My homes or All homes, filters, saved views and five views." },
      { property: "og:title", content: "Onboarding Home: Resolve" },
      { property: "og:description", content: "The onboarding project database: every active, upcoming and past home with its team, schedule and handoff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): HomeSearch => parseHomeSearch(raw),
  component: OnboardingHome,
  errorComponent: () => <p className="text-muted-foreground">Onboarding Home could not be loaded.</p>,
});

const COLUMNS_KEY = (userId: string) => `onboarding-home-columns:${userId}`;

function OnboardingHome() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { userId, readOnly, isAdmin, can } = useRole();
  const { enabled } = useFeatureFlags();
  const { token: originToken } = useWorkspaceOrigin("Onboarding Home");
  const load = useServerFn(getOnboardingHomeFn);
  const loadOwnerRez = useServerFn(notInResolveYetFn);
  const { data, isLoading, error } = useQuery({ queryKey: ["onboarding-home", userId], queryFn: () => load(), enabled: Boolean(userId) });
  const { data: me } = useQuery({
    queryKey: ["my-name", userId],
    enabled: Boolean(userId),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data: row, error: e } = await supabase.from("profiles").select("first_name, full_name").eq("id", userId!).maybeSingle();
      if (e) throw e;
      return row;
    },
  });
  const photos = useHomeBannerPhotos();
  const [photoFailed, setPhotoFailed] = useState(false);
  const viewer = data?.viewer ?? { userId, isAdmin: false, isDirector: false };
  const lead = isLead(viewer);
  const manage = mayManageHomes(viewer, readOnly);
  // 2.6: the live OwnerRez check runs on page open for the Director and Admin.
  const ownerRez = useQuery({ queryKey: ["onboarding-home-ownerrez", userId], enabled: Boolean(data && lead), queryFn: () => loadOwnerRez(), retry: false, staleTime: 5 * 60_000 });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["onboarding-home"] });
    void qc.invalidateQueries({ queryKey: ["onboarding-home-ownerrez"] });
  };
  const setSearch = (patch: Partial<HomeSearch>, replace = true) =>
    void navigate({
      search: (prev: HomeSearch) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
        return next as HomeSearch;
      },
      replace,
    });

  // Columns: saved per person (staged saved_views); until applied, kept for this person on this device.
  const [localColumns, setLocalColumns] = useState<OptionalColumn[] | null>(null);
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COLUMNS_KEY(userId));
      if (raw) setLocalColumns((JSON.parse(raw) as string[]).filter((c): c is OptionalColumn => OPTIONAL_COLUMNS.some((o) => o.key === c)));
    } catch {
      /* ignore */
    }
  }, [userId]);
  const columns: OptionalColumn[] = (data?.columns as OptionalColumn[] | null | undefined) ?? localColumns ?? [];
  const saveColumns = useServerFn(saveHomeColumnsFn);
  const onColumns = (next: OptionalColumn[]) => {
    setLocalColumns(next);
    if (userId && typeof window !== "undefined") window.localStorage.setItem(COLUMNS_KEY(userId), JSON.stringify(next));
    if (data?.columns !== null && data?.columns !== undefined)
      void saveColumns({ data: { columns: next } }).then(refresh, (e: Error) => toast.error(e.message));
  };

  const saveView = useMutation({
    mutationFn: useServerFn(saveHomeViewFn),
    onSuccess: () => {
      toast.success("View saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeView = useMutation({ mutationFn: useServerFn(archiveHomeViewFn), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const assign = useServerFn(assignFromListFn);
  const setStagers = useServerFn(setProjectStagersFn);
  const fellThrough = useServerFn(contractFellThroughFn);
  const dismiss = useServerFn(dismissOwnerRezListingFn);
  const [assigning, setAssigning] = useState(false);
  const [adding, setAdding] = useState<AddStart | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const [asking, setAsking] = useState<{ kind: "fell"; row: HomeRow } | { kind: "dismiss"; listing: OwnerRezRow } | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(() => applyTestDataFilter(data?.rows ?? [], false, (r) => ({ is_demo: r.isDemo, name: r.name })), [data]);

  if (isLoading || !data) return error ? <p role="alert" className="text-muted-foreground">{(error as Error).message}</p> : <LoadingPage />;

  const today = data.today;
  const tab = search.tab ?? "active";
  const scope = search.scope ?? defaultScope(viewer);
  const view = search.view ?? "table";
  const tile = tab === "active" ? search.tile ?? null : null;
  const filters = filtersOf(search);
  const q = search.q ?? "";
  const shown = visibleRows({ rows, tab, scope, tile, q, filters, today });
  const counts = scopeCounts(rows);
  const others = otherTabMatches(rows, tab, q);
  const tilesOn = enabled("onboarding_home_tiles");
  const ownerRezRows = ownerRez.data?.ok ? ownerRez.data.rows : [];
  const tiles = tilesFor(viewer).map((t) => ({ ...t, value: tileValue(t.key, rows.filter((r) => scope === "all" || lead || r.onTeam || r.followed), ownerRezRows, today) }));
  const isViewOnly = (r: HomeRow) => viewOnlyFor(viewer, r.onTeam);

  const rowSearch = (r: HomeRow) => ({ ...(originToken ? { from: originToken } : {}), ...openAtFor(tile) }) as never;
  const rowLink = (r: HomeRow, children: ReactNode, className?: string) => (
    <Link to="/onboarding/$propertyId" params={{ propertyId: r.propertyId }} search={rowSearch(r)} className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
  const openRow = (r: HomeRow) => void navigate({ to: "/onboarding/$propertyId", params: { propertyId: r.propertyId }, search: rowSearch(r) });

  const onAssign = async (r: HomeRow, c: AssignChoice) => {
    if (!r.projectId) return;
    setAssigning(true);
    try {
      let undo: () => Promise<unknown>;
      if (c.role === "stager") {
        const before = r.team.stagers.map((s) => s.id);
        await setStagers({ data: { projectId: r.projectId, vendorIds: [...before, c.person.id] } });
        undo = () => setStagers({ data: { projectId: r.projectId!, vendorIds: before } });
      } else {
        const res = await assign({ data: { projectId: r.projectId, role: c.role, userId: c.person.id } });
        undo = () => assign({ data: { projectId: r.projectId!, role: c.role as "pm", userId: res.previous } });
      }
      refresh();
      toast(`${ROLE_NAME[c.role]} set to ${c.person.name} on ${r.name}`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: () =>
            void undo().then(
              () => {
                toast.success("Undone.");
                refresh();
              },
              (e: Error) => toast.error(e.message),
            ),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Not saved.");
    } finally {
      setAssigning(false);
    }
  };

  const onAdded = (r: AddResult) => {
    setAdding(null);
    refresh();
    for (const p of r.problems) toast.warning(p);
    if (r.upcoming) {
      toast.success(`${r.name} added as Upcoming`);
      return;
    }
    if (r.listingId) {
      setAdded((s) => new Set(s).add(r.listingId!));
      toast.success(`${r.name} added${r.planBuilt ? " and its plan built" : ""}`, {
        duration: 10_000,
        action: { label: "Open it", onClick: () => void navigate({ to: "/onboarding/$propertyId", params: { propertyId: r.propertyId } }) },
      });
      return;
    }
    void navigate({ to: "/onboarding/$propertyId", params: { propertyId: r.propertyId } });
  };

  const submitReason = async () => {
    if (!asking || reason.trim().length < 3) return;
    try {
      if (asking.kind === "fell") {
        await fellThrough({ data: { projectId: asking.row.projectId!, reason: reason.trim() } });
        toast.success(`${asking.row.name} moved to past projects.`);
      } else {
        await dismiss({ data: { listingId: asking.listing.listingId, name: asking.listing.name, reason: reason.trim() } });
        toast.success(`${asking.listing.name} hidden from this list.`);
      }
      setAsking(null);
      setReason("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Not saved.");
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([homesCsv(shown, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onboarding-homes-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const firstName = firstNameOf(me);
  const banner = photoFailed ? null : dailyHomePhoto(photos.data ?? [], new Date());
  const addHomeButton = manage ? (
    <Button onClick={() => setAdding({ mode: "new" })} className="min-h-11 gap-2 bg-card text-foreground hover:bg-card/90">
      <Plus className="size-4" /> Add a home
    </Button>
  ) : null;

  return (
    <div className="space-y-5">
      <HomeBanner
        photo={banner?.photo ?? heroImage}
        caption={banner ? bannerCaption(banner).replace(", ", " · ") : null}
        dateLine={new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" })}
        greeting={`${greetingForHour(centralHour())}${firstName ? `, ${firstName}` : ""}`}
        onPhotoError={() => setPhotoFailed(true)}
        addHome={addHomeButton}
      />

      {tilesOn ? <HomeTiles tiles={tiles} active={tile} onClick={(k) => setSearch(tileClick(search, k), false)} /> : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-border" role="tablist" aria-label="Projects">
        {(["active", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setSearch({ tab: t === "active" ? undefined : "all", tile: undefined }, false)}
            className={`numeric -mb-px min-h-11 border-b-2 px-3 text-sm font-medium ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "active" ? `Active projects (${counts.all})` : "All projects, including past"}
          </button>
        ))}
        {isAdmin ? <SourceRecords disabled={readOnly || !can("handoff_request")} /> : null}
      </div>

      <FilterBar
        tab={tab}
        scope={scope}
        counts={counts}
        onScope={(s) => setSearch({ scope: s })}
        tile={tile ? { key: tile, label: tileLabel(tile) } : null}
        onClearTile={() => setSearch({ tile: undefined })}
        q={q}
        onQ={(v) => setSearch({ q: v || undefined })}
        rows={rows.filter((r) => tabFor(r) === tab)}
        filters={filters}
        onFilter={(k: FilterKey, v) => setSearch({ [k]: v })}
        anyOn={anyFilter(filters) || Boolean(tile) || Boolean(q)}
        onClear={() => void navigate({ search: clearAll(search) as never, replace: true })}
        savedViews={data.savedViews as SavedView[] | null}
        onSaveView={(name) => {
          const v = viewToSave(search);
          saveView.mutate({ data: { name, filters: v.filters as Record<string, string>, view: v.view, sort: v.sort } });
        }}
        onOpenView={(v) => void navigate({ search: searchFromSaved(v) as never })}
        onRemoveView={(v) => removeView.mutate({ data: { id: v.id } })}
        saving={saveView.isPending}
        onCsv={downloadCsv}
        view={view}
        onView={(v) => setSearch({ view: v === "table" ? undefined : v })}
      />
      {others > 0 ? (
        <button type="button" className="min-h-11 text-sm font-medium text-primary hover:underline" onClick={() => setSearch({ tab: tab === "active" ? "all" : undefined, tile: undefined }, false)}>
          {tab === "active" ? `Also in past projects: ${others} ›` : `Also in active projects: ${others} ›`}
        </button>
      ) : null}

      {tab === "all" ? (
        <PastProjects rows={shown} />
      ) : view === "table" ? (
        <HomesTable
          rows={tile === "not_in_resolve" ? [] : shown}
          total={counts.all}
          tile={tile}
          today={today}
          isViewOnly={isViewOnly}
          rowLink={rowLink}
          onRowOpen={openRow}
          pickers={manage ? data.pickers : null}
          onAssign={(r, c) => void onAssign(r, c)}
          assigning={assigning}
          columns={columns}
          onColumns={onColumns}
          upcomingActions={
            manage
              ? (r) => (
                  <>
                    <Button size="sm" className="min-h-11" onClick={() => setAdding({ mode: "upcoming", row: r })}>
                      Under contract: start the plan
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11" disabled={!r.projectId} onClick={() => setAsking({ kind: "fell", row: r })}>
                      Contract fell through
                    </Button>
                  </>
                )
              : null
          }
          ownerRez={
            tile === "not_in_resolve" && lead
              ? {
                  rows: ownerRezRows,
                  loading: ownerRez.isPending,
                  error: ownerRez.data && !ownerRez.data.ok ? ownerRez.data.error : ownerRez.error ? "Could not check OwnerRez." : null,
                  added,
                  actions: (l) =>
                    manage ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="min-h-11" onClick={() => setAdding({ mode: "ownerrez", listing: l })}>
                          Add a home
                        </Button>
                        <Button size="sm" variant="outline" className="min-h-11" onClick={() => setAsking({ kind: "dismiss", listing: l })}>
                          Not an onboarding home
                        </Button>
                      </div>
                    ) : null,
                }
              : null
          }
        />
      ) : view === "gallery" ? (
        <GalleryView rows={shown} rowLink={rowLink} />
      ) : view === "status" ? (
        <StatusView rows={shown} rowLink={rowLink} />
      ) : view === "gantt" ? (
        <GanttView rows={shown.filter((r) => r.lifecycle === "active")} today={today} rowLink={rowLink} />
      ) : (
        <WorkloadView rows={shown} />
      )}

      {adding ? (
        <AddHomePanel
          open
          onOpenChange={(v) => !v && setAdding(null)}
          start={adding}
          pickers={data.pickers}
          directorDefault={data.directorDefault}
          existing={rows}
          onDone={onAdded}
        />
      ) : null}

      <Dialog open={Boolean(asking)} onOpenChange={(v) => { if (!v) { setAsking(null); setReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{asking?.kind === "fell" ? "Contract fell through" : "Not an onboarding home"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">{asking?.kind === "fell" ? asking.row.name : asking?.listing.name}</p>
            <Label htmlFor="reason">Short reason</Label>
            <Textarea id="reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="min-h-11" disabled={reason.trim().length < 3} onClick={() => void submitReason()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Admin only: the source records reconciliation tool that used to sit on the old All properties list. */
function SourceRecords({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const load = useServerFn(getOnboardingWorkspace);
  const resolve = useServerFn(resolveExternalRecordFn);
  const { enabled } = useFeatureFlags();
  const qc = useQueryClient();
  const ws = useQuery({ queryKey: ["onboarding-workspace", "source-records"], enabled: open, queryFn: () => load() });
  const resolveRecord = useMutation({
    mutationFn: resolve,
    onSuccess: () => {
      toast.success("Record updated.");
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto min-h-11 gap-1">
          <Database className="size-4" /> Source records
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Source records</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {!ws.data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ExternalRecordsPanel
              databases={ws.data.externalDatabases as never}
              records={ws.data.externalRecords as never}
              properties={ws.data.properties}
              syncConfigured={enabled("onboarding_external_sync")}
              disabled={disabled}
              onResolve={(input) => resolveRecord.mutate({ data: input })}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
