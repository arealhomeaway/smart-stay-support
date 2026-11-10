/**
 * In-memory stand-in for the tables the email intake code reads and writes,
 * plus a fake Microsoft mailbox behind `fetch`. No real database and no real
 * mailbox: every message is a plain object made by the test.
 *
 * Enforces the one-record-per-message unique index on integration_events
 * (system, operation, external_id) for mailbox_message rows, like Postgres.
 */

type Row = Record<string, unknown>;
type Filter = { col: string; op: "eq" | "neq" | "in" | "notNull" | "notLike" | "gte"; value: unknown };

function matches(row: Row, f: Filter) {
  const v = row[f.col];
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "in":
      return Array.isArray(f.value) && f.value.includes(v);
    case "notNull":
      return v !== null && v !== undefined;
    case "notLike": {
      const prefix = String(f.value).replace(/%$/, "");
      return !String(v ?? "").startsWith(prefix);
    }
    case "gte":
      return String(v ?? "") >= String(f.value);
  }
}

export function createFakeIntakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, rows] of Object.entries(seed)) tables[k] = rows.map((r) => ({ ...r }));
  let nextId = 1;
  let clock = Date.parse("2026-11-16T15:00:00Z");
  const rows = (t: string) => (tables[t] ??= []);

  function insertRows(table: string, payload: Row | Row[]) {
    const list = Array.isArray(payload) ? payload : [payload];
    if (table === "integration_events") {
      for (const r of list) {
        if (r["operation"] !== "mailbox_message") continue;
        const clash = rows(table).some(
          (e) =>
            e["system"] === r["system"] && e["operation"] === r["operation"] && e["external_id"] === r["external_id"],
        );
        if (clash) return { data: null, error: { code: "23505", message: "duplicate key value" } };
      }
    }
    const stamped = list.map((r) => ({
      id: `${table}-${nextId++}`,
      created_at: new Date((clock += 1000)).toISOString(),
      ...(table === "tickets" ? { ref: nextId } : {}),
      ...(table === "integration_events" ? { entity_id: null, entity_type: null, error_message: null } : {}),
      ...r,
    }));
    rows(table).push(...stamped);
    return { data: stamped, error: null };
  }

  function from(table: string) {
    const filters: Filter[] = [];
    let order: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;
    let patch: Row | null = null;
    let inserted: Row[] | null = null;
    let insertError: unknown = null;
    let head = false;

    const selected = () => {
      let out = rows(table).filter((r) => filters.every((f) => matches(r, f)));
      if (order) {
        const { col, ascending } = order;
        out = [...out].sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")) * (ascending ? 1 : -1));
      }
      if (limitN != null) out = out.slice(0, limitN);
      return out;
    };

    const run = () => {
      if (inserted || insertError) return { data: inserted, error: insertError };
      if (patch) {
        const hit = new Set(selected().map((r) => r["id"]));
        tables[table] = rows(table).map((r) => (hit.has(r["id"]) ? { ...r, ...patch } : r));
        return { data: null, error: null };
      }
      const out = selected();
      return head ? { data: null, count: out.length, error: null } : { data: out, count: out.length, error: null };
    };

    const api: Record<string, unknown> = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) head = true;
        return api;
      },
      insert: (payload: Row | Row[]) => {
        const r = insertRows(table, payload);
        inserted = r.data;
        insertError = r.error;
        return api;
      },
      update: (p: Row) => {
        patch = p;
        return api;
      },
      eq: (col: string, value: unknown) => (filters.push({ col, op: "eq", value }), api),
      neq: (col: string, value: unknown) => (filters.push({ col, op: "neq", value }), api),
      in: (col: string, value: unknown) => (filters.push({ col, op: "in", value }), api),
      gte: (col: string, value: unknown) => (filters.push({ col, op: "gte", value }), api),
      not: (col: string, op: string, value: unknown) => {
        filters.push(op === "like" ? { col, op: "notLike", value } : { col, op: "notNull", value: null });
        return api;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        order = { col, ascending: opts?.ascending ?? true };
        return api;
      },
      limit: (n: number) => {
        limitN = n;
        return api;
      },
      maybeSingle: () => {
        const r = run();
        const data = inserted ? (inserted[0] ?? null) : Array.isArray(r.data) ? (r.data[0] ?? null) : r.data;
        return Promise.resolve({ data, error: r.error });
      },
      single: () => (api["maybeSingle"] as () => Promise<unknown>)(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        try {
          return Promise.resolve(resolve(run()));
        } catch (e) {
          return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
        }
      },
    };
    return api;
  }

  const db = { from, rpc: async () => ({ data: null, error: null }) } as never;
  return {
    db,
    tables,
    rows,
    setSwitch(on: boolean, startLine: string | null) {
      tables["feature_flags"] = [{ key: "email_intake", enabled: on }];
      tables["integration_events"] = rows("integration_events").filter((r) => r["operation"] !== "processing_checkpoint");
      if (startLine)
        rows("integration_events").push({
          id: "checkpoint",
          system: "outlook_inbox",
          operation: "processing_checkpoint",
          external_id: startLine,
          status: "checkpoint",
          created_at: "2026-09-01T23:25:43Z",
        });
    },
  };
}

export type FakeMessage = {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject: string;
  receivedDateTime: string;
  categories: string[];
  from?: { emailAddress: { name?: string; address: string } };
  body?: { content: string; contentType: string };
  hasAttachments?: boolean;
};

/**
 * A fake mailbox behind global fetch. `honourTime: false` makes it ignore the
 * received-time filter, so the code's own start line guard is what is tested.
 */
export function installFakeMailbox(messages: FakeMessage[], options: { honourTime?: boolean } = {}) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const original = globalThis.fetch;
  process.env["LOVABLE_API_KEY"] = "test-lovable-key";
  process.env["MICROSOFT_OUTLOOK_API_KEY"] = "test-connection-key";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const json = (v: unknown, status = 200) =>
      new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });
    if (!url.includes("connector-gateway.lovable.dev/microsoft_outlook")) return json({ error: "not faked" }, 404);
    const path = decodeURIComponent(url.split("/microsoft_outlook")[1] ?? "");
    const byId = path.match(/\/messages\/([^/?]+)(\?|$)/);
    if (method === "PATCH" && byId) {
      const m = messages.find((x) => x.id === byId[1]);
      if (!m) return json({ error: "missing" }, 404);
      m.categories = (calls[calls.length - 1]!.body as { categories: string[] }).categories;
      return json(m);
    }
    if (method === "GET" && byId && !path.includes("/attachments")) {
      const m = messages.find((x) => x.id === byId[1]);
      return m ? json(m) : json({ error: "missing" }, 404);
    }
    const filter = path.match(/\$filter=(.*?)&\$top=(\d+)/);
    if (method === "GET" && filter) {
      const f = filter[1]!;
      const top = Number(filter[2]);
      const time = f.match(/receivedDateTime (gt|ge) (\S+)/);
      const tag = f.match(/c:c eq '(.+?)'\)/)?.[1]?.replace(/''/g, "'");
      const hits = messages
        .filter((m) => !tag || m.categories.some((c) => c.toLowerCase() === tag.toLowerCase()))
        .filter((m) => {
          if (options.honourTime === false || !time) return true;
          return time[1] === "gt" ? m.receivedDateTime > time[2]! : m.receivedDateTime >= time[2]!;
        })
        .sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime))
        .slice(0, top);
      return json({ value: hits });
    }
    return json({ value: [] });
  }) as typeof fetch;
  return {
    calls,
    graphCalls: () => calls.filter((c) => c.url.includes("microsoft_outlook")),
    restore() {
      globalThis.fetch = original;
      delete process.env["LOVABLE_API_KEY"];
      delete process.env["MICROSOFT_OUTLOOK_API_KEY"];
    },
  };
}
