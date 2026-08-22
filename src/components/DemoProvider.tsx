import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/lib/permissions";
import { useViewAs } from "@/hooks/useViewAs";
import {
  getDemoStatus,
  resetDemoEnvironment,
  seedDemoEnvironment,
} from "@/lib/demo.functions";
import { useServerFn } from "@tanstack/react-start";
import { useRole } from "@/hooks/useRole";

/**
 * Demo Mode.
 *
 * A Platform Owner can open the safe demo environment, which is fully isolated
 * from live work (every demo row is tagged is_demo and blocked from real
 * emails/texts/integrations). Demo mode is a client-side lens layered on top of
 * the existing read-only "View As" preview: turning it on also enters a persona
 * preview so the admin sees a realistic role surface, and every workflow query
 * filters to demo records only.
 */

export type DemoStatus = {
  active: boolean;
  seeded: boolean;
  scenarioCount: number;
};

type DemoContextValue = {
  /** Whether the demo lens is currently on (admin + preview persona set). */
  demoMode: boolean;
  /** Raw environment state (seeded, scenario count). */
  status: DemoStatus | undefined;
  /** Only Platform Owners may enter demo mode. */
  canDemo: boolean;
  enterDemo: (role: AppRole) => void;
  exitDemo: () => void;
  /** Admin-only: (re)seed or wipe the demo records. */
  seed: () => Promise<void>;
  reset: () => Promise<void>;
  seeding: boolean;
  resetting: boolean;
};

const KEY = "resolve.demo-mode";
const EVENT = "resolve:demo-mode";
const DemoContext = createContext<DemoContextValue | null>(null);

function readDemoFlag(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(KEY) === "1";
}

function writeDemoFlag(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.sessionStorage.setItem(KEY, "1");
  else window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const { viewAs, setViewAs, clearViewAs } = useViewAs();
  const { actualRoles } = useRole();
  const queryClient = useQueryClient();
  const isAdmin = actualRoles.includes("admin");

  const [flag, setFlag] = useState<boolean>(() => readDemoFlag());
  useEffect(() => {
    const sync = () => setFlag(readDemoFlag());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const statusQuery = useQuery({
    queryKey: ["demo-status"],
    staleTime: 30 * 1000,
    enabled: isAdmin,
    queryFn: () => getDemoStatus(),
  });

  // Demo mode is real only when an admin is previewing a persona.
  const demoMode = isAdmin && flag && Boolean(viewAs);

  const seedFn = useServerFn(seedDemoEnvironment);
  const resetFn = useServerFn(resetDemoEnvironment);

  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);

  const enterDemo = useCallback(
    (role: AppRole) => {
      setViewAs(role);
      writeDemoFlag(true);
      void queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    },
    [setViewAs, queryClient],
  );

  const exitDemo = useCallback(() => {
    writeDemoFlag(false);
    clearViewAs();
  }, [clearViewAs]);

  const seed = useCallback(async () => {
    setSeeding(true);
    try {
      await seedFn({ data: {} });
      await queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    } finally {
      setSeeding(false);
    }
  }, [seedFn, queryClient]);

  const reset = useCallback(async () => {
    setResetting(true);
    try {
      await resetFn({ data: {} });
      await queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    } finally {
      setResetting(false);
    }
  }, [resetFn, queryClient]);

  const value = useMemo<DemoContextValue>(
    () => ({
      demoMode,
      status: statusQuery.data,
      canDemo: isAdmin,
      enterDemo,
      exitDemo,
      seed,
      reset,
      seeding,
      resetting,
    }),
    [demoMode, statusQuery.data, isAdmin, enterDemo, exitDemo, seed, reset, seeding, resetting],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** Convenience filter: apply to any query builder to honour demo mode. */
export function useDemoFilter() {
  const { demoMode } = useDemo();
  return useMemo(() => {
    return { demoMode, eq: (b: { eq: (col: string, val: boolean) => unknown }) => (demoMode ? b.eq("is_demo", true) : b.eq("is_demo", false)) };
  }, [demoMode]);
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within a DemoProvider");
  return ctx;
}
