import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { watchAccountIdentity } from "../account-query-boundary";

function fixture() {
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
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const identities: (string | null)[] = [];
  let reloads = 0;
  const stop = watchAccountIdentity(
    auth as never,
    queries,
    "owner-a",
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
