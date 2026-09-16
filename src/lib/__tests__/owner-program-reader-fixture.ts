/** Owner-safe SQL payloads used by integration-boundary tests. */
export function ownerProgramFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "program",
    status: "active",
    owner_user_id: "owner",
    owner_name: "QA Owner",
    owner_email: "owner@example.test",
    owner_phone: null,
    started_on: "2026-01-01",
    ends_on: "2026-03-31",
    activated_at: "2026-01-01T00:00:00Z",
    operating_target_hours: 105,
    onboarding_milestone_hours: 60,
    onboarding_milestone_day: 35,
    onboarding_lead: null,
    operations_lead: null,
    dfy_confirmed: true,
    completed_at: null,
    notify_email: true,
    notify_sms_p1: false,
    notify_push: true,
    ...overrides,
  };
}
export function ownerEnrollmentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "enrollment",
    property_id: "33333333-3333-4333-8333-333333333333",
    closing_date: "2026-01-01",
    closing_confirmed: true,
    added_on: "2026-01-01",
    inclusion_status: "included",
    onboarding_status: "in_progress",
    launch_status: "not_ready",
    coverage_status: "in_progress",
    last_owner_activity_at: null,
    current_access: true,
    properties: {
      name: "QA Home",
      nickname: null,
      address_line1: null,
      city: null,
      state: null,
      primary_photo_url: null,
    },
    ...overrides,
  };
}
