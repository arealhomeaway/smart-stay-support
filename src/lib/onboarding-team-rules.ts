/**
 * Plain refusal wording for Project Team saves (Build 17 finding 9). The database's own
 * plain messages pass through; anything else (a permission or database error) becomes one
 * plain sentence, never database text.
 */
const PLAIN = [
  "Only the Onboarding Director or leadership can change the Onboarding team.",
  "That role is not assigned from the Project Team.",
  "That onboarding project was not found.",
  "The project assignment could not be saved.",
  "That person does not have a Resolve account yet.",
];

export function projectTeamRefusal(message: string | null | undefined): string {
  const m = (message ?? "").trim();
  const hit = PLAIN.find((p) => m.includes(p));
  if (hit) return hit;
  return "You cannot change this home's Project Team. Ask the Director of Onboarding.";
}
