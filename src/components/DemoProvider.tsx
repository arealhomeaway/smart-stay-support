import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/lib/permissions";
import { useViewAs } from "@/hooks/useViewAs";
import { getDemoStatus, resetDemoEnvironment, seedDemoEnvironment } from "@/lib/demo.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  DEMO_FLAG_EVENT,
  PREVIEW_SEAT_EVENT,
  readDemoFlag,
  writeDemoFlag,
  writePreviewSeat,
  type PreviewSeat,
} from "@/lib/demo-mode";

/**
 * Demo Mode.
 *
 * A Platform Owner can open the safe demo environment, fully isolated from
 * live work (every demo row is tagged is_demo and blocked from real
 * emails/texts/integrations). Demo mode is a client-side lens layered on top
 * of the existing read-only "View As" preview: turning it on also enters a
 * persona preview so the admin sees a realistic role surface, and every
 * workflow query filters to demo records only.
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
  /** Whether the current user may operate the demo environment. */
  canDemo: boolean;
  enterDemo: (role: AppRole, seat?: PreviewSeat | null) => void;
  exitDemo: () => void;
  /** Admin-only: (re)seed or wipe the demo records. */
  seed: () => Promise<void>;
  reset: () => Promise<void>;
  seeding: boolean;
  resetting: boolean;
};

const EVENT = DEMO_FLAG_EVENT;
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const { viewAs, setViewAs, clearViewAs } = useViewAs();
  const queryClient = useQueryClient();

  const [flag, setFlag] = useState<boolean>(() => readDemoFlag());
  const [canDemo, setCanDemo] = useState(false);

  useEffect(() => {
    const sync = () => setFlag(readDemoFlag());
    window.addEventListener(EVENT, sync);
    window.addEventListener(PREVIEW_SEAT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener(PREVIEW_SEAT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Resolve admin status once on mount so the provider stays light.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled || !data.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if (cancelled) return;
      setCanDemo((roles ?? []).some((r) => r.role === "admin"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusQuery = useQuery({
    queryKey: ["demo-status"],
    staleTime: 30 * 1000,
    enabled: canDemo,
    queryFn: () => getDemoStatus(),
  });

  // Demo mode is real only when an admin is previewing a persona.
  const demoMode = canDemo && flag && Boolean(viewAs);

  const seedFn = useServerFn(seedDemoEnvironment);
  const resetFn = useServerFn(resetDemoEnvironment);

  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);

  const enterDemo = useCallback(
    (role: AppRole, seat: PreviewSeat | null = null) => {
      setViewAs(role);
      writePreviewSeat(seat);
      writeDemoFlag(true);
      void queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    },
    [setViewAs, queryClient],
  );

  const exitDemo = useCallback(() => {
    writePreviewSeat(null);
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
      canDemo,
      enterDemo,
      exitDemo,
      seed,
      reset,
      seeding,
      resetting,
    }),
    [demoMode, statusQuery.data, canDemo, enterDemo, exitDemo, seed, reset, seeding, resetting],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within a DemoProvider");
  return ctx;
}
