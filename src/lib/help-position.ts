/**
 * Where Help and feedback sits. A drawer or window that is open would cover the usual
 * bottom right corner, so the button moves to the side the drawer leaves free and stays
 * above it (register H6). Null when nothing is open.
 */
export function helpSideFor(
  open: { left: number; right: number }[],
  viewportWidth: number,
): "left" | "right" | null {
  if (!open.length) return null;
  const coversRight = open.some((r) => r.right > viewportWidth - 72);
  const coversLeft = open.some((r) => r.left < 72);
  if (coversRight && !coversLeft) return "left";
  if (!coversLeft && !coversRight) return "right";
  if (coversLeft && !coversRight) return "right";
  // A full width sheet on a phone: bottom left, above the sheet.
  return "left";
}
