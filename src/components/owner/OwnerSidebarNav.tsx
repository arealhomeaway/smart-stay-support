import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CalendarClock, Clock, FileText, Handshake, Home, KeyRound, Sparkles } from "lucide-react";
import { ownerHome } from "@/lib/owner-portal.functions";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Homeowners only ever have one page, so their sidebar navigates the page
 * itself — and, when they own more than one home, switches between homes.
 */
const sections: { hash: string; label: string; icon: typeof Home }[] = [
  { hash: "owner-homes", label: "My homes", icon: Home },
  { hash: "owner-decisions", label: "Needs your attention", icon: Bell },
  { hash: "owner-journey", label: "Where things stand", icon: CalendarClock },
  { hash: "owner-participate", label: "Ways to participate", icon: Sparkles },
  { hash: "owner-hours", label: "My logged hours", icon: Clock },
  { hash: "owner-documents", label: "Documents", icon: FileText },
  { hash: "owner-contacts", label: "My ARHA team", icon: Handshake },
];

const buttonClass =
  "h-10 rounded-lg font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm data-[active=true]:[&>svg]:text-sidebar-primary-foreground";

export function OwnerSidebarNav() {
  const load = useServerFn(ownerHome);
  const homes = useQuery({
    queryKey: ["owner-home-nav"],
    queryFn: () => load(),
    staleTime: 60_000,
  });
  const selected = useRouterState({
    select: (s) => (s.location.search as { home?: string }).home,
  });

  const properties = homes.data && homes.data.linked ? homes.data.properties : [];

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
          My home
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Overview" className={buttonClass}>
                <Link to="/owner" search={{}} data-tour="owner">
                  <KeyRound aria-hidden="true" />
                  <span>Overview</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {sections.map((section) => (
              <SidebarMenuItem key={section.hash}>
                <SidebarMenuButton asChild tooltip={section.label} className={buttonClass}>
                  <Link to="/owner" hash={section.hash}>
                    <section.icon aria-hidden="true" />
                    <span>{section.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {properties.length > 1 ? (
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
            Switch home
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={!selected}
                  tooltip="All homes"
                  className={buttonClass}
                >
                  <Link to="/owner" search={{}}>
                    <Home aria-hidden="true" />
                    <span>All homes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {properties.map((property) => (
                <SidebarMenuItem key={property.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={selected === property.propertyId}
                    tooltip={property.name}
                    className={buttonClass}
                  >
                    <Link to="/owner" search={{ home: property.propertyId }}>
                      <KeyRound aria-hidden="true" />
                      <span className="truncate">{property.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
    </>
  );
}
