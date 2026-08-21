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
import { PORTALS, ROLE_BLURBS, ROLE_LABELS, type AppRole } from "@/lib/permissions";

const PREVIEW_ROLES: AppRole[] = ["manager", "onboarding", "tech", "vendor", "owner"];

/** Header control for Platform Owners: jump portals, or preview a role read-only. */
export function PortalSwitcher() {
  const router = useRouter();
  const { isPlatformOwner, previewing, actualRoles } = useRole();
  const { viewAs, setViewAs, clearViewAs } = useViewAs();

  if (!actualRoles.includes("admin")) return null;

  function go(to: string) {
    void router.navigate({ to });
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LayoutGrid className="size-4" />
            Portals
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Go to portal</DropdownMenuLabel>
          {PORTALS.map((portal) => (
            <DropdownMenuItem key={portal.value} onSelect={() => go(portal.landing)}>
              {portal.label}
            </DropdownMenuItem>
          ))}
          {isPlatformOwner && (
            <DropdownMenuItem onSelect={() => go("/command-center")}>
              Executive Command Center
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2">
            <Eye className="size-3.5" /> View as (read-only)
          </DropdownMenuLabel>
          {PREVIEW_ROLES.map((role) => (
            <DropdownMenuItem
              key={role}
              onSelect={() => {
                setViewAs(role);
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
              <DropdownMenuItem onSelect={() => clearViewAs()}>
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
