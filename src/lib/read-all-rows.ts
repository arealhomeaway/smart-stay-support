/** Adapter for a counted, ordered Supabase query; range is replaced for each sequential page. */
export function readCountedRows<T>(query: {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>;
}) {
  return readAllRows((from, to) => query.range(from, to));
}

/** Read a counted, deterministically ordered query without assuming the backend row cap. */
export async function readAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
) {
  const data: T[] = [];
  let total: number | undefined;
  do {
    const result = await page(data.length, data.length + 499);
    if (result.error) throw result.error;
    if (result.count === null || result.count < 0)
      throw new Error("The complete record count could not be verified.");
    if (total !== undefined && total !== result.count)
      throw new Error("Records changed while loading. Refresh before continuing.");
    total = result.count;
    const rows = result.data ?? [];
    if ((rows.length === 0 && data.length < total) || data.length + rows.length > total) {
      throw new Error("The complete record set could not be loaded.");
    }
    data.push(...rows);
  } while (data.length < total);
  return { data, error: null };
}
