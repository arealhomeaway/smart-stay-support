import { expect, it } from "bun:test";
import { bindPreviewAccount } from "../preview-account-boundary";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
const previewKeys = [
  "resolve.view-as",
  "resolve.owner-preview",
  "resolve.demo-mode",
  "resolve.preview-seat",
];

it("removes the prior account's owner and role/demo preview selection without clearing unrelated settings", () => {
  const store = storage();
  bindPreviewAccount(store, "admin-a");
  for (const key of previewKeys) store.setItem(key, "private prior selection");
  store.setItem("preferred-theme", "dark");
  expect(bindPreviewAccount(store, "owner-b")).toBe(true);
  for (const key of previewKeys) expect(store.getItem(key)).toBe(null);
  expect(store.getItem("preferred-theme")).toBe("dark");
});

it("preserves intentional same-account previews across a refresh", () => {
  const store = storage();
  bindPreviewAccount(store, "admin-a");
  store.setItem("resolve.owner-preview", "selected program");
  expect(bindPreviewAccount(store, "admin-a")).toBe(false);
  expect(store.getItem("resolve.owner-preview")).toBe("selected program");
});

it("clears unbound legacy previews and clears preview state on sign-out", () => {
  const store = storage();
  store.setItem("resolve.owner-preview", "legacy owner");
  bindPreviewAccount(store, "admin-a");
  expect(store.getItem("resolve.owner-preview")).toBe(null);
  for (const key of previewKeys) store.setItem(key, "preview");
  bindPreviewAccount(store, null);
  for (const key of previewKeys) expect(store.getItem(key)).toBe(null);
  expect(store.getItem("resolve.preview-account")).toBe(null);
});
