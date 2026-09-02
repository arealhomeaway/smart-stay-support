/**
 * Route transition feedback.
 *
 * When an employee opens a ticket or a home, Resolve should visibly accept the
 * click straight away rather than sitting still until the next screen paints.
 * A thin top bar is enough: it is calm, never blocks the screen, and disappears
 * the moment the destination is ready.
 */
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      // Only show it if the navigation is slow enough to notice; instant
      // transitions should not flash a bar.
      const id = window.setTimeout(() => setVisible(true), 120);
      return () => window.clearTimeout(id);
    }
    setVisible(false);
    return;
  }, [isLoading]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-label="Loading"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent"
    >
      <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
