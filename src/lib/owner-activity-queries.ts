/** Shared lifecycle predicates for staff and homeowner activity reads. */
export function unarchivedOwnerReviews<T>(query: { is(column: string, value: null): T }): T {
  return query.is("archived_at", null);
}

export function unretiredOwnerWork<T>(query: { is(column: string, value: null): T }): T {
  return query.is("retired_at", null);
}