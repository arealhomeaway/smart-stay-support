import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GUIDED_TOURS } from "@/lib/guided-tours";
import { useGuidedTour } from "@/components/tours/GuidedTour";

/** "Take the tour" in the header: the person's team tour; Admin chooses one. */
export function TakeTourButton() {
  const { teams, start } = useGuidedTour();
  if (teams.length === 0) return null;
  const label = (
    <>
      <Compass className="size-4" aria-hidden="true" />
      <span className="hidden lg:inline">Take the tour</span>
    </>
  );
  if (teams.length === 1) {
    return (
      <Button type="button" size="sm" variant="ghost" className="min-h-11 min-w-11" aria-label="Take the tour" data-tour="take-tour" onClick={() => start(teams[0]!)}>
        {label}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="min-h-11 min-w-11" aria-label="Take the tour" data-tour="take-tour">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {teams.map((t) => (
          <DropdownMenuItem key={t} className="min-h-11" onSelect={() => start(t)}>
            {GUIDED_TOURS[t].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
