import { Link, useRouter } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  CircleHelp,
  ClipboardList,
  Gauge,
  HardHat,
  Handshake,
  History,
  Home,
  KeyRound,
  LayoutGrid,
  ListChecks,
  MapPinned,
  LogOut,
  PackageCheck,
  Plus,
  PlugZap,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OnboardingTour } from "@/components/OnboardingTour";
import { BrandLogo } from "@/components/BrandLogo";
import { GlobalSearch, type SearchTarget } from "@/components/GlobalSearch";
import { PortalSwitcher, ViewAsBanner } from "@/components/PortalSwitcher";
import { WelcomeDialog, useWelcomeGate } from "@/components/WelcomeDialog";
import { useRole } from "@/hooks/useRole";
import { useFeatureFlags } from "@/lib/feature-flags";
import { ROLE_LABELS, type Capability } from "@/lib/permissions";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  tour: string;
  /** Omit for items every internal person may open. */
  capability?: Capability;
  /** The page itself is supervisor-gated — never show a dead-end link. */
  supervisorOnly?: boolean;
  /** Launch-state gate: hidden while the workstream is not part of the beta. */
  flag?: string;
};

type NavGroup = { label: string; items: NavItem[] };

// One list, grouped for scanning. Visibility is still driven by capability —
// never by hand-maintained copies of the menu.
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/command-center", label: "Executive Administration", icon: Gauge, tour: "command-center", capability: "command_center" },
      { to: "/dashboard", label: "Home", icon: Home, tour: "dashboard" },
      { to: "/hub", label: "All my portals", icon: LayoutGrid, tour: "hub" },
    ],
  },
  {
    label: "Work",
    items: [
      { to: "/tickets", label: "Work queue", icon: ClipboardList, tour: "tickets" },
      { to: "/map", label: "Work map", icon: MapPinned, tour: "map", capability: "matters_all" },
      { to: "/coach", label: "Ask the Coach", icon: Sparkles, tour: "coach", capability: "coaching" },
      { to: "/playbooks", label: "Playbooks", icon: ListChecks, tour: "playbooks" },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { to: "/properties", label: "Properties", icon: Building2, tour: "properties", capability: "properties", supervisorOnly: true },
      { to: "/vendors", label: "Vendor Hub", icon: Handshake, tour: "vendors", capability: "vendor_admin", flag: "vendor_portal" },
      // Quarterly property reviews are vendor management work — cleaning
      // supervisors run them — so they sit with the Vendor Hub, not the
      // operations queue. The records and the paused scheduler are unchanged.
      { to: "/quarterly", label: "Quarterly reviews", icon: CalendarCheck, tour: "quarterly", capability: "vendor_admin", flag: "quarterly_reviews" },
      { to: "/owner-programs", label: "Property owners", icon: KeyRound, tour: "owner-programs", capability: "owner_programs" },
      { to: "/onboarding", label: "Onboarding", icon: PackageCheck, tour: "onboarding", capability: "onboarding_workspace" },
    ],
  },
  {
    label: "Insight",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3, tour: "analytics", capability: "analytics" },
      { to: "/oversight", label: "Oversight", icon: ShieldAlert, tour: "oversight", capability: "oversight" },
      { to: "/owner-analytics", label: "Owner participation", icon: KeyRound, tour: "owner-analytics", capability: "owner_programs" },
      { to: "/ops-analytics", label: "Operations performance", icon: BarChart3, tour: "ops-analytics", capability: "analytics" },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/team", label: "Seats & access", icon: Users, tour: "team", capability: "user_management" },
      { to: "/integrations", label: "Integrations", icon: PlugZap, tour: "integrations", capability: "integrations" },
      { to: "/audit", label: "Audit history", icon: History, tour: "audit", capability: "audit_history" },
      { to: "/welcome", label: "Help", icon: CircleHelp, tour: "help" },
    ],
  },
];

const vendorGroups: NavGroup[] = [
  { label: "My company", items: [{ to: "/vendor", label: "My work orders", icon: HardHat, tour: "vendor" }] },
];
const ownerGroups: NavGroup[] = [
  { label: "My home", items: [{ to: "/owner", label: "My home", icon: KeyRound, tour: "owner" }] },
];

/** Unfinished general tour/welcome popup — hidden until role-specific tours land. */
const SHOW_GENERAL_TOUR = false;

export function AppShell({ children }: { children: ReactNode }) {

  const router = useRouter();
  const [tourOpen, setTourOpen] = useState(false);
  const { open: welcomeOpen, dismiss: dismissWelcome } = useWelcomeGate();
  const { enabled: flagEnabled } = useFeatureFlags();
  const { can, isVendor, isOwner, isSupervisor, readOnly, primary, isLoading: rolesLoading } = useRole();
  const pathname = router.state.location.pathname;
  const vendorMode = !rolesLoading && isVendor;
  const ownerMode = !rolesLoading && isOwner;

  const groups: NavGroup[] = vendorMode
    ? vendorGroups
    : ownerMode
      ? ownerGroups
      : navGroups
          .map((g) => ({ ...g, items: g.items.filter(
            (i) =>
              (!i.capability || can(i.capability)) &&
              (!i.supervisorOnly || isSupervisor) &&
              (!i.flag || flagEnabled(i.flag)),
          ) }))
          .filter((g) => g.items.length > 0);

  const workspace = vendorMode
    ? "Vendor Portal"
    : ownerMode
      ? "Property Owner Portal"
      : can("command_center")
        ? "Executive Administration"
        : "Operations";

  const searchTargets: SearchTarget[] = groups.flatMap((g) =>
    g.items.map((i) => ({ to: i.to, label: i.label, group: g.label })),
  );

  // Vendors and homeowners are outside partners: keep them on their own surface.
  useEffect(() => {
    if (vendorMode && !pathname.startsWith("/vendor")) {
      void router.navigate({ to: "/vendor", replace: true });
    } else if (ownerMode && !pathname.startsWith("/owner")) {
      void router.navigate({ to: "/owner", replace: true });
    }
  }, [vendorMode, ownerMode, pathname, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  const home = vendorMode ? "/vendor" : ownerMode ? "/owner" : "/dashboard";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link to={home} className="flex items-center gap-3 px-2 py-1.5">
            <BrandLogo className="h-9 shrink-0" />
            <span className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
              <span className="font-display text-base font-semibold">Resolve</span>
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                {workspace}
              </span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.to || pathname.startsWith(`${item.to}/`)}
                        tooltip={item.label}
                      >
                        <Link to={item.to} data-tour={item.tour}>
                          <item.icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <p className="px-2 pb-1 text-[0.65rem] leading-relaxed text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Every home. Every guest. Every time.
          </p>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <TooltipProvider delayDuration={200}>
          <header className="sticky top-0 z-30 border-b bg-background">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <SidebarTrigger className="min-h-11 min-w-11 md:min-h-9 md:min-w-9" />
              <span className="hidden text-sm font-medium sm:inline">{workspace}</span>
              <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
                <GlobalSearch targets={searchTargets} />
                {!vendorMode && !ownerMode && !readOnly && (
                  <Button asChild data-tour="log" size="sm" className="min-h-11 md:min-h-9">
                    <Link to="/tickets/new">
                      <Plus className="size-4" aria-hidden="true" /> Log a ticket
                    </Link>
                  </Button>
                )}
                {!vendorMode && !ownerMode && can("oversight") && (
                  <IconAction to="/oversight" label="Alerts and escalations">
                    <Bell className="size-4" aria-hidden="true" />
                  </IconAction>
                )}
                <IconAction to={vendorMode || ownerMode ? home : "/welcome"} label="Help and guidance">
                  <CircleHelp className="size-4" aria-hidden="true" />
                </IconAction>
                <PortalSwitcher />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={signOut}
                      aria-label={`Sign out (${ROLE_LABELS[primary]})`}
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sign out — {ROLE_LABELS[primary]}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <ViewAsBanner />
          </header>
        </TooltipProvider>

        <main className="min-h-[70vh] px-4 py-8 md:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        {/*
          General "Welcome to Resolve" popup and guided tour are hidden until
          portal- and role-specific tours replace them. Flip SHOW_GENERAL_TOUR
          back to true to restore the existing implementation unchanged.
        */}
        {SHOW_GENERAL_TOUR && !vendorMode && !ownerMode && (
          <>
            <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
            <WelcomeDialog open={welcomeOpen} onDismiss={dismissWelcome} onStartTour={() => setTourOpen(true)} />
          </>
        )}

      </SidebarInset>
    </SidebarProvider>
  );
}

function IconAction({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
        >
          <Link to={to} aria-label={label}>
            {children}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
