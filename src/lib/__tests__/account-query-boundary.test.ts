import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { watchAccountIdentity } from "../account-query-boundary";

function fixture(
  queries = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  initialUserId = "owner-a",
) {
  let notify: (event: string, session: { user: { id: string } } | null) => void = () => {};
  let unsubscribed = false;
  const auth = {
    onAuthStateChange: (callback: typeof notify) => {
      notify = callback;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              unsubscribed = true;
            },
          },
        },
      };
    },
  };
  const identities: (string | null)[] = [];
  let reloads = 0;
  const stop = watchAccountIdentity(
    auth as never,
    queries,
    initialUserId,
    (id) => identities.push(id),
    () => {
      reloads++;
    },
  );
  return {
    queries,
    identities,
    stop,
    emit: (id: string | null) => notify("TOKEN_REFRESHED", id ? { user: { id } } : null),
    reloads: () => reloads,
    unsubscribed: () => unsubscribed,
  };
}

it("clears the prior account on remount even when auth events occurred while unmounted", () => {
  const first = fixture();
  first.queries.setQueryData(["my-roles"], { userId: "owner-a", roles: ["admin"] });
  first.queries.setQueryData(["owner-home", "owner-a"], { private: "home-a" });
  first.stop();
  const second = fixture(first.queries, "owner-b");
  expect(second.queries.getQueryCache().getAll().length).toBe(0);
  second.emit("owner-b");
  expect(second.identities).toEqual(["owner-b"]);
  expect(second.reloads()).toBe(0);
  second.stop();
});

it("retains the same account cache across a layout remount", () => {
  const first = fixture();
  first.queries.setQueryData(["owner-home", "owner-a"], { private: "home-a" });
  first.stop();
  const second = fixture(first.queries);
  expect(second.queries.getQueryData(["owner-home", "owner-a"])).toEqual({ private: "home-a" });
  second.stop();
  second.queries.clear();
});

it("keeps same-account token refreshes from clearing data or reloading the route", async () => {
  const f = fixture();
  f.queries.setQueryData(["owner-approvals", "owner-a"], ["private-a"]);
  f.emit("owner-a");
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(f.queries.getQueryData(["owner-approvals", "owner-a"])).toEqual(["private-a"]);
  expect(f.reloads()).toBe(0);
  expect(f.identities).toEqual(["owner-a"]);
  f.stop();
  f.queries.clear();
});

it("clears cached roles and owner data before revalidating a changed account", async () => {
  const f = fixture();
  f.queries.setQueryData(["my-roles"], { userId: "owner-a", roles: ["admin"] });
  f.queries.setQueryData(["owner-home", "owner-a"], { private: "home-a" });
  f.emit("owner-b");
  expect(f.queries.getQueryCache().getAll().length).toBe(0);
  expect(f.identities).toEqual(["owner-b"]);
  expect(f.reloads()).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(f.reloads()).toBe(1);
  f.stop();
});

it("prevents a late prior-account query from repopulating cache after sign-out", async () => {
  const f = fixture();
  let finish: (value: string) => void = () => {};
  const response = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const request = f.queries
    .fetchQuery({ queryKey: ["owner-home", "owner-a"], queryFn: () => response })
    .catch(() => null);
  f.emit(null);
  finish("private owner-a response");
  await request;
  expect(f.queries.getQueryCache().getAll().length).toBe(0);
  expect(f.identities).toEqual([null]);
  f.stop();
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(f.unsubscribed()).toBe(true);
  expect(f.reloads()).toBe(0);
});
