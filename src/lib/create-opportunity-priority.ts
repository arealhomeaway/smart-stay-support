/** Retain a saved Opportunity if the existing priority action fails, so Retry never creates a second one. */
export class OpportunityCreationReceipt {
  private id: string | null = null;
  async save<T extends { id: string | null; send: boolean }>(
    input: T, priority: boolean,
    save: (input: T) => Promise<{ id: string }>,
    setAttention: (id: string, on: boolean) => Promise<unknown>,
  ) {
    const saved = await save({ ...input, id: input.id ?? this.id });
    this.id = saved.id;
    if (input.send && priority) await setAttention(saved.id, true);
    return saved;
  }
}