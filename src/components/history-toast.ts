import { toast } from "sonner";
import { savedToast } from "@/lib/history-line";

/** Shows a plain success, or a warning when the history line did not save. */
export function showSaved(done: string, historySaved: boolean) {
  const t = savedToast(done, historySaved);
  if (t.tone === "success") toast.success(t.message);
  else toast.warning(t.message);
}
