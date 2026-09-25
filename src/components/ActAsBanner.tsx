import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { endActAs, useActAs } from "@/lib/act-as";

/**
 * Standing reminder that the supervisor is signed in as a homeowner. Anything
 * done here is genuinely that homeowner's, so it must never be quiet.
 */
export function ActAsBanner() {
  const record = useActAs();
  const router = useRouter();
  const [returning, setReturning] = useState(false);

  if (!record) return null;

  async function goBack() {
    setReturning(true);
    try {
      const ended = await endActAs();
      await router.navigate({ to: ended?.origin ?? "/dashboard" });
      router.invalidate();
      toast.success("Back in your own account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not switch back.");
    } finally {
      setReturning(false);
    }
  }

  const live = record.live !== false;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 border-t border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm md:px-6"
    >
      <UserCheck className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
      <span className="min-w-0">
        <span className="block font-semibold uppercase tracking-wide">
          {live ? "Acting as live owner" : "Acting as demo owner"}: {record.name}
        </span>
        <span className="block text-xs">
          Actions taken here are performed as this homeowner
          {live ? " and affect their real program — this is not a sandbox." : "."}
        </span>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        disabled={returning}
        onClick={() => void goBack()}
      >
        {returning ? "Switching back…" : "Exit Act As"}
      </Button>
    </div>
  );
}
