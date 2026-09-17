import { expect, it } from "bun:test";
import { drainStaffNotifications } from "../staff-notify.server";

type Recipient = {
  id: string;
  staff: boolean;
  roles: string[];
  deletedAt?: string;
  bannedUntil?: string;
  unavailable?: "staff" | "roles" | "account";
};

function fixture(recipients: Recipient[]) {
  const notifications = recipients.map((recipient) => ({
    id: `notification-${recipient.id}`,
    user_id: recipient.id,
    kind: "approval_required",
    title: "Private approval title",
    body: "Staff-only financial discussion",
    link_path: "/oversight",
    priority: "urgent",
    email_attempts: 0,
    email_status: "pending",
    is_demo: false,
  }));
  const writes: { id: string; patch: Record<string, unknown> }[] = [];
  const sends: { to: string; html: string }[] = [];
  const db = {
    auth: {
      admin: {
        getUserById: async (id: string) => {
          const recipient = recipients.find((item) => item.id === id);
          return {
            data: {
              user: recipient
                ? { id, deleted_at: recipient.deletedAt, banned_until: recipient.bannedUntil }
                : null,
            },
            error: recipient?.unavailable === "account" ? new Error("Account unavailable") : null,
          };
        },
      },
    },
    rpc: async (name: string, args: { _user_id: string }) => {
      expect(name).toBe("is_internal_staff");
      const recipient = recipients.find((item) => item.id === args._user_id);
      return {
        data: recipient?.staff ?? false,
        error: recipient?.unavailable === "staff" ? new Error("Role check unavailable") : null,
      };
    },
    from: (table: string) => {
      const filters = new Map<string, unknown>();
      let patch: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        update: (value: Record<string, unknown>) => {
          patch = value;
          return query;
        },
        eq: (field: string, value: unknown) => {
          filters.set(field, value);
          return query;
        },
        in: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (result: unknown) => unknown) => {
          if (patch) {
            const id = String(filters.get("id"));
            expect(filters.get("email_status") ?? "pending").toBe("pending");
            writes.push({ id, patch });
            Object.assign(
              notifications.find((item) => item.id === id)!,
              patch,
            );
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          if (table === "staff_notifications") {
            return Promise.resolve({ data: notifications, error: null }).then(resolve);
          }
          if (table === "profiles") {
            return Promise.resolve({
              data: recipients.map(({ id }) => ({ id, email: `${id}@example.invalid` })),
              error: null,
            }).then(resolve);
          }
          if (table === "user_roles") {
            const recipient = recipients.find((item) => item.id === filters.get("user_id"));
            return Promise.resolve({
              data: recipient?.roles.map((role) => ({ role })) ?? [],
              error: recipient?.unavailable === "roles" ? new Error("Roles unavailable") : null,
            }).then(resolve);
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };
      return query;
    },
  };
  const delivery: NonNullable<Parameters<typeof drainStaffNotifications>[2]> = {
    sendEmail: async (input) => {
      sends.push({ to: input.to, html: input.html });
      return { status: "sent", error: null };
    },
    emailShell: (title, body) => `${title}\n${body}`,
    isEmailAddress: (value): value is string => typeof value === "string" && value.includes("@"),
  };
  return {
    notifications,
    writes,
    sends,
    drain: () => drainStaffNotifications(db as never, 50, delivery),
  };
}

it("withholds private approval copy from an owner while delivering to legitimate staff", async () => {
  const test = fixture([
    { id: "owner", staff: false, roles: ["owner"] },
    { id: "teammate", staff: true, roles: ["onboarding"] },
  ]);
  const result = await test.drain();
  expect(test.sends).toEqual([
    {
      to: "teammate@example.invalid",
      html: "Private approval title\nStaff-only financial discussion",
    },
  ]);
  expect(result.emailed).toBe(1);
  const ownerRecord = test.notifications[0]!;
  expect(ownerRecord.email_status).toBe("skipped");
  expect(ownerRecord.body).toBe("Staff-only financial discussion");
  expect(ownerRecord.email_attempts).toBe(0);
  expect(test.writes[0]?.patch["email_error"]).toContain("private email blocked");
  expect(Object.hasOwn(test.writes[0]!.patch, "delivered_at")).toBe(false);
});

it("blocks mixed owner or vendor accounts even when the staff helper also permits them", async () => {
  const test = fixture([
    { id: "mixed-owner", staff: true, roles: ["admin", "owner"] },
    { id: "mixed-vendor", staff: true, roles: ["tech", "vendor"] },
  ]);
  await test.drain();
  expect(test.sends).toHaveLength(0);
  expect(test.notifications.map((row) => row.email_status)).toEqual(["skipped", "skipped"]);
});

it("does not send old queued staff content after access revocation or account disablement", async () => {
  const test = fixture([
    { id: "revoked", staff: false, roles: [] },
    { id: "deleted", staff: true, roles: ["manager"], deletedAt: "2026-09-17T00:00:00Z" },
    { id: "banned", staff: true, roles: ["tech"], bannedUntil: "2999-01-01T00:00:00Z" },
    { id: "unknown-ban", staff: true, roles: ["tech"], bannedUntil: "invalid" },
  ]);
  await test.drain();
  expect(test.sends).toHaveLength(0);
  expect(test.notifications.every((row) => row.email_status === "skipped")).toBe(true);
});

it("retains pending history on lookup failures and continues with independently verified staff", async () => {
  const test = fixture([
    { id: "role-check-error", staff: true, roles: ["tech"], unavailable: "staff" },
    { id: "role-list-error", staff: true, roles: ["tech"], unavailable: "roles" },
    { id: "account-error", staff: true, roles: ["tech"], unavailable: "account" },
    { id: "teammate", staff: true, roles: ["manager"], bannedUntil: "2000-01-01T00:00:00Z" },
  ]);
  const result = await test.drain();
  expect(test.sends.map((send) => send.to)).toEqual(["teammate@example.invalid"]);
  expect(test.notifications.slice(0, 3).every((row) => row.email_status === "pending")).toBe(true);
  expect(test.writes).toHaveLength(1);
  expect(result.notes).toHaveLength(3);
});
