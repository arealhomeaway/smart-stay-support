/** Browser-safe shapes for the two property entry paths. */

export type IntakeMatch = {
  id: string;
  name: string;
  address: string | null;
  lifecycleStatus: string;
  ownerRezId: string | null;
  isDemo: boolean;
};

export type OwnerRezCandidate = {
  listingId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  /** Already in Resolve on the OwnerRez ID — importing is blocked. */
  existing: IntakeMatch | null;
  /** Same name/address but no OwnerRez ID yet — offer to link instead. */
  likely: IntakeMatch | null;
};

export type IntakeResult =
  | { status: "duplicate"; property: IntakeMatch }
  | { status: "linked"; property: IntakeMatch }
  | { status: "created"; property: IntakeMatch };
