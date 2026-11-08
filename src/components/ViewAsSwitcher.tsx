import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useRole } from "@/hooks/useRole";
import { setViewAs } from "@/hooks/useViewAs";
import { writeDemoFlag, writePreviewSeat } from "@/lib/demo-mode";
import { OWNER_PREVIEW_EVENT, readOwnerPreview } from "@/lib/owner-preview";
import { homePathFor } from "@/lib/route-access";
import { VIEW_AS_COPY, VIEW_AS_OPTIONS, canUseViewAs, type ViewAsOption } from "@/lib/view-as";

/** Admin menu item: choose a role to look at the app as. Changes no data. */
export function ViewAsMenuItem() {
  const { actualRoles } = useRole();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  if (!canUseViewAs(actualRoles)) return null;

  function choose(option: ViewAsOption) {
    writeDemoFlag(false);
    writePreviewSeat(option.seat);
    setViewAs(option.role);
    if (isMobile) setOpenMobile(false);
    void router.navigate({ to: homePathFor({ roles: [option.role] }) as never });
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={VIEW_AS_COPY.menu} className="h-11 rounded-lg font-medium md:h-10">
            <Eye aria-hidden="true" />
            <span>{VIEW_AS_COPY.menu}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-60">
          <DropdownMenuLabel>See the app as</DropdownMenuLabel>
          {VIEW_AS_OPTIONS.map((o) => (
            <DropdownMenuItem key={o.key} className="min-h-11" onSelect={() => choose(o)}>
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/** Shown on every page while an Admin is viewing as another role. */
export function ViewAsRoleBanner() {
  const { previewing, demoMode, identityLabel, actualRoles } = useRole();
  const [ownerPreview, setOwnerPreviewOn] = useState(false);
  useEffect(() => {
    const sync = () => setOwnerPreviewOn(readOwnerPreview() !== null);
    sync();
    window.addEventListener(OWNER_PREVIEW_EVENT, sync);
    return () => window.removeEventListener(OWNER_PREVIEW_EVENT, sync);
  }, []);

  if (!previewing || demoMode || ownerPreview || !canUseViewAs(actualRoles)) return null;

  return (
    <div role="status" className="border-b border-primary/30 bg-primary/10 text-foreground" data-testid="view-as-banner">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <p className="min-w-0">
          <strong className="mr-1">{VIEW_AS_COPY.menu}</strong>
          {VIEW_AS_COPY.banner(identityLabel)}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
          onClick={() => {
            writePreviewSeat(null);
            setViewAs(null);
          }}
        >
          {VIEW_AS_COPY.stop}
        </Button>
      </div>
    </div>
  );
}
