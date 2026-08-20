import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type TourStep = {
  target: string | null;
  route?: string;
  title: string;
  body: string;
};

const STORAGE_KEY = "resolve.tour.completed.v1";

const steps: TourStep[] = [
  {
    target: null,
    route: "/dashboard",
    title: "Welcome to Resolve",
    body: "A 60-second tour of how a guest issue becomes a tracked matter — with the safety checks built in so nothing gets removed and left as a hole in the wall.",
  },
  {
    target: '[data-tour="dashboard"]',
    route: "/dashboard",
    title: "Dashboard",
    body: "Your shift starts here: what is open, what is breaching its response clock, and what is waiting on a handoff acceptance.",
  },
  {
    target: '[data-tour="log"]',
    route: "/dashboard",
    title: "Log a matter",
    body: "Every guest message or property issue becomes one matter. Pick the property and Resolve pulls live occupancy from OwnerRez, which sets the priority floor automatically.",
  },
  {
    target: '[data-tour="tickets"]',
    route: "/tickets",
    title: "Matters",
    body: "The working queue. Priority (P1–P3) and the response clock decide what you touch next — the property decides which pod owns it.",
  },
  {
    target: '[data-tour="playbooks"]',
    route: "/playbooks",
    title: "Playbooks",
    body: "This is where the water-heater incident gets prevented. Each work type carries required steps — check every smoke and CO alarm, replace any device removed on the same visit — and the matter cannot close until they are done.",
  },
  {
    target: '[data-tour="oversight"]',
    route: "/oversight",
    title: "Oversight",
    body: "Supervisor view of breached clocks, unaccepted handoffs and closures missing evidence. A handoff is not complete until the receiver accepts it.",
  },
  {
    target: '[data-tour="team"]',
    route: "/team",
    title: "Seats & coverage",
    body: "Work routes to permanent seats, not people. Set who holds each seat and who covers lunch, and routing keeps working when someone steps away.",
  },
  {
    target: '[data-tour="properties"]',
    route: "/properties",
    title: "Properties",
    body: "Import homes straight from OwnerRez, link them to Breezeway, and keep access notes and Wi-Fi where the coordinator actually needs them.",
  },
  {
    target: '[data-tour="help"]',
    route: "/dashboard",
    title: "Help is always here",
    body: "The Help page holds the walkthrough video and a quick refresher on how matters, playbooks, seats and handoffs work. Send new coordinators here first.",
  },
  {
    target: null,
    route: "/dashboard",
    title: "You're set",
    body: "Log a real matter to try it end to end. You can replay this tour any time from “Take the tour” in the header.",
  },

];

function useTargetRect(selector: string | null, tick: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [selector, tick]);

  return rect;
}

export function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const step = steps[index] ?? steps[0]!;
  const rect = useTargetRect(open ? step.target : null, index);

  useEffect(() => {
    if (!open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || !step.route) return;
    if (router.state.location.pathname !== step.route) {
      router.navigate({ to: step.route });
    }
  }, [open, index, step.route, router]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    onClose();
  }, [onClose]);

  if (!open) return null;

  const pad = 6;
  const cardWidth = Math.min(360, typeof window !== "undefined" ? window.innerWidth - 32 : 360);
  let cardTop = typeof window !== "undefined" ? window.innerHeight / 2 - 120 : 200;
  let cardLeft = typeof window !== "undefined" ? window.innerWidth / 2 - cardWidth / 2 : 16;

  if (rect) {
    const below = rect.bottom + 16;
    const fitsBelow = typeof window !== "undefined" ? below + 220 < window.innerHeight : true;
    cardTop = fitsBelow ? below : Math.max(16, rect.top - 236);
    cardLeft = Math.min(
      Math.max(16, rect.left + rect.width / 2 - cardWidth / 2),
      (typeof window !== "undefined" ? window.innerWidth : cardWidth + 32) - cardWidth - 16,
    );
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-foreground/60" onClick={finish} />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-accent"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px hsl(0 0% 0% / 0.0), 0 0 0 4px hsl(0 0% 100% / 0.15)",
            background: "hsl(0 0% 100% / 0.08)",
          }}
        />
      ) : null}

      <div
        className="absolute w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl"
        style={{ top: cardTop, left: cardLeft }}
      >
        <button
          onClick={finish}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          aria-label="Close tour"
        >
          <X className="size-4" />
        </button>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {index + 1} of {steps.length}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= index ? "bg-accent" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => (index === steps.length - 1 ? finish() : setIndex((i) => i + 1))}
            >
              {index === steps.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useTourAutostart() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  return { open, setOpen };
}
