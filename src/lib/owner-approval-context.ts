export type ApprovalPublicationVersion = {
  approvalId: string;
  expectedUpdatedAt: string;
  expectedRevision: number;
  programId: string | null;
  ownerId: string | null;
  recipientId: string | null;
};
export function captureApprovalPublicationVersion(
  value: ApprovalPublicationVersion,
): ApprovalPublicationVersion {
  return {
    approvalId: value.approvalId,
    expectedUpdatedAt: value.expectedUpdatedAt,
    expectedRevision: value.expectedRevision,
    programId: value.programId,
    ownerId: value.ownerId,
    recipientId: value.recipientId,
  };
}
export function sameApprovalPublicationVersion(
  a: ApprovalPublicationVersion,
  b: ApprovalPublicationVersion,
) {
  return (
    a.approvalId === b.approvalId &&
    a.expectedUpdatedAt === b.expectedUpdatedAt &&
    a.expectedRevision === b.expectedRevision &&
    a.programId === b.programId &&
    a.ownerId === b.ownerId &&
    a.recipientId === b.recipientId
  );
}
export function captureOwnerDecisionVersion(value: {
  updated_at: string;
  publication_id: string | null;
}) {
  return { updatedAt: value.updated_at, publicationId: value.publication_id };
}
