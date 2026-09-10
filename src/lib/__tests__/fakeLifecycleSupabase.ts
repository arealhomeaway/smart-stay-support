/**
 * In-memory stand-in for the tables `gatherLifecycleFacts`/`applyStatusChange`
 * read and write (`ticket-lifecycle.server.ts`). `db` is passed in as a plain
 * argument there — no dynamic import to mock — so this only needs to satisfy
 * the query shapes those two functions actually issue: `.select().eq().in()`,
 * `.single()`/`.maybeSingle()`, a head-count `.select(cols, {head:true})`,
 * `.update()` and `.insert()`. Not a general Supabase stand-in.
 */
type Row = Record<string, unknown>;

export function createFakeLifecycleStore() {
  const tables = new Map<string, Row[]>();
  let nextId = 1;

  function rows(table: string): Row[] {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  }

  function builder(table: string) {
    type F = { col: string; op: "eq" | "in"; value: unknown };
    const filters: F[] = [];
    let headCount = false;
    let pendingUpdate: Row | null = null;
    const match = (r: Row) =>
      filters.every((f) =>
        f.op === "eq"
          ? r[f.col] === f.value
          : Array.isArray(f.value) && (f.value as unknown[]).includes(r[f.col]),
      );
    const selected = () => rows(table).filter(match);

    const api = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) headCount = true;
        return api;
      },
      insert: (payload: Row) => {
        const row: Row = { id: `${table}-${nextId++}`, ...payload };
        rows(table).push(row);
        const result = { data: row, error: null };
        const chain = {
          select: () => chain,
          single: () => Promise.resolve(result),
          then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
        };
        return chain;
      },
      update: (patch: Row) => {
        pendingUpdate = patch;
        return api;
      },
      eq: (col: string, value: unknown) => {
        filters.push({ col, op: "eq", value });
        if (pendingUpdate) {
          const patch = pendingUpdate;
          pendingUpdate = null;
          let updated: Row | null = null;
          const all = rows(table);
          for (let i = 0; i < all.length; i++) {
            if (match(all[i]!)) {
              updated = { ...all[i]!, ...patch };
              all[i] = updated;
            }
          }
          const result = { data: updated, error: null };
          return {
            then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
          } as unknown as typeof api;
        }
        return api;
      },
      in: (col: string, value: unknown[]) => {
        filters.push({ col, op: "in", value });
        return api;
      },
      single: () => {
        const row = selected()[0] ?? null;
        return Promise.resolve({
          data: row,
          error: row ? null : { message: `${table}: not found` },
        });
      },
      maybeSingle: () => Promise.resolve({ data: selected()[0] ?? null, error: null }),
      then: (res: (v: { data: unknown; error: null; count?: number }) => unknown) => {
        const matched = selected();
        return Promise.resolve({
          data: headCount ? null : matched,
          error: null,
          count: matched.length,
        }).then(res);
      },
    };
    return api;
  }

  return {
    from: (table: string) => builder(table),
    seed: (table: string, row: Row) => {
      rows(table).push(row);
      return row;
    },
    all: (table: string) => rows(table),
    reset: () => tables.clear(),
  };
}
