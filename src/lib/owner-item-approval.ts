/**
 * Fix 24: the homeowner's Approve on an owner item. Calls are made as methods of the database
 * client (never a detached `client.rpc`), so supabase-js keeps `this.rest`.
 */
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

const message = (error: unknown, fallback: string) => (error as { message?: string } | null)?.message || fallback;

export function ownerItemApproval(client: RpcClient) {
  return {
    /** Whether the homeowner is asked to approve this owner item. */
    async isApproval(reviewId: string): Promise<boolean> {
      const { data, error } = await client.rpc("owner_item_is_approval", { _review_id: reviewId });
      if (error) throw new Error(message(error, "Could not check this item."));
      return data === true;
    },
    /** Records the approval; the database marks the linked Task approved. */
    async approve(reviewId: string): Promise<void> {
      const { error } = await client.rpc("owner_item_approve", { _review_id: reviewId });
      if (error) throw new Error(message(error, "Your approval was not recorded."));
    },
  };
}
