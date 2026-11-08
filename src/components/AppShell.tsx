import { useStoredMaintenancePolicy } from "@/hooks/useStoredMaintenancePolicy";
import { TicketDrawerHost } from "@/components/nav/TicketDrawer";
import { RecordRoutineHost, openRecordRoutine } from "@/components/routines/RecordRoutinePanel";
import { Link, useParams, useRouter, useSearch } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CircleHelp,
  ClipboardList,
  Gauge,
  HardHat,
  History,
  Home,
  KeyRound,
  ListChecks,
  LogOut,
  PackageCheck,
  Plus,
  PlugZap,
  ShieldAlert,
  UserPlus,
  Users,
  Wrench,
  ReceiptText,
  Workflow,
  Timer,
  ClipboardCheck,
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
import { HelpFeedbackButton } from "@/components/HelpFeedback";
import { BrandLogo } from "@/components/BrandLogo";
import { GlobalSearch, type SearchTarget } from "@/components/GlobalSearch";
import { RouteProgress } from "@/components/nav/RouteProgress";
import { useAmbientOrigin } from "@/components/nav/NavContext";
import { ShellNav, ShellNavProvider } from "@/components/nav/ShellNav";
import { GroupTabs } from "@/components/nav/GroupTabs";
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
import { OwnerNotificationBell } from "@/components/owner/OwnerNotificationBell";
import { ActAsBanner } from "@/components/ActAsBanner";
import { clearActAs } from "@/lib/act-as";
import { OwnerSidebarNav } from "@/components/owner/OwnerSidebarNav";
import { useRole } from "@/hooks/useRole";
import { useSeat } from "@/hooks/useSeat";
import { useFeatureFlags } from "@/lib/feature-flags";
import { parseOperationsSearch } from "@/lib/operations-view-state";
import {
  departmentFor,
  onboardingOnlyMenu,
  operationsMenu,
  type MenuGroup,
} from "@/lib/shell-nav";

const ONBOARDING_ICONS: Record<string, typeof Home> = {
  "Onboarding Home": Home,
  Properties: Building2,
  "My Tasks": ClipboardList,
  Team: Users,
  "Workflow Templates": Workflow,
};

/** Menu icons by item key (lib/shell-nav.ts), then by destination. */
const ITEM_ICONS: Record<string, typeof Home> = {
  dashboard: Home,
  "team-queue": Users,
  "bookings-leads": UserPlus,
  vendors: HardHat,
  "work-orders": Wrench,
  oversight: ShieldAlert,
  claims: ReceiptText,
  team: Users,
  playbooks: ListChecks,
  properties: Building2,
  onboarding: PackageCheck,
  "owner-programs": KeyRound,
  quarterly: CalendarCheck,
};
const ROUTE_ICONS: Record<string, typeof Home> = {
  "/analytics": BarChart3,
  "/owner-analytics": KeyRound,
  "/cleaner-hours": Timer,
  "/finance": ReceiptText,
  "/command-center": Gauge,
  "/integrations": PlugZap,
  "/audit": History,
  "/help-tickets": CircleHelp,
};

type NavItem = {
  to: string;
  search?: Record<string, string>;
  label: string;
  icon: typeof Home;
  tour: string;
  /** Other pages that also highlight this item (grouped tab pages). */
  alsoActive?: string[];
};

type NavGroup = { label: string; items: NavItem[] };

// The Operations menu follows the working day: My day, Team, Homes and
// owners, Insight, Admin. Which items exist, their order and who sees them
// live in operationsMenu / onboardingOnlyMenu (lib/shell-nav.ts), the tested
// rule; this file only adds icons. Grouped destinations (Routine Work,
// Refunds & Credits, Supervisor check...) are top-of-page tabs, see
// PAGE_TAB_GROUPS.
const withIcons = (groups: MenuGroup[]): NavGroup[] =>
  groups.map((g) => ({
    label: g.label,
    items: g.items.map((i) => ({
      to: i.to,
      ...(i.search ? { search: i.search } : {}),
      label: i.label,
      icon:
        ITEM_ICONS[i.key] ??
        ROUTE_ICONS[i.to] ??
        (i.key.startsWith("onboarding-") ? ONBOARDING_ICONS[i.label] : undefined) ??
        PackageCheck,
      tour: i.key,
      ...(i.alsoActive ? { alsoActive: i.alsoActive } : {}),
    })),
  }));

const vendorGroups: NavGroup[] = [
  {
    label: "My company",
    items: [{ to: "/vendor", label: "My Work Orders", icon: HardHat, tour: "vendor" }],
  },
];
// Homeowner navigation is data-driven (their homes) and page-section based, so
// it is rendered by OwnerSidebarNav instead of a static group list.
const ownerGroups: NavGroup[] = [];

/** Unfinished general tour/welcome popup — hidden until role-specific tours land. */
const SHOW_GENERAL_TOUR = false;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  useStoredMaintenancePolicy();
  const [tourOpen, setTourOpen] = useState(false);
  const { open: welcomeOpen, dismiss: dismissWelcome } = useWelcomeGate();
  const { enabled: flagEnabled } = useFeatureFlags();
  const {
    can,
    isVendor,
    isOwner,
    readOnly,
    identityLabel,
    isLoading: rolesLoading,
    canOpen,
    onboardingOnly,
    landing,
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
  const recordSearch = useSearch({ strict: false }) as { from?: string; view?: string } & Record<
    string,
    unknown
  >;
  const originSnapshot = readOrigin(recordSearch?.from);
  const activePathname = originSnapshot
    ? (originSnapshot.href.split("?")[0] ?? originSnapshot.href)
    : pathname === "/team-queue" && recordSearch.view === "map"
      ? "/map"
      : pathname;
  const mapSearch =
    pathname === "/team-queue"
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
  // Navigation is generated from route authorization: a link only appears when
  // the same rule that guards the page lets this person open it.
  const navAccess = {
    can,
    canOpen,
    guestExperienceSeat: seat.isGuestExperience,
    flagEnabled: (key: string) => flagEnabled(key),
  };
  const groups: NavGroup[] = vendorMode
    ? vendorGroups
    : ownerMode
      ? ownerGroups
      : withIcons(onboardingOnly ? onboardingOnlyMenu(navAccess) : operationsMenu(navAccess));

  // Whatever page they are on is a named place to come back to, so a detour
  // into Log work never strands anyone.
  const hereLabel =
    groups
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
  // Reporting a property issue is an Operations workflow. Problems with
  // Resolve itself go through the global ? Help & Feedback control, so this
  // never appears outside Operations surfaces (Onboarding, Active Owner admin).
  const operationsSurface =
    !departmentFor(pathname) && canOpen(pathname) && canOpen("/tickets/new");
  const showLogTicket =
    !vendorMode &&
    !ownerMode &&
    !readOnly &&
    operationsSurface &&
    can("ticket_create") &&
    pathname !== "/tickets/new";
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
    "/ticket-checklists",
  ].some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const workspace = vendorMode
    ? "Vendor Portal"
    : ownerMode
      ? "Property Owner Portal"
      : onboardingOnly || pathname === "/onboarding" || pathname.startsWith("/onboarding/")
        ? "Onboarding"
        : can("command_center")
          ? "Executive Administration"
          : "Operations";

  const searchTargets: SearchTarget[] = groups.flatMap((g) =>
    g.items.map((i) => ({ to: i.to, label: i.label, group: g.label })),
  );

  // Vendors and homeowners are outside partners: keep them on their own
  // surface. Their own account settings belong to them, so that page is
  // always reachable.
  const personalPage = pathname.startsWith("/account");
  useEffect(() => {
    if (personalPage) return;
    if (vendorMode && !pathname.startsWith("/vendor")) {
      void router.navigate({ to: "/vendor", replace: true });
    } else if (ownerMode && !pathname.startsWith("/owner")) {
      void router.navigate({ to: "/owner", replace: true });
    }
  }, [vendorMode, ownerMode, pathname, personalPage, router]);

  async function signOut() {
    // A test session must never outlive the sign-out that ended it.
    clearActAs();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  const home = vendorMode ? "/vendor" : ownerMode ? "/owner" : landing;

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
          {ownerMode ? <OwnerSidebarNav /> : null}
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = item.search
                      ? activePathname === item.to &&
                        Object.entries(item.search).every(([k, v]) => recordSearch[k] === v)
                      : onboardingOnly && item.to === "/onboarding"
                        ? activePathname === item.to && !("lens" in recordSearch)
                        : (item.alsoActive ?? []).some(
                              (p) => activePathname === p || activePathname.startsWith(`${p}/`),
                            ) ||
                          activePathname === item.to ||
                          (!(onboardingOnly && item.to === "/onboarding") &&
                            activePathname.startsWith(`${item.to}/`));
                    return (
                      <SidebarMenuItem key={`${item.to}-${item.label}`}>
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
                                  : item.search) as never
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
                {pathname === "/dashboard" && !vendorMode && !ownerMode && can("routines") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 md:min-h-9"
                    onClick={() => openRecordRoutine()}
                  >
                    <ClipboardCheck className="size-4" aria-hidden="true" /> Record routine work
                  </Button>
                )}
                {showLogTicket && (
                  <Button
                    asChild
                    data-tour="log"
                    size="sm"
                    variant={quietLogTicket ? "outline" : "default"}
                    className="min-h-11 md:min-h-9"
                  >
                    <Link to="/tickets/new" search={ticketContext}>
                      <Plus className="size-4" aria-hidden="true" /> Record work
                    </Link>
                  </Button>
                )}
                {!vendorMode && !ownerMode && can("oversight") && (
                  <IconAction to="/oversight" label="Alerts and escalations">
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  </IconAction>
                )}
                {ownerMode ? (
                  <OwnerNotificationBell />
                ) : vendorMode ? null : (
                  <NotificationBell placement="header" />
                )}
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
            <ActAsBanner />
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
          <div className="mx-auto w-full max-w-[1400px]">
            <ShellNavProvider>
              {(pageLabel) => (
                <>
                  {!ownerMode && !vendorMode && <GroupTabs />}
                  {!ownerMode && !vendorMode && (
                    <ShellNav pageLabel={pageLabel} hideDepartmentMenu={
                      (onboardingOnly && departmentFor(pathname)?.key !== "active-owner") ||
                      // Vendors already shows the same views as its own page tabs.
                      departmentFor(pathname)?.key === "vendors"
                    } />
                  )}
                  <TicketDrawerHost>
                    {children}
                    {!ownerMode && !vendorMode && can("routines") && <RecordRoutineHost />}
                  </TicketDrawerHost>
                </>
              )}
            </ShellNavProvider>
          </div>
        </main>

        {/* Global Help & Feedback — every page inherits it from the shell. */}
        <HelpFeedbackButton />

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
