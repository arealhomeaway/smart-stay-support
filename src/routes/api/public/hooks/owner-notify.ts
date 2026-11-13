import { createFileRoute } from "@tanstack/react-router";

/**
 * Drains queued owner alerts to email and (for urgent tickets) text.
 * Called on a schedule; the in-app inbox is already updated by the database.
 * Each email part sends at most 50 and stops after 60 seconds; a failed part is recorded and the
 * run continues (Part 2, 2.7). Only a failure of the run's own audit stops it.
 */
export const Route = createFileRoute("/api/public/hooks/owner-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-secret") ?? "";
        if (!token) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const verified = await supabaseAdmin.rpc("cleaner_verify_cron_token", { _token: token });
        if (verified.error || verified.data !== true)
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        const { drainOwnerAlerts } = await import("@/lib/owner-notify.server");
        const { drainStaffNotifications } = await import("@/lib/staff-notify.server");
        const { evaluateAllPrograms } = await import("@/lib/owner-progress-alerts.server");
        const { sweepDeadlineAlerts } = await import("@/lib/deadline-alerts.server");
        const { drainScheduledEmails } = await import("@/lib/email-composer.server");
        const { drainOwnerWelcomes } = await import("@/lib/owner-welcome.server");
        const { runEmailJob } = await import("@/lib/email-job.server");
        const { runAoClocksGuarded, runAoOwnerEmailGuarded } = await import("@/lib/ao-ui");
        const { runReviewOverdueSweep } = await import("@/lib/onboarding-reviews");
        const { runNightlyReviewSync } = await import("@/lib/review-sync.server");
        const { runGuestTouchBaseSync } = await import("@/lib/guest-touch-base.server");
        const { runNightlyPropertyRefresh } = await import("@/lib/property-enrichment-run.server");
        const { runNightlyPidSync } = await import("@/lib/pid-sync/run.server");
        const { runOwnerRezListingCache } = await import("@/lib/onboarding-home.server");
        const { runOwnerCommsJobs } = await import("@/lib/owner-tab.server");

        try {
          const result = await runEmailJob(supabaseAdmin, [
            { name: "progress", run: (id) => evaluateAllPrograms(supabaseAdmin, id) },
            { name: "deadlines_and_vendor_reminders", run: () => sweepDeadlineAlerts(supabaseAdmin) },
            // Active Owner email: plan is ready, then one daily email at the set time (default 9 AM Central),
            // never more than one a day per owner. Before delivery so they go out in this pass.
            // Skipped silently until the staged function exists.
            // Property page Part 2: unread chat alerts, owner reminders (the business day before, held for
            // the daily email below), Friday weekly drafts and auto-send. Skipped until staged; never fails.
            { name: "owner_comms", run: () => runOwnerCommsJobs(supabaseAdmin) },
            { name: "ao_owner_email", run: () => runAoOwnerEmailGuarded(supabaseAdmin) },
            { name: "owner", run: (id) => drainOwnerAlerts(supabaseAdmin, 50, undefined, id) },
            { name: "staff", run: (id) => drainStaffNotifications(supabaseAdmin, 50, undefined, id) },
            { name: "scheduled", run: (id) => drainScheduledEmails(new Date(), id) },
            { name: "welcomes", run: (id) => drainOwnerWelcomes(supabaseAdmin, 20, id) },
            // Last, so it can never hold up existing deliveries. Skipped silently until the staged function exists.
            { name: "ao_clocks", run: () => runAoClocksGuarded(supabaseAdmin) },
            // Review overdue alerts are in-app only; they never queue email.
            { name: "onboarding_review_overdue", run: () => runReviewOverdueSweep(supabaseAdmin) },
            // Nightly OwnerRez review import (2 a.m. Central); read-only toward OwnerRez.
            { name: "ownerrez_reviews_nightly", run: () => runNightlyReviewSync(supabaseAdmin) },
            // Hourly: one Guest Touch Base task per 4+ night stay on day 2. Reads OwnerRez only; never contacts guests.
            { name: "guest_touch_base", run: () => runGuestTouchBaseSync(supabaseAdmin) },
            // Nightly (3 a.m. Central): property info and photos from OwnerRez. Read-only toward OwnerRez.
            { name: "property_info_nightly", run: () => runNightlyPropertyRefresh(supabaseAdmin) },
            // Nightly (2 a.m. Central) copy from the Notion PID, only while pid_nightly_sync is on. Read-only
            // toward Notion; last, and it never reports a failure here, so it can never hold up other work.
            { name: "pid_nightly_sync", run: () => runNightlyPidSync(supabaseAdmin) },
            // Hourly: the Onboarding Home "Not in Resolve yet" OwnerRez list. Read-only toward OwnerRez;
            // skipped until its staged table exists, and it never reports a failure here.
            { name: "ownerrez_listing_cache", run: () => runOwnerRezListingCache(supabaseAdmin) },
          ]);
          return Response.json(result, { status: result.ok ? 200 : 500 });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Delivery failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
