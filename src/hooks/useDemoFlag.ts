import { useEffect, useState } from "react";
import {
  DEMO_FLAG_EVENT,
  PREVIEW_SEAT_EVENT,
  readDemoFlag,
  readPreviewSeat,
  type PreviewSeat,
} from "@/lib/demo-mode";

/** Is the safe demo lens on? Readable outside the DemoProvider context. */
export function useDemoFlag(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(readDemoFlag());
    sync();
    window.addEventListener(DEMO_FLAG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DEMO_FLAG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return on;
}

/** Which operational seat is being previewed, if any. */
export function usePreviewSeat(): PreviewSeat | null {
  const [seat, setSeat] = useState<PreviewSeat | null>(null);
  useEffect(() => {
    const sync = () => setSeat(readPreviewSeat());
    sync();
    window.addEventListener(PREVIEW_SEAT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREVIEW_SEAT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return seat;
}
