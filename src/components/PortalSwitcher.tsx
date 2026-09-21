import { useRouter } from "@tanstack/react-router";
import { EyeOff, FlaskConical, LayoutGrid } from "lucide-react";
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
import { useDemo } from "@/components/DemoProvider";
import { portalsFor, rememberPortal } from "@/lib/portals";

/**
 * Header control for Platform Owners: jump to a portal, or turn Demo on.
 *
 * Demo is deliberately one switch. It never impersonates a persona and never
 * asks which property to use: the viewer demos the portals their own
 * permissions already grant, against demo records only.
 */
export function PortalSwitcher() {
  const router = useRouter();
  const { actualRoles, roles } = useRole();
  const { demoMode, enterDemo, exitDemo } = useDemo();
  const portals = portalsFor(roles);

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
            variant={demoMode ? "default" : "outline"}
            className="min-h-11 md:min-h-9"
          >
            {demoMode ? <FlaskConical className="size-4" /> : <LayoutGrid className="size-4" />}
            <span className="hidden sm:inline">{demoMode ? "Demo" : "Portals"}</span>
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
          {demoMode ? (
            <>
              <DropdownMenuItem onSelect={() => go("/demo")}>
                <FlaskConical className="size-4" /> Demo home
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  exitDemo();
                  go("/hub");
                }}
              >
                <EyeOff className="size-4" /> Leave demo
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              className="flex flex-col items-start gap-0.5"
              onSelect={() => {
                enterDemo();
                go("/demo");
              }}
            >
              <span className="flex items-center gap-2">
                <FlaskConical className="size-3.5" /> Demo
              </span>
              <span className="text-xs text-muted-foreground">
                Try any portal you have access to, using demo records only
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * One-click Demo button for the sticky top navigation. Takes the viewer
 * straight into the clean demo environment (and straight back out again).
 */
export function DemoButton() {
  const router = useRouter();
  const { demoMode, canDemo, enterDemo, exitDemo } = useDemo();

  if (!canDemo) return null;

  return (
    <Button
      size="sm"
      variant={demoMode ? "default" : "outline"}
      className="min-h-11 md:min-h-9"
      onClick={() => {
        if (demoMode) {
          exitDemo();
          void router.navigate({ to: "/hub" });
        } else {
          enterDemo();
          void router.navigate({ to: "/demo" });
        }
      }}
      aria-label={demoMode ? "Leave the demo environment" : "Enter the demo environment"}
    >
      {demoMode ? <EyeOff className="size-4" /> : <FlaskConical className="size-4" />}
      <span className="hidden sm:inline">{demoMode ? "Leave demo" : "Demo"}</span>
    </Button>
  );
}

/** Persistent reminder that the screen is a demo and cannot change live work. */
export function ViewAsBanner() {
  const { demoMode } = useDemo();
  const { exitDemo } = useDemo();

  if (!demoMode) return null;

  return (
    <div className="border-b border-indigo-200 bg-indigo-50 text-indigo-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <p>
          <strong className="mr-1">Demo</strong>— you are working in the demo environment. Real
          homes, homeowners, guests and vendors are untouched, and nothing leaves Resolve.
        </p>
        <Button size="sm" variant="outline" onClick={() => exitDemo()}>
          Leave demo
        </Button>
      </div>
    </div>
  );
}
