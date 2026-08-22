import { useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, LayoutGrid } from "lucide-react";
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
import { ROLE_BLURBS, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { entryPathFor, portalsFor, rememberPortal } from "@/lib/portals";

const PREVIEW_ROLES: AppRole[] = ["manager", "onboarding", "tech", "vendor", "owner"];

/** Header control for Platform Owners: jump portals, or preview a role read-only. */
export function PortalSwitcher() {
  const router = useRouter();
  const { previewing, previewRole, actualRoles, roles } = useRole();
  const portals = portalsFor(roles);
  const { viewAs, setViewAs, clearViewAs } = useViewAs();

  if (!actualRoles.includes("admin")) return null;

  function go(to: string) {
    void router.navigate({ to });
  }

  /** Previewing a role should land you where that role actually starts. */
  function preview(role: AppRole) {
    setViewAs(role);
    go(entryPathFor([role]));
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant={previewing ? "default" : "outline"} className="min-h-11 md:min-h-9">
            {previewing ? <Eye className="size-4" /> : <LayoutGrid className="size-4" />}
            <span className="hidden sm:inline">
              {previewing && previewRole ? `Viewing as ${ROLE_LABELS[previewRole]}` : "Portals"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
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
            <Eye className="size-3.5" /> View as (read-only)
          </DropdownMenuLabel>

          {PREVIEW_ROLES.map((role) => (
            <DropdownMenuItem
              key={role}
              onSelect={() => {
                preview(role);
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <span className={viewAs === role ? "font-semibold" : undefined}>
                {ROLE_LABELS[role]}
              </span>
              <span className="text-xs text-muted-foreground">{ROLE_BLURBS[role]}</span>
            </DropdownMenuItem>
          ))}
          {previewing && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  clearViewAs();
                  go("/hub");
                }}
              >
                <EyeOff className="size-4" /> Exit preview
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Persistent reminder that the screen is a preview and cannot change data. */
export function ViewAsBanner() {
  const { previewing, previewRole } = useRole();
  const { clearViewAs } = useViewAs();
  if (!previewing || !previewRole) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-100 text-amber-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <span>
          Read-only preview — you are seeing Resolve as a{" "}
          <strong>{ROLE_LABELS[previewRole]}</strong>. No action can change data while previewing.
        </span>
        <Button size="sm" variant="outline" onClick={() => clearViewAs()}>
          Exit preview
        </Button>
      </div>
    </div>
  );
}
