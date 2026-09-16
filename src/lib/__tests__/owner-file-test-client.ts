type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code?: string } | null };

/** In-memory endpoint double. It never imports credentials or contacts storage. */
export function ownerFileTestClient(initial: Record<string, Row[]> = {}) {
  const rows = structuredClone(initial);
  const reads: string[] = [];
  const writes: { table: string; operation: string; values: Row }[] = [];
  const storage: { operation: string; path: string; upsert?: boolean }[] = [];
  const rpcCalls: { name: string; args: Row }[] = [];
  let rpc: (name: string, args: Row) => Result = (name, args) => ({
    data:
      name === "owner_document_access"
        ? !!rows["documents"]?.some(
            (row) =>
              row["id"] === args["_document_id"] &&
              row["owner_recipient_id"] &&
              row["owner_recipient_program_id"],
          )
        : true,
    error: null,
  });
  let beforeWrite: ((table: string, values: Row) => void) | undefined;
  let writeError: { message: string; code?: string } | null = null;

  const client = {
    rpc: async (name: string, args: Row) => {
      rpcCalls.push({ name, args });
      return rpc(name, args);
    },
    from: (table: string) => {
      reads.push(table);
      const predicates: ((row: Row) => boolean)[] = [];
      let operation = "read";
      let values: Row = {};
      let max = Infinity;
      const result = () => {
        if (operation !== "read") {
          beforeWrite?.(table, values);
          writes.push({ table, operation, values });
          if (writeError) return { data: [], error: writeError };
        }
        let matching = (rows[table] ?? [])
          .filter((row) => predicates.every((p) => p(row)))
          .slice(0, max);
        if (operation === "insert") {
          const row = { id: "created-document", archived_at: null, deleted_at: null, ...values };
          (rows[table] ??= []).push(row);
          matching = [row];
        }
        if (operation === "update") matching.forEach((row) => Object.assign(row, values));
        return { data: matching.map((row) => ({ ...row })), error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          // Joined canonical identity is tested in the DB fixture; candidates
          // here still have to pass the real endpoint's scope RPC.
          if (!key.includes(".")) predicates.push((row) => row[key] === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          predicates.push((row) => values.includes(row[key]));
          return query;
        },
        is: (key: string, value: unknown) => {
          predicates.push((row) => (value === null ? row[key] == null : row[key] === value));
          return query;
        },
        or: () => query,
        order: () => query,
        limit: (count: number) => {
          max = count;
          return query;
        },
        insert: (input: Row) => {
          operation = "insert";
          values = input;
          return query;
        },
        update: (input: Row) => {
          operation = "update";
          values = input;
          return query;
        },
        delete: () => {
          operation = "delete";
          return query;
        },
        maybeSingle: async () => {
          const r = result();
          return { ...r, data: r.data[0] ?? null };
        },
        single: async () => {
          const r = result();
          return { ...r, data: r.data[0] ?? null };
        },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(resolve(result())),
      };
      return query;
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => {
          storage.push({ operation: "read-url", path });
          return { data: { signedUrl: "https://example.invalid/signed" }, error: null };
        },
        createSignedUploadUrl: async (path: string, options: { upsert: boolean }) => {
          storage.push({ operation: "upload-url", path, upsert: options.upsert });
          return {
            data: { signedUrl: "https://example.invalid/upload", token: "test-token" },
            error: null,
          };
        },
        remove: async (paths: string[]) => {
          paths.forEach((path) => storage.push({ operation: "remove", path }));
          return { data: [], error: null };
        },
      }),
    },
  };
  return {
    client,
    rows,
    reads,
    writes,
    storage,
    rpcCalls,
    setRpc: (fn: typeof rpc) => {
      rpc = fn;
    },
    setBeforeWrite: (fn: typeof beforeWrite) => {
      beforeWrite = fn;
    },
    setWriteError: (value: typeof writeError) => {
      writeError = value;
    },
  };
}

export const ownerFileViewer = { userId: "owner", roles: ["owner"] };
export const uploadKey = "11111111-1111-4111-8111-111111111111";
export const uploadInput = {
  entityType: "property" as const,
  entityId: "property",
  uploadKey,
  filename: "deed.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  fulfilsRequestId: "request",
};
export function attachmentRow(over: Row = {}): Row {
  return {
    id: "file",
    title: "Shared document",
    original_filename: "deed.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    kind: "document",
    visibility: "owner_shared",
    requested_from: null,
    upload_status: "stored",
    uploaded_by: "owner",
    uploaded_at: "2026-09-16T12:00:00Z",
    entity_type: "property",
    entity_id: "property",
    property_id: "property",
    note: null,
    category: "ownership",
    created_at: "2026-09-16T11:00:00Z",
    is_demo: false,
    archived_at: null,
    deleted_at: null,
    upload_key: uploadKey,
    owner_recipient_id: "canonical-owner",
    owner_recipient_program_id: "program",
    fulfils_request_id: "request",
    storage_path: `property/property/${uploadKey}-deed.pdf`,
    ...over,
  };
}
export function requestRow(over: Row = {}): Row {
  return attachmentRow({
    id: "request",
    requested_from: "owner",
    uploaded_by: null,
    upload_status: "pending",
    upload_key: null,
    storage_path: null,
    note: "Please provide the recorded deed.",
    ...over,
  });
}
export function propertyRow(over: Row = {}): Row {
  return { id: "property", name: "Owner home", is_demo: false, archived_at: null, ...over };
}
