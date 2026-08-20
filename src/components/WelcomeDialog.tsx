import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PlayCircle, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORAGE_KEY } from "@/components/OnboardingTour";

export function useWelcomeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  function dismiss() {
    setOpen(false);
  }

  return { open, dismiss, setOpen };
}

function markWalkthroughUsed() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function WelcomeDialog({
  open,
  onDismiss,
  onStartTour,
}: {
  open: boolean;
  onDismiss: () => void;
  onStartTour: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss welcome"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New here?</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Welcome to Resolve</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Resolve turns a guest message into one tracked matter with an owner, a response clock and a playbook that has
          to be finished before anything can be closed. Take two minutes and see how it works.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            asChild
            onClick={() => {
              markWalkthroughUsed();
              onDismiss();
            }}
            className="h-auto justify-start gap-3 py-3 text-left"
          >
            <Link to="/welcome">
              <PlayCircle className="size-5 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">Watch the walkthrough</span>
                <span className="block text-xs opacity-80">47-second video tour</span>
              </span>
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 py-3 text-left"
            onClick={() => {
              onDismiss();
              onStartTour();
            }}
          >
            <Compass className="size-5 shrink-0" />
            <span>
              <span className="block text-sm font-semibold">Take the guided tour</span>
              <span className="block text-xs text-muted-foreground">Walks you through the app</span>
            </span>
          </Button>
        </div>
        <button onClick={onDismiss} className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline">
          Skip for now — I'll find it under Help
        </button>
      </div>
    </div>
  );
}
