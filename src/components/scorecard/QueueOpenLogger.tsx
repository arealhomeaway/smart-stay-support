import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logQueueOpen } from "@/lib/scorecard-capture.functions";

/**
 * Logs a queue sweep on the server, with server time, when the Operations Supervisor opens
 * this page. The database decides who counts; nothing shows on screen and there is no button.
 */
export function QueueOpenLogger({ source }: { source: "team_queue" | "supervisor_check" | "oversight" }) {
  const logFn = useServerFn(logQueueOpen);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void logFn({ data: { source } }).catch(() => undefined);
  }, [logFn, source]);
  return null;
}
