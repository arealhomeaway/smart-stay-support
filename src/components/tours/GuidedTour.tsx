/**
 * Guided tours (Admin, Nov 16): the click-through walk of the real screens for each team.
 * Steps, sections and who sees which tour live in src/lib/guided-tours.ts. This file only
 * moves to the page, finds the real element and draws the card. It reads, never writes:
 * the dimmed layer blocks every click on the page while the tour is open.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import {
  GUIDED_TOURS,
  autostartTeam,
  resolveStepHref,
  stepsFor,
  tourSeenKey,
  toursFor,
  type TourPlaceIds,
  type TourStep,
  type TourTarget,
  type TourTeam,
  type TourViewer,
} from "@/lib/guided-tours";
import { OPEN_STATUSES } from "@/lib/tickets";

type Running = { team: TourTeam; sectionId: string | null };
type Ctx = { teams: TourTeam[]; start: (team: TourTeam, sectionId?: string | null) => void; running: Running | null };

const GuidedTourContext = createContext<Ctx>({ teams: [], start: () => {}, running: null });
export const useGuidedTour = () => useContext(GuidedTourContext);

/** Finds the first visible element for a step: a CSS selector, or a button/tab/link by its label. */
export function findTourTarget(targets: readonly TourTarget[] | null): HTMLElement | null {
  if (!targets) return null;
  for (const t of targets) {
    const nodes: HTMLElement[] =
      typeof t === "string"
        ? Array.from(document.querySelectorAll<HTMLElement>(t))
        : Array.from(document.querySelectorAll<HTMLElement>(t.within ?? "button, a, [role=tab], [role=button]")).filter((el) => {
            const txt = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            const want = t.text.toLowerCase();
            return t.exact ? txt === want : txt.startsWith(want);
          });
    const found = nodes.find((n) => {
      if (n.closest("[data-guided-tour]")) return false;
      const r = n.getBoundingClientRect();
      // Closed sections and hidden panels do not count, so the card never points at nothing.
      const shown = typeof n.checkVisibility === "function" ? n.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }) : true;
      return shown && r.width > 0 && r.height > 0;
    });
    const el = found && typeof t !== "string" && t.closest ? (found.closest<HTMLElement>(t.closest) ?? found) : found;
    if (el) return el;
  }
  return null;
}

/** Read-only lookups for steps that need a real record to show (a ticket, a home). */
async function loadPlaceIds(demo: boolean, team: TourTeam): Promise<TourPlaceIds> {
  const first = (r: { data: unknown }, key: string) => {
    const row = Array.isArray(r.data) ? (r.data[0] as Record<string, unknown> | undefined) : undefined;
    return typeof row?.[key] === "string" ? (row[key] as string) : null;
  };
  if (team === "operations") {
    const t = await supabase
      .from("tickets")
      .select("id")
      .eq("is_demo", demo)
      .in("status", [...OPEN_STATUSES] as never)
      .order("created_at", { ascending: false })
      .limit(1);
    return { ticket: first(t, "id"), home: null, task: null };
  }
  const h = await supabase
    .from("onboarding_projects")
    .select("property_id")
    .eq("is_demo", demo)
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const home = first(h, "property_id");
  if (!home) return { ticket: null, home: null, task: null };
  const k = await supabase
    .from("onboarding_tasks")
    .select("id")
    .eq("property_id", home)
    .eq("task_kind", "do_it")
    .is("parent_task_id", null)
    .is("archived_at", null)
    .neq("status", "complete")
    .order("created_at", { ascending: true })
    .limit(1);
  return { ticket: null, home, task: first(k, "id") };
}

export function GuidedTourProvider({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const role = useRole();
  const { demoMode, demoReady } = useDemo();
  const [running, setRunning] = useState<Running | null>(null);
  const viewer = useMemo(() => ({ roles: role.roles, seats: role.seats }), [role.roles, role.seats]);
  const teams = useMemo(() => (disabled || role.isLoading ? [] : toursFor(viewer)), [disabled, role.isLoading, viewer]);

  const start = useCallback((team: TourTeam, sectionId: string | null = null) => setRunning({ team, sectionId }), []);

  // Starts once per person the first time they sign in after tours ship. Never during View as.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || disabled || role.isLoading || role.previewing || !role.userId || !demoReady) return;
    const team = autostartTeam(viewer);
    if (!team) return;
    auto.current = true;
    try {
      const key = tourSeenKey(team, role.userId);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, new Date().toISOString());
    } catch {
      return;
    }
    const t = window.setTimeout(() => setRunning({ team, sectionId: null }), 1200);
    return () => window.clearTimeout(t);
  }, [disabled, role.isLoading, role.previewing, role.userId, viewer, demoReady]);

  const value = useMemo(() => ({ teams, start, running }), [teams, start, running]);
  return (
    <GuidedTourContext.Provider value={value}>
      {children}
      {running ? <TourOverlay running={running} viewer={viewer} demo={demoMode} onClose={() => setRunning(null)} /> : null}
    </GuidedTourContext.Provider>
  );
}

function useTargetRect(step: TourStep | null, key: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [searching, setSearching] = useState(true);
  useEffect(() => {
    setRect(null);
    setSearching(Boolean(step?.target));
    if (!step?.target) return;
    let raf = 0;
    let scrolled = false;
    const began = performance.now();
    const measure = () => {
      const el = findTourTarget(step.target);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", inline: "nearest" });
        }
        setRect(el.getBoundingClientRect());
        setSearching(false);
      } else {
        setRect(null);
        // Pages load their data first; give a step a moment before showing it centered.
        if (performance.now() - began > 6000) setSearching(false);
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [step, key]);
  return { rect, searching };
}

function TourOverlay({
  running,
  viewer,
  demo,
  onClose,
}: {
  running: Running;
  viewer: TourViewer;
  demo: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const steps = useMemo(() => stepsFor(running.team, running.sectionId, viewer), [running, viewer]);
  const navigated = useRef<string | null>(null);
  const [index, setIndex] = useState(0);
  const [ids, setIds] = useState<TourPlaceIds | null>(null);
  const step = steps[index] ?? null;
  const { rect, searching } = useTargetRect(step, `${index}`);
  const tour = GUIDED_TOURS[running.team];

  useEffect(() => {
    let live = true;
    loadPlaceIds(demo, running.team)
      .then((r) => live && setIds(r))
      .catch(() => live && setIds({ ticket: null, home: null, task: null }));
    return () => {
      live = false;
    };
  }, [demo, running.team]);

  useEffect(() => {
    if (!step || !ids) return;
    const href = resolveStepHref(step, ids);
    // Navigate once per page change; the page may tidy its own address after it opens.
    if (navigated.current === href) return;
    const prev = navigated.current;
    navigated.current = href;
    // Leaving a step that opened a Task drawer or a chat: close it the way Escape does.
    const opened = (h: string | null) => (h ? /[?&](task|chat)=/.test(h) : false);
    if (opened(prev) && !opened(href)) {
      document
        .querySelector<HTMLElement>("[role='dialog'][data-state='open']:not([data-guided-tour] *)")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }
    const here = `${router.state.location.pathname}${router.state.location.searchStr ?? ""}`;
    if (here !== href) void router.navigate({ href });
  }, [step, ids, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  if (!step) return null;
  const last = index === steps.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardWidth = Math.min(360, vw - 32);
  const pad = 6;
  let top = vh / 2 - 130;
  let left = vw / 2 - cardWidth / 2;
  if (rect) {
    const below = rect.bottom + pad + 12;
    top = below + 250 < vh ? below : Math.max(16, rect.top - pad - 262);
    if (top + 250 > vh && rect.top - 262 < 16) top = Math.max(16, vh - 266);
    left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardWidth / 2), vw - cardWidth - 16);
  }
  // A tall area (or one partly off screen) never pushes the card out of sight.
  top = Math.min(Math.max(16, top), Math.max(16, vh - 290));
  const centered = !rect && !searching;

  return (
    <div
      className="fixed inset-0 z-[100]"
      // An open drawer turns page clicks off and closes on an outside press; the tour keeps its
      // own buttons working and never closes the drawer it is pointing at.
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.stopPropagation()}
      data-guided-tour=""
      data-tour-step={step.id}
      data-tour-centered={centered ? "true" : "false"}
    >
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-accent"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px color-mix(in oklab, var(--foreground) 62%, transparent)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-foreground/60" />
      )}
      {/* Catches every click so nothing on the page changes during the tour. */}
      <div className="absolute inset-0" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        className="absolute rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl"
        style={{ top, left, width: cardWidth }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-1 top-1 grid size-11 place-items-center text-muted-foreground hover:text-foreground"
          aria-label="Close tour"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <p className="pr-10 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {tour.label} · Step {index + 1} of {steps.length}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{step.section}</p>
        <h3 id="guided-tour-title" className="mt-1 font-display text-lg font-semibold">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-accent" : "bg-muted"}`} />
          ))}
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" className="min-h-11" onClick={onClose}>
            Skip
          </Button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="outline" className="min-h-11" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            ) : null}
            <Button className="min-h-11" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
              {last ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
