import { Link, useRouter } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CircleHelp,
  ClipboardList,
  HardHat,
  Home,
  ListChecks,
  LogOut,
  Plus,
  PlugZap,

  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OnboardingTour } from "@/components/OnboardingTour";
import { BrandLogo } from "@/components/BrandLogo";
import { WelcomeDialog, useWelcomeGate } from "@/components/WelcomeDialog";
import { useRole } from "@/hooks/useRole";


type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  tour: string;
  supervisor?: boolean;
};

const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Home, tour: "dashboard" },
  { to: "/coach", label: "Ask the Coach", icon: Sparkles, tour: "coach" },
  { to: "/tickets", label: "Matters", icon: ClipboardList, tour: "tickets" },
  { to: "/oversight", label: "Oversight", icon: ShieldAlert, tour: "oversight", supervisor: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, tour: "analytics", supervisor: true },
  { to: "/team", label: "Seats", icon: Users, tour: "team", supervisor: true },
  { to: "/properties", label: "Properties", icon: Building2, tour: "properties", supervisor: true },
  { to: "/playbooks", label: "Playbooks", icon: ListChecks, tour: "playbooks" },
  { to: "/integrations", label: "Integrations", icon: PlugZap, tour: "integrations", supervisor: true },
  { to: "/welcome", label: "Help", icon: CircleHelp, tour: "help" },

];

const vendorNav: NavItem[] = [
  { to: "/vendor", label: "My jobs", icon: HardHat, tour: "vendor" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [tourOpen, setTourOpen] = useState(false);
  const { open: welcomeOpen, dismiss: dismissWelcome } = useWelcomeGate();
  const { isSupervisor, isVendor, isLoading: rolesLoading } = useRole();
  const pathname = router.state.location.pathname;
  const vendorMode = !rolesLoading && isVendor;
  const visibleNav = vendorMode ? vendorNav : nav.filter((item) => !item.supervisor || isSupervisor);

  // Vendors are outside partners: keep them on their own surface.
  useEffect(() => {
    if (vendorMode && !pathname.startsWith("/vendor")) {
      void router.navigate({ to: "/vendor", replace: true });
    }
  }, [vendorMode, pathname, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link to={vendorMode ? "/vendor" : "/dashboard"} className="flex items-center gap-3">
            <BrandLogo className="h-9" />
            <span className="h-8 w-px bg-sidebar-foreground/25" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-semibold">Resolve</span>
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                {vendorMode ? "Vendor portal" : "Operations"}
              </span>
            </span>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {visibleNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                data-tour={item.tour}
                className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&.active]:bg-sidebar-accent [&.active]:text-sidebar-accent-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!vendorMode && <Button
              size="sm"
              variant="ghost"
              onClick={() => setTourOpen(true)}
              className="hidden text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:inline-flex"
            >
              <CircleHelp className="size-4" />
              Take the tour
            </Button>}

            {!vendorMode && (
              <Button asChild data-tour="log" size="sm" className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
                <Link to="/tickets/new">
                  <Plus className="size-4" /> Log a matter
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-8">{children}</main>
      <footer className="mt-12 border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10" />
            <p className="max-w-xs text-xs leading-relaxed text-sidebar-foreground/60">
              Resolve is the internal operations system of A Real Home Away.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-sidebar-foreground/50">
            Every home. Every guest. Every time.
          </p>
        </div>
      </footer>

      {!vendorMode && (
        <>
          <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
          <WelcomeDialog open={welcomeOpen} onDismiss={dismissWelcome} onStartTour={() => setTourOpen(true)} />
        </>
      )}

    </div>
  );
}
