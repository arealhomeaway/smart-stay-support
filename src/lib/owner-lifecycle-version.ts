export function captureProgramChangeVersion(version: string) {
  return version;
}
export function captureOwnerOfferVersion(context: {
  programId: string;
  expectedVersion: string;
  expectedOwnerId: string;
  expectedSourceUpdatedAt: string;
}) {
  return {
    programId: context.programId,
    expectedVersion: context.expectedVersion,
    expectedOwnerId: context.expectedOwnerId,
    expectedSourceUpdatedAt: context.expectedSourceUpdatedAt,
  };
}
export function sameOwnerOfferVersion(
  a: ReturnType<typeof captureOwnerOfferVersion>,
  b: ReturnType<typeof captureOwnerOfferVersion>,
) {
  return (
    a.programId === b.programId &&
    a.expectedVersion === b.expectedVersion &&
    a.expectedOwnerId === b.expectedOwnerId &&
    a.expectedSourceUpdatedAt === b.expectedSourceUpdatedAt
  );
}
