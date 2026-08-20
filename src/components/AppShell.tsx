import { Link, useRouter } from "@tanstack/react-router";
import {
  Building2,
  CircleHelp,
  ClipboardList,
  Home,
  ListChecks,
  LogOut,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OnboardingTour } from "@/components/OnboardingTour";
import { WelcomeDialog, useWelcomeGate } from "@/components/WelcomeDialog";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: Home, tour: "dashboard" },
  { to: "/tickets", label: "Matters", icon: ClipboardList, tour: "tickets" },
  { to: "/oversight", label: "Oversight", icon: ShieldAlert, tour: "oversight" },
  { to: "/team", label: "Seats", icon: Users, tour: "team" },
  { to: "/properties", label: "Properties", icon: Building2, tour: "properties" },
  { to: "/playbooks", label: "Playbooks", icon: ListChecks, tour: "playbooks" },
  { to: "/welcome", label: "Help", icon: CircleHelp, tour: "help" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [tourOpen, setTourOpen] = useState(false);
  const { open: welcomeOpen, dismiss: dismissWelcome } = useWelcomeGate();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
              R
            </span>
            <span className="font-display text-lg font-semibold">Resolve</span>
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {nav.map((item) => (
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTourOpen(true)}
              className="hidden text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:inline-flex"
            >
              <CircleHelp className="size-4" />
              Take the tour
            </Button>

            <Button asChild data-tour="log" size="sm" className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
              <Link to="/tickets/new">
                <Plus className="size-4" /> Log a matter
              </Link>
            </Button>
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
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <WelcomeDialog open={welcomeOpen} onDismiss={dismissWelcome} onStartTour={() => setTourOpen(true)} />

    </div>
  );
}
