/**
 * Who receives a ticket handoff (register T6): a person the sender chose, or the
 * person on shift in the chosen role right now. A role with nobody on shift is
 * refused so the handoff never waits on an empty role. Pure; the ticket's
 * Hand off form reads the role's on shift state and holder from the database.
 */
export type HandoffReceiver = { ok: true; toUser: string } | { ok: false; message: string };

export function nobodyOnShiftMessage(roleName: string): string {
  return `Nobody is on shift as ${roleName} right now. Choose a person or another role.`;
}

export function resolveHandoffReceiver(input: {
  chosenUser: string | null;
  roleName: string;
  onShift: boolean;
  holder: string | null;
  me: string | null;
}): HandoffReceiver {
  if (input.chosenUser) return { ok: true, toUser: input.chosenUser };
  if (input.onShift && input.holder && input.holder !== input.me) return { ok: true, toUser: input.holder };
  return { ok: false, message: nobodyOnShiftMessage(input.roleName) };
}
