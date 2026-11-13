/** 1.1 Slim banner: a real ARHA home photo from the Operations Home pool, greeting, tagline, Add a home. */
import type { ReactNode } from "react";
import { TAGLINE } from "@/lib/onboarding-home";

export function HomeBanner(p: {
  photo: string;
  caption: string | null;
  dateLine: string;
  greeting: string;
  onPhotoError: () => void;
  addHome: ReactNode;
}) {
  return (
    <section
      aria-label="Onboarding Home"
      className="relative flex min-h-[120px] overflow-hidden rounded-2xl border border-warm-deep/60 bg-plate sm:h-[150px]"
    >
      <img src={p.photo} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" onError={p.onPhotoError} />
      <div className="absolute inset-0 bg-gradient-to-r from-plate/90 via-plate/65 to-plate/5" />
      <div className="relative z-10 flex w-full flex-col justify-center gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="min-w-0 space-y-0.5 text-primary-foreground">
          <p className="text-xs font-medium opacity-80">{p.dateLine}</p>
          <h1 className="text-xl font-semibold leading-tight sm:text-2xl">{p.greeting}</h1>
          <p className="text-sm opacity-90">{TAGLINE}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          {p.addHome}
          {p.caption ? (
            <p data-part="photo-caption" className="max-w-[16rem] truncate text-xs text-primary-foreground/80">
              {p.caption}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
