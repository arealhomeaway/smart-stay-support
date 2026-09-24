import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, Handshake, KeyRound, Sparkles } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Homeowner navigation: Home, Opportunities, Documents & Photos, My Team. The home chosen in
 * the page's "Viewing" filter travels with every link.
 */
const items: { view: undefined | "opportunities" | "documents" | "team"; label: string; icon: typeof KeyRound }[] = [
  { view: undefined, label: "Home", icon: KeyRound },
  { view: "opportunities", label: "Opportunities", icon: Sparkles },
  { view: "documents", label: "Documents & Photos", icon: FolderOpen },
  { view: "team", label: "My Team", icon: Handshake },
];

const buttonClass =
  "h-10 rounded-lg font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm data-[active=true]:[&>svg]:text-sidebar-primary-foreground";

export function OwnerSidebarNav() {
  const search = useRouterState({
    select: (s) => s.location.search as { home?: string; view?: string },
  });
  const onOwner = useRouterState({ select: (s) => s.location.pathname === "/owner" });

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
        My homes
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                isActive={onOwner && search.view === item.view}
                tooltip={item.label}
                className={buttonClass}
              >
                <Link
                  to="/owner"
                  search={{ ...(search.home ? { home: search.home } : {}), ...(item.view ? { view: item.view } : {}) }}
                  {...(item.view ? {} : { "data-tour": "owner" })}
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
