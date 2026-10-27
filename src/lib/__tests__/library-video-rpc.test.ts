import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const lib = "00000000-0000-4000-8000-0000000007a1";
const inactiveLib = "00000000-0000-4000-8000-0000000007a2";
const admin = "00000000-0000-4000-8000-000000000801";
const tech = "00000000-0000-4000-8000-000000000802";
const owner = "00000000-0000-4000-8000-000000000803";
const otherOwner = "00000000-0000-4000-8000-000000000804";
const vendor = "00000000-0000-4000-8000-000000000805";
const closedOwner = "00000000-0000-4000-8000-000000000806";
const startedProgram = "00000000-0000-4000-8000-000000000901";
const path = (n: string, l = lib) => `owner-library-video/${l}/${n}.mp4`;

let db: PGlite;
const q = (sql: string, v: unknown[] = []) => db.query<Record<string, unknown>>(sql, v);
const as = (u: string | null) => q("SELECT set_config('test.actor',$1,false)", [u ?? ""]);
const canView = async (u: string | null, l = lib) => { await as(u); return (await q("SELECT public.can_view_owner_library_video($1) v", [l])).rows[0]!["v"]; };

describe("Library video database change 0167 (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync("supabase/tests/fixtures/library_video_schema.sql", "utf8"));
    await db.exec(readFileSync("docs/pending/library-video/0167_owner_library_videos.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec("SET session_replication_role = replica; DELETE FROM public.owner_library_videos; SET session_replication_role = origin; TRUNCATE public.user_roles, public.owner_programs, public.work_items, public.owner_opportunity_library CASCADE");
    await q("INSERT INTO public.owner_opportunity_library VALUES ($1,'Review your property''s guest journey',true),($2,'Old idea',false)", [lib, inactiveLib]);
    await q("INSERT INTO public.user_roles VALUES ($1,'admin'),($2,'tech'),($3,'owner'),($4,'owner'),($5,'vendor'),($6,'owner')", [admin, tech, owner, otherOwner, vendor, closedOwner]);
    await q("INSERT INTO public.owner_programs VALUES (gen_random_uuid(),$1,'active'),($2,$3,'closed')", [owner, startedProgram, closedOwner]);
    // The closed-program owner already started the Opportunity from this item.
    await q("INSERT INTO public.work_items VALUES (gen_random_uuid(),'opportunity',$1,$2,'open',NULL)", [startedProgram, lib]);
  });

  it("staff editor uploads, replaces and removes with history kept", async () => {
    await as(admin);
    const first = (await q("SELECT public.set_owner_library_video($1,$2,'video/mp4',$3,'') id", [lib, path("a"), 129 * 1024 * 1024])).rows[0]!["id"];
    const second = (await q("SELECT public.set_owner_library_video($1,$2,'video/mp4',1000,'New cut') id", [lib, path("b")])).rows[0]!["id"];
    const rows = (await q("SELECT id, label, removed_at IS NOT NULL gone, removal_reason, replaced_by, uploaded_by FROM public.owner_library_videos ORDER BY uploaded_at, label")).rows;
    expect(rows.find((r) => r["id"] === first)).toMatchObject({ label: "Watch the walkthrough", gone: true, removal_reason: "replaced", replaced_by: second, uploaded_by: admin });
    expect(rows.find((r) => r["id"] === second)).toMatchObject({ label: "New cut", gone: false });
    await q("SELECT public.remove_owner_library_video($1)", [lib]);
    expect((await q("SELECT count(*)::int n FROM public.owner_library_videos WHERE removed_at IS NULL")).rows[0]!["n"]).toBe(0);
    expect((await q("SELECT count(*)::int n FROM public.owner_library_videos WHERE removal_reason='removed' AND removed_by=$1", [admin])).rows[0]!["n"]).toBe(1);
    await expect(q("DELETE FROM public.owner_library_videos")).rejects.toThrow("cannot be deleted");
  });

  it("rejects files over 250 MB, wrong types and paths outside the item folder", async () => {
    await as(admin);
    await expect(q("SELECT public.set_owner_library_video($1,$2,'video/mp4',262144001,'')", [lib, path("big")])).rejects.toThrow();
    await expect(q("SELECT public.set_owner_library_video($1,$2,'application/pdf',10,'')", [lib, path("pdf")])).rejects.toThrow();
    await expect(q("SELECT public.set_owner_library_video($1,$2,'video/mp4',10,'')", [lib, path("x", inactiveLib)])).rejects.toThrow();
    await q("SELECT public.set_owner_library_video($1,$2,'video/mp4',262144000,'')", [lib, path("max")]);
  });

  it("refuses non-editors (other staff, owners, vendors, signed out)", async () => {
    for (const u of [tech, owner, vendor, null]) {
      await as(u);
      await expect(q("SELECT public.set_owner_library_video($1,$2,'video/mp4',10,'')", [lib, path(`u${u}`)])).rejects.toThrow("library editors");
      await expect(q("SELECT public.remove_owner_library_video($1)", [lib])).rejects.toThrow("library editors");
    }
  });

  it("homeowners with the Opportunity and staff may watch; vendors, others and signed-out may not", async () => {
    expect(await canView(admin)).toBe(true);
    expect(await canView(tech)).toBe(true);
    expect(await canView(owner)).toBe(true); // active program: item offered in More ways to participate
    expect(await canView(closedOwner)).toBe(true); // started copy keeps access
    expect(await canView(otherOwner)).toBe(false); // no program
    expect(await canView(vendor)).toBe(false);
    expect(await canView(null)).toBe(false);
    expect(await canView(owner, inactiveLib)).toBe(false); // not offered and not started
  });

  it("a replacement is what started Opportunities see (one live row per item)", async () => {
    await as(admin);
    await q("SELECT public.set_owner_library_video($1,$2,'video/mp4',10,'v1')", [lib, path("v1")]);
    await q("SELECT public.set_owner_library_video($1,$2,'video/mp4',10,'v2')", [lib, path("v2")]);
    const live = (await q("SELECT v.storage_path FROM public.work_items w JOIN public.owner_library_videos v ON v.library_id = w.library_template_id AND v.removed_at IS NULL WHERE w.program_id=$1", [startedProgram])).rows;
    expect(live).toEqual([{ storage_path: path("v2") }]);
  });
});
