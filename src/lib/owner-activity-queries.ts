/** Shared lifecycle predicate for staff and homeowner Opportunity reads. */
export function unretiredOwnerWork<T>(query: { is(column: string, value: null): T }): T {
  return query.is("retired_at", null);
}