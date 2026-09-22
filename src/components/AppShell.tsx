import { Link, useParams, useRouter, useSearch } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  HardHat,
  Handshake,
  History,
  Home,
  KeyRound,
  ListChecks,
  MapPinned,
  LogOut,
  PackageCheck,
  Plus,
  PlugZap,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
  HeartHandshake,
  Wrench,
  ReceiptText,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OnboardingTour } from "@/components/OnboardingTour";
import { BrandLogo } from "@/components/BrandLogo";
import { GlobalSearch, type SearchTarget } from "@/components/GlobalSearch";
import { RouteProgress } from "@/components/nav/RouteProgress";
import { useAmbientOrigin } from "@/components/nav/NavContext";
import { readOrigin } from "@/lib/nav-context";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DemoButton,
  DemoSidebarItem,
  PortalSwitcher,
  ViewAsBanner,
} from "@/components/PortalSwitcher";
import { AccountSidebarItem } from "@/components/AccountSidebarItem";
import { WelcomeDialog, useWelcomeGate } from "@/components/WelcomeDialog";
import { useRole } from "@/hooks/useRole";
import { useSeat } from "@/hooks/useSeat";
import { useFeatureFlags } from "@/lib/feature-flags";
import { type Capability } from "@/lib/permissions";
import { parseOperationsSearch } from "@/lib/operations-view-state";

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

// One list, grouped the way the business is run: the work itself, the
// operation that staffs it, the programmes we run for owners, then the
// administrative surfaces. Visibility is still driven by capability — never by
// a hand-maintained copy of the menu.

// Frontline navigation follows the working day, not the data model: what needs
// me, my work, the properties I look after, and how to report something.
// Everything supervisory or administrative is a separate, capability-gated
// group so a coordinator never navigates the app's architecture.
const frontlineGroup: NavGroup = {
  label: "My day",
  items: [
    { to: "/dashboard", label: "Home", icon: Home, tour: "dashboard" },
    { to: "/tickets", label: "My work", icon: ClipboardList, tour: "tickets" },
    // Coverage overlaps all day and the next available person still has to
    // handle the work, so the shared queue is open to every coordinator.
    { to: "/team-queue", label: "Team Queue", icon: Users, tour: "team-queue" },
    { to: "/map", label: "Work Map", icon: MapPinned, tour: "map", capability: "work_orders_internal" },
    { to: "/availability-finder", label: "Availability Finder", icon: MapPinned, tour: "availability-finder", capability: "work_orders_internal" },
    { to: "/inquiry-sources", label: "Inquiry Sources", icon: MapPinned, tour: "inquiry-sources", capability: "work_orders_internal" },
    {
      to: "/work-orders",
      label: "Work orders",
      icon: Wrench,
      tour: "work-orders",
      capability: "work_orders_internal",
    },
    {
      to: "/routines",
      label: "Routine work",
      icon: ClipboardCheck,
      tour: "routines",
      capability: "routines",
    },
    // Frontline/team workflows — PCs and operations staff perform this work
    // directly. Supervisors may oversee it, but it is not supervisor-owned,
    // so it lives here rather than under Supervision. Gated on claims_work,
    // matching what /claims and /recovery already require to open — the nav
    // item used to require the stricter claims_oversight, which hid it from
    // tech/onboarding roles that could already reach the page by URL.
    {
      to: "/claims",
      label: "Claims",
      icon: ReceiptText,
      tour: "claims",
      capability: "claims_work",
    },
    {
      to: "/recovery",
      label: "Guest refunds & credits",
      icon: HeartHandshake,
      tour: "recovery",
      capability: "claims_work",
    },

    {
      to: "/properties",
      label: "Properties",
      icon: Building2,
      tour: "properties",
      capability: "properties",
    },
    {
      to: "/tickets/new",
      label: "Report an issue",
      icon: Plus,
      tour: "report",
      capability: "ticket_create",
    },
  ],
};

const navGroups: NavGroup[] = [
  frontlineGroup,
  {
    label: "Guest & reservations",
    items: [
      { to: "/leads", label: "Leads", icon: UserPlus, tour: "leads", capability: "leads_work" },
    ],
  },
  {
    label: "Supervision",
    items: [
      {
        to: "/oversight",
        label: "Oversight",
        icon: ShieldAlert,
        tour: "oversight",
        capability: "oversight",
      },
      {
        to: "/onboarding",
        label: "Onboarding",
        icon: PackageCheck,
        tour: "onboarding",
        capability: "onboarding_workspace",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        to: "/team",
        label: "Team & coverage",
        icon: Users,
        tour: "team",
        capability: "user_management",
      },
      {
        to: "/playbooks",
        label: "Playbooks",
        icon: ListChecks,
        tour: "playbooks",
        capability: "playbooks_edit",
      },
      {
        to: "/coach",
        label: "Ask the Coach",
        icon: Sparkles,
        tour: "coach",
        capability: "coaching",
      },
    ],
  },
  {
    label: "Programs",
    items: [
      {
        to: "/owner-programs",
        label: "Active Owner",
        icon: KeyRound,
        tour: "owner-programs",
        capability: "owner_programs",
      },
      {
        to: "/owner-oversight",
        label: "Program oversight",
        icon: KeyRound,
        tour: "owner-oversight",
        capability: "owner_oversight",
      },
      {
        to: "/homeowners",
        label: "Homeowners",
        icon: Users,
        tour: "homeowners",
        capability: "homeowner_directory",
      },
      {
        to: "/vendors",
        label: "Vendor Hub",
        icon: Handshake,
        tour: "vendors",
        capability: "vendor_admin",
        flag: "vendor_portal",
      },
      {
        to: "/quarterly",
        label: "Quarterly reviews",
        icon: CalendarCheck,
        tour: "quarterly",
        capability: "vendor_admin",
        flag: "quarterly_reviews",
      },
    ],
  },
  {
    label: "Insight",
    items: [
      {
        to: "/command-center",
        label: "Executive view",
        icon: Gauge,
        tour: "command-center",
        capability: "command_center",
      },
      {
        to: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        tour: "analytics",
        capability: "analytics",
      },
      {
        to: "/owner-analytics",
        label: "Owner participation",
        icon: KeyRound,
        tour: "owner-analytics",
        capability: "owner_programs",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        to: "/integrations",
        label: "Integrations",
        icon: PlugZap,
        tour: "integrations",
        capability: "integrations",
      },
      {
        to: "/audit",
        label: "Audit history",
        icon: History,
        tour: "audit",
        capability: "audit_history",
      },
    ],
  },
  {
    label: "Support",
    items: [{ to: "/welcome", label: "Help", icon: CircleHelp, tour: "help" }],
  },
];

const vendorGroups: NavGroup[] = [
  {
    label: "My company",
    items: [{ to: "/vendor", label: "My work orders", icon: HardHat, tour: "vendor" }],
  },
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
  const {
    can,
    isVendor,
    isOwner,
    isSupervisor,
    readOnly,
    identityLabel,
    isLoading: rolesLoading,
  } = useRole();
  // Guest Experience & Reservations seats work leads; Property Operations
  // seats do not. Seat, not permission role, decides this.
  const seat = useSeat();
  const pathname = router.state.location.pathname;
  const vendorMode = !rolesLoading && isVendor;
  const ownerMode = !rolesLoading && isOwner;

  // A record opened from another workspace (e.g. a ticket reached from Work
  // orders) still lives under /tickets/*, but the sidebar should highlight
  // where the employee is actually working, not the URL's own segment.
  const recordSearch = useSearch({ strict: false }) as { from?: string; view?: string };
  const originSnapshot = readOrigin(recordSearch?.from);
  const activePathname = originSnapshot
    ? (originSnapshot.href.split("?")[0] ?? originSnapshot.href)
    : pathname === "/team-queue" && recordSearch.view === "map" ? "/map" : pathname;
  const mapSearch = pathname === "/team-queue"
    ? { ...parseOperationsSearch(recordSearch), view: "map" }
    : { view: "map" };

  // The global "Log a ticket" action: capability-gated, hidden where the page
  // already owns that action, demoted where the page has its own primary, and
  // carrying whatever property context the current route already knows about.
  const routeParams = useParams({ strict: false }) as { propertyId?: string };
  const onProperty = pathname.startsWith("/property/");
  const onOnboardingProperty =
    /^\/onboarding\/[^/]+$/.test(pathname) && !pathname.startsWith("/onboarding/my-work");
  const contextPropertyId = routeParams?.propertyId;
  // Whatever page they are on is a named place to come back to, so a detour
  // into Log work never strands anyone.
  const hereLabel =
    navGroups
      .flatMap((g) => g.items)
      .find((i) => i.to !== "/dashboard" && pathname.startsWith(i.to))?.label ??
    (pathname.startsWith("/tickets/") ? "the ticket" : "Home");
  const originHere = useAmbientOrigin(hereLabel);
  const ticketContext: { property?: string; from?: string; origin?: string } =
    contextPropertyId && (onProperty || onOnboardingProperty)
      ? {
          property: contextPropertyId,
          from: onProperty ? "property_hub" : "onboarding",
          origin: originHere,
        }
      : { origin: originHere };
  const showLogTicket =
    !vendorMode &&
    !ownerMode &&
    !readOnly &&
    can("ticket_create") &&
    !pathname.startsWith("/tickets");
  const quietLogTicket = [
    "/leads",
    "/onboarding",
    "/command-center",
    "/analytics",
    "/ops-analytics",
    "/owner-analytics",
    "/audit",
    "/oversight",
    "/map",
    "/playbooks",
  ].some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const groups: NavGroup[] = vendorMode
    ? vendorGroups
    : ownerMode
      ? ownerGroups
      : navGroups
          .map((g) => ({
            ...g,
            items: g.items.filter(
              (i) =>
                (!i.capability ||
                  can(i.capability) ||
                  (i.capability === "leads_work" && seat.isGuestExperience)) &&
                (!i.supervisorOnly || isSupervisor) &&
                (!i.flag || flagEnabled(i.flag)),
            ),
          }))
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

  // Orientation surfaces: where people arrive, get their bearings and choose.
  const orientationSurface = ["/dashboard", "/welcome", "/owner", "/vendor", "/hub"].some(
    (p) => pathname === p,
  );

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
              <SidebarGroupLabel className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active =
                      activePathname === item.to || activePathname.startsWith(`${item.to}/`);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className="h-10 rounded-lg font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm data-[active=true]:[&>svg]:text-sidebar-primary-foreground"
                        >
                          <Link
                            to={item.to}
                            // Logging work is a detour: carry the page they left.
                            search={
                              (item.to === "/tickets/new"
                                ? { ...ticketContext }
                                : item.to === "/map"
                                  ? mapSearch
                                : undefined) as never
                            }
                            data-tour={item.tour}
                            aria-current={active ? "page" : undefined}
                          >
                            <item.icon aria-hidden="true" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <DemoSidebarItem />
          <AccountSidebarItem />
          <p className="px-2 pb-1 text-[0.65rem] leading-relaxed text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Every home. Every guest. Every time.
          </p>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <RouteProgress />
        <TooltipProvider delayDuration={200}>
          <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 md:px-6">
              <SidebarTrigger className="min-h-11 min-w-11 md:min-h-9 md:min-w-9" />
              <span className="hidden text-sm font-medium sm:inline">{workspace}</span>

              <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
                <GlobalSearch targets={searchTargets} />
                {showLogTicket && (
                  <Button
                    asChild
                    data-tour="log"
                    size="sm"
                    variant={quietLogTicket ? "outline" : "default"}
                    className="min-h-11 md:min-h-9"
                  >
                    <Link to="/tickets/new" search={ticketContext}>
                      <Plus className="size-4" aria-hidden="true" /> Report an issue
                    </Link>
                  </Button>
                )}
                {!vendorMode && !ownerMode && can("oversight") && (
                  <IconAction to="/oversight" label="Alerts and escalations">
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  </IconAction>
                )}
                <IconAction
                  to={vendorMode || ownerMode ? home : "/welcome"}
                  label="Help and guidance"
                >
                  <CircleHelp className="size-4" aria-hidden="true" />
                </IconAction>
                {!vendorMode && !ownerMode && <NotificationBell placement="header" />}
                <ThemeToggle />
                <DemoButton />
                <PortalSwitcher />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={signOut}
                      aria-label={`Sign out (${identityLabel})`}
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sign out — {identityLabel}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <ViewAsBanner />
          </header>
        </TooltipProvider>

        {/*
          Warm for orientation, bright for execution. Overview and portal Homes
          keep the hospitality warmth; every working surface sits on the bright
          near-white canvas so the work itself is the brightest thing on screen.
        */}
        <main
          className={`min-h-[70vh] px-4 py-6 md:px-8 md:py-8 ${
            orientationSurface ? "warm-canvas" : "work-canvas"
          }`}
        >
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>

        {/*
          General "Welcome to Resolve" popup and guided tour are hidden until
          portal- and role-specific tours replace them. Flip SHOW_GENERAL_TOUR
          back to true to restore the existing implementation unchanged.
        */}
        {SHOW_GENERAL_TOUR && !vendorMode && !ownerMode && (
          <>
            <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
            <WelcomeDialog
              open={welcomeOpen}
              onDismiss={dismissWelcome}
              onStartTour={() => setTourOpen(true)}
            />
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
