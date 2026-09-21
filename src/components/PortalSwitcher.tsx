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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
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
 * Shared behaviour for every Demo control: one tap in, one tap out.
 */
function useDemoToggle() {
  const router = useRouter();
  const { demoMode, canDemo, enterDemo, exitDemo } = useDemo();

  const toggle = () => {
    if (demoMode) {
      exitDemo();
      void router.navigate({ to: "/hub" });
    } else {
      enterDemo();
      void router.navigate({ to: "/demo" });
    }
  };

  return { demoMode, canDemo, toggle };
}

/**
 * One-click Demo button for the sticky top navigation. On a phone it is a
 * full 44px square icon target; the label appears once there is room.
 */
export function DemoButton() {
  const { demoMode, canDemo, toggle } = useDemoToggle();

  if (!canDemo) return null;

  const label = demoMode ? "Leave demo" : "Demo";

  return (
    <Button
      size="sm"
      variant={demoMode ? "default" : "outline"}
      className="min-h-11 min-w-11 shrink-0 px-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9 sm:w-auto sm:px-3"
      onClick={toggle}
      aria-pressed={demoMode}
      aria-label={demoMode ? "Leave the demo environment" : "Enter the demo environment"}
      title={label}
    >
      {demoMode ? (
        <EyeOff className="size-5 sm:size-4" aria-hidden="true" />
      ) : (
        <FlaskConical className="size-5 sm:size-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

/**
 * The same control inside the navigation menu, so it is reachable when the
 * menu is collapsed or opened on a phone. Tapping it closes the menu.
 */
export function DemoSidebarItem() {
  const { demoMode, canDemo, toggle } = useDemoToggle();
  const { setOpenMobile, isMobile } = useSidebar();

  if (!canDemo) return null;

  const label = demoMode ? "Leave demo" : "Demo";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={label}
          isActive={demoMode}
          className="h-11 rounded-lg font-medium focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar md:h-10"
          aria-pressed={demoMode}
          aria-label={demoMode ? "Leave the demo environment" : "Enter the demo environment"}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
            toggle();
          }}
          onKeyDown={(event) => {
            // Space and Enter both act, even when rendered as a non-button.
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              if (isMobile) setOpenMobile(false);
              toggle();
            }
          }}
        >
          {demoMode ? (
            <EyeOff aria-hidden="true" />
          ) : (
            <FlaskConical aria-hidden="true" />
          )}
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Persistent reminder that the screen is a demo and cannot change live work. */
export function ViewAsBanner() {
  const { demoMode } = useDemo();
  const { exitDemo } = useDemo();

  if (!demoMode) return null;

  return (
    <div className="border-b border-indigo-200 bg-indigo-50 text-indigo-950">
      <div className="mx-auto grid max-w-7xl gap-2 px-4 py-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <p className="min-w-0">
          <strong className="mr-1">Demo</strong>— you are working in the demo environment. Real
          homes, homeowners, guests and vendors are untouched, and nothing leaves Resolve.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 w-full shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9 sm:w-auto"
          onClick={() => exitDemo()}
          aria-label="Leave the demo environment"
        >
          Leave demo
        </Button>
      </div>
    </div>
  );
}
