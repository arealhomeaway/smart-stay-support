import { businessToday } from "./owner-hours-eligibility";

/** Presentation only; never used to restrict participation or Start. */
export function ownerProgramDisplay(startedOn: string | null, today = businessToday()) {
  const futureStart = startedOn && startedOn.slice(0, 10) > today ? startedOn.slice(0, 10) : null;
  return { futureStart, showCountdown: futureStart === null };
}