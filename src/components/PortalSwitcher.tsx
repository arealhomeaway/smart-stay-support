import { useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, FlaskConical, LayoutGrid, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/hooks/useRole";
import { useViewAs } from "@/hooks/useViewAs";
import { useDemo } from "@/components/DemoProvider";
import { ROLE_BLURBS, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { entryPathFor, portalsFor, rememberPortal } from "@/lib/portals";
import { PREVIEW_SEAT_LABEL, type PreviewSeat } from "@/lib/demo-mode";

/**
 * Personas a Platform Owner can step into. Director of Operations and
 * Operations Supervisor share the manager permission role but do different
 * jobs, so each is offered as its own seat.
 */
const PREVIEW_PERSONAS: { id: string; role: AppRole; seat?: PreviewSeat; label: string; blurb: string }[] = [
  {
    id: "director_ops",
    role: "manager",
    seat: "director_ops",
    label: PREVIEW_SEAT_LABEL.director_ops,
    blurb: "Portfolio view: exceptions, risk, handoffs and workload across every pod",
  },
  {
    id: "ops_supervisor",
    role: "manager",
    seat: "ops_supervisor",
    label: PREVIEW_SEAT_LABEL.ops_supervisor,
    blurb: "The exception board: unacknowledged, overdue, waiting and unassigned work",
  },
  ...(["onboarding", "tech", "vendor", "owner"] as AppRole[]).map((role) => ({
    id: role,
    role,
    label: ROLE_LABELS[role],
    blurb: ROLE_BLURBS[role],
  })),
];

/** Header control for Platform Owners: jump portals, preview a role, or demo. */
export function PortalSwitcher() {
  const router = useRouter();
  const { previewing, previewRole, previewSeat, actualRoles, roles } = useRole();
  const { demoMode, enterDemo, exitDemo, status, seed, reset, seeding, resetting } = useDemo();
  const portals = portalsFor(roles);
  const { viewAs, clearViewAs } = useViewAs();

  if (!actualRoles.includes("admin")) return null;

  function go(to: string) {
    void router.navigate({ to });
  }

  /** Enter the safe demo lens as a persona, landing where that role starts. */
  function preview(role: AppRole, seat?: PreviewSeat) {
    enterDemo(role, seat ?? null);
    go(entryPathFor([role]));
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant={demoMode ? "default" : "outline"} className="min-h-11 md:min-h-9">
            {demoMode ? <FlaskConical className="size-4" /> : previewing ? <Eye className="size-4" /> : <LayoutGrid className="size-4" />}
            <span className="hidden sm:inline">
              {demoMode
                ? `Demo · ${previewSeat ? PREVIEW_SEAT_LABEL[previewSeat] : previewRole ? ROLE_LABELS[previewRole] : "preview"}`
                : previewing && previewRole
                  ? `Viewing as ${ROLE_LABELS[previewRole]}`
                  : "Portals"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Go to portal</DropdownMenuLabel>
          {portals.map((portal) => (
            <DropdownMenuItem
              key={portal.id}
              onSelect={() => {
                rememberPortal(portal.id);
                go(portal.route);
              }}
            >
              {portal.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => go("/hub")}>All my portals</DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2">
            <FlaskConical className="size-3.5" /> Demo environment
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={seeding || resetting}
            onSelect={() => void seed()}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="flex items-center gap-2">
              {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Seed demo data
            </span>
            <span className="text-xs text-muted-foreground">
              {status?.seeded ? `${status.scenarioCount} connected scenarios ready` : "No demo data yet"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!status?.seeded || seeding || resetting}
            onSelect={() => void reset()}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="flex items-center gap-2">
              {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Archive demo data
            </span>
            <span className="text-xs text-muted-foreground">Archives demo records (never deleted) so scenarios can re-run</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2">
            <Eye className="size-3.5" /> Enter demo as…
          </DropdownMenuLabel>
          {PREVIEW_PERSONAS.map((persona) => (
            <DropdownMenuItem
              key={persona.id}
              onSelect={() => {
                preview(persona.role, persona.seat);
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <span
                className={
                  viewAs === persona.role && demoMode && (persona.seat ?? null) === previewSeat
                    ? "font-semibold"
                    : undefined
                }
              >
                {persona.label}
              </span>
              <span className="text-xs text-muted-foreground">{persona.blurb}</span>
            </DropdownMenuItem>
          ))}
          {(demoMode || previewing) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  exitDemo();
                  clearViewAs();
                  go("/hub");
                }}
              >
                <EyeOff className="size-4" /> Exit demo
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Persistent reminder that the screen is a demo/preview and cannot change live data. */
export function ViewAsBanner() {
  const { previewing, previewRole, previewSeat } = useRole();
  const { demoMode, exitDemo, status } = useDemo();
  const { clearViewAs } = useViewAs();
  if (!previewing || !previewRole) return null;

  return (
    <div
      className={`border-b ${demoMode ? "border-indigo-200 bg-indigo-50 text-indigo-950" : "border-amber-200 bg-amber-100 text-amber-950"}`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <span>
          {demoMode ? (
            <>
              <strong className="mr-1">Safe demo environment</strong>— you are working as a{" "}
              <strong>{previewSeat ? PREVIEW_SEAT_LABEL[previewSeat] : ROLE_LABELS[previewRole]}</strong>. You can
              complete work here: changes are saved to demo records only, and real homes, guests, owners, vendors and
              email are never touched.{" "}
              {status?.seeded
                ? `${status.scenarioCount} scenarios are loaded.`
                : "No demo data is loaded — use the Portals menu to seed it."}
            </>
          ) : (
            <>
              Read-only preview — you are seeing Resolve as a{" "}
              <strong>{previewSeat ? PREVIEW_SEAT_LABEL[previewSeat] : ROLE_LABELS[previewRole]}</strong>. No action
              can change data while previewing.
            </>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={() => exitDemo()}>
          <EyeOff className="size-4" /> Exit
        </Button>
      </div>
    </div>
  );
}
