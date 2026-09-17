import { expect, it } from "bun:test";
import { completeProgram } from "../owner-program.server";

it("captures the report version before aggregate reads and propagates stale closeout rejection", async () => {
  const reads: string[] = [];
  let received: unknown;
  const db = {
    from: (table: string) => {
      let selected = "";
      const query = {
        select: (fields: string) => {
          selected = fields;
          return query;
        },
        eq: () => query,
        in: () => query,
        order: () => query,
        range: () => query,
        single: async () => {
          reads.push(selected);
          return {
            data:
              selected === "report_version"
                ? { report_version: "initial-version" }
                : {
                    id: "program",
                    status: "active",
                    started_on: "2026-01-01",
                    owner_name: "QA Owner",
                  },
            error: null,
          };
        },
        then: (resolve: (value: unknown) => unknown) => {
          reads.push(table);
          const data =
            table === "owner_program_properties"
              ? [
                  {
                    id: "link",
                    property_id: "home",
                    inclusion_status: "included",
                    properties: { name: "QA Home" },
                  },
                ]
              : table === "owner_time_entries"
                ? [
                    {
                      id: "entry",
                      minutes: 6010,
                      activity: "Reviewed property",
                      phase: "onboarding",
                      entry_date: "2026-01-02",
                      review_status: "approved",
                      propertyIds: [],
                    },
                  ]
                : table === "owner_program_events"
                  ? [
                      {
                        id: "receipt",
                        review_id: "review",
                        created_at: "2026-01-02",
                        detail: {
                          response: "Reviewed original",
                          ownerUpdate: {
                            revision: 1,
                            issue: "Original issue",
                            work_performed: "Original work",
                            outcome: "Original outcome",
                            reviewed_at: "2026-01-01",
                          },
                        },
                      },
                    ]
                  : [];
          return Promise.resolve({ data, error: null, count: data.length }).then(resolve);
        },
      };
      return query;
    },
  };
  const admin = {
    rpc: async (name: string, args: unknown) => {
      expect(name).toBe("complete_owner_program");
      received = args;
      return { data: null, error: new Error("The program or its report inputs changed.") };
    },
  };
  const message = await completeProgram(db as never, "supervisor", "program", admin as never).then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
  expect(reads[0]).toBe("report_version");
  expect(message).toContain("report inputs changed");
  const request = received as {
    _program_id: string;
    _actor_id: string;
    _expected_version: string;
    _report: {
      log: unknown[];
      responseHistory: { ownerUpdate: { revision: number; outcome: string } }[];
    };
  };
  expect(request._program_id).toBe("program");
  expect(request._actor_id).toBe("supervisor");
  expect(request._expected_version).toBe("initial-version");
  expect(request._report.log.length).toBe(1);
  expect(request._report.responseHistory[0]?.ownerUpdate.revision).toBe(1);
  expect(request._report.responseHistory[0]?.ownerUpdate.outcome).toBe("Original outcome");
});
