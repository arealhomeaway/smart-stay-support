import type { ReactNode } from "react";
import { EMAIL_TEST_COPY } from "@/lib/email-intake";

/**
 * Register E1 (a): the separate list of email test records, shown only to the people who
 * run the test plan. It carries no number, so test records never reach a count.
 */
export function EmailTestRecords({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label={EMAIL_TEST_COPY.heading}
      data-testid="email-test-records"
      className="space-y-2 rounded-2xl border border-dashed border-warning/60 bg-warning/5 p-4"
    >
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold">{EMAIL_TEST_COPY.heading}</h2>
        <p className="text-[13px] text-muted-foreground">{EMAIL_TEST_COPY.hint}</p>
      </div>
      {children}
    </section>
  );
}
