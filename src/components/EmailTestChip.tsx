import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Small "Test" chip for a record made from a [RESOLVE TEST] email. */
export function EmailTestChip({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-dashed text-[12px] font-semibold", className)}>
      Test
    </Badge>
  );
}
