export type OwnerActivationContext = {
  programId: string;
  reportVersion: string;
  status: string;
  startedOn: string | null;
  dfyConfirmed: boolean;
  properties: {
    propertyId: string;
    name: string;
    closingDate: string | null;
    closingConfirmed: boolean;
    inclusionStatus: string;
  }[];
};

export function captureOwnerActivation(context: OwnerActivationContext, startedOn: string) {
  return {
    programId: context.programId,
    expectedVersion: context.reportVersion,
    status: context.status,
    dfyConfirmed: context.dfyConfirmed,
    properties: context.properties
      .filter((property) => property.inclusionStatus === "included")
      .map((property) => ({
        propertyId: property.propertyId,
        name: property.name,
        closingDate: property.closingDate,
        closingConfirmed: property.closingConfirmed,
      })),
    startedOn,
  };
}

export type OwnerActivationDraft = ReturnType<typeof captureOwnerActivation>;
