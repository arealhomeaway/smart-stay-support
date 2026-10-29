import { describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { formatPropertyLabel } from "../property-label";

describe("pending address labels in isolated PostgreSQL", () => {
  it("matches the code contract and limits helper execution", async () => {
    const db = new PGlite();
    try {
      await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
      await db.exec(readFileSync("docs/pending/address-labels/01_helper.sql", "utf8"));
      for (const home of [
        { name: "Fernstone", address_line1: "3400 N Fern Ave", city: "Broken Arrow", state: "OK", postal_code: "74012" },
        { name: "Alias", address_line1: " 1012 Main St ", unit: " B ", city: " Tulsa ", state: " OK ", postal_code: "74101" },
        { name: "Alias", address_line1: "10  O'Neil St., NE", unit: "Unit B" },
        { name: " Fernstone ", address_line1: " " },
        {},
      ]) {
        const r = await db.query<{ label: unknown }>("SELECT public.format_property_label($1::jsonb) label", [JSON.stringify(home)]);
        expect(r.rows[0]?.label).toEqual(formatPropertyLabel(home));
      }
      const grants = await db.query<{ anonymous: boolean; staff: boolean; service: boolean }>("SELECT has_function_privilege('anon','public.format_property_label(jsonb)','EXECUTE') anonymous, has_function_privilege('authenticated','public.format_property_label(jsonb)','EXECUTE') staff, has_function_privilege('service_role','public.format_property_label(jsonb)','EXECUTE') service");
      expect(grants.rows[0]).toEqual({ anonymous: false, staff: true, service: true });
    } finally { await db.close(); }
  });
  it("evaluates every staged producer's label expression without writing homes", async () => {
    const db = new PGlite();
    try {
      await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE properties(id uuid, name text, nickname text, address_line1 text, unit text, city text, state text, postal_code text);");
      await db.exec(readFileSync("docs/pending/address-labels/01_helper.sql", "utf8"));
      await db.exec("INSERT INTO properties VALUES('00000000-0000-4000-8000-000000000001','Fernstone','Ramsey','3400 N Fern Ave',NULL,'Broken Arrow','OK','74012');");
      const manifest = JSON.parse(readFileSync("docs/pending/address-labels/manifest.json", "utf8")) as { name: string; label_only: boolean; changes: [string, string][] }[];
      for (const fn of manifest.filter(f => f.label_only)) {
        for (const [, replacement] of fn.changes) {
          const expr = replacement.match(/public\.format_property_label\(to_jsonb\((\w+)\)\)->>'(primary|full)'/);
          if (!expr?.[1] || !expr[2]) throw new Error(`Missing label proof for ${fn.name}`);
          const r = await db.query<{ label: string }>(`SELECT public.format_property_label(to_jsonb(${expr[1]}))->>'${expr[2]}' label FROM properties ${expr[1]}`);
          expect(r.rows[0]?.label).toBe(expr[2] === "full" ? "3400 N Fern Ave, Broken Arrow, OK 74012" : "3400 N Fern Ave");
        }
      }
      const unchanged = await db.query<{name: string; nickname: string}>("SELECT name,nickname FROM properties");
      expect(unchanged.rows).toEqual([{ name: "Fernstone", nickname: "Ramsey" }]);
    } finally { await db.close(); }
  });
});