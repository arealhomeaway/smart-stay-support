import logoWhite from "@/assets/arha-logo-white.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * A Real Home Away wordmark. The source artwork is white, so it is only used
 * on dark brand surfaces (header, auth panel, footer).
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoWhite.url}
      alt="A Real Home Away"
      className={cn("h-auto w-auto object-contain", className)}
      loading="lazy"
    />
  );
}
