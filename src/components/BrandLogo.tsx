import logo from "@/assets/arha-resolve-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * ARHA Resolve primary brand mark. The artwork has a white background, so it is
 * always rendered on a white plate — never cropped, recoloured or stretched.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-lg bg-white p-1",
        className,
      )}
    >
      <img
        src={logo.url}
        alt="A Real Home Away Resolve"
        className="h-full w-auto max-w-full object-contain"
      />
    </span>
  );
}
