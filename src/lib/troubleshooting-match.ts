/**
 * Picks the approved troubleshooting guide for a Ticket. Guides are keyed by
 * a short `category` (e.g. "wifi"); a Ticket matches when its own category
 * equals the key or its title/description names the device. No match = no
 * guide — Resolve never invents troubleshooting.
 */
export const GUIDE_KEYWORDS: Record<string, string[]> = {
  door_lock: ["lock", "keypad", "door code", "smart lock", "locked out", "deadbolt", "can't get in"],
  wifi: ["wifi", "wi-fi", "internet", "router", "modem"],
  thermostat_hvac: ["thermostat", "hvac", " ac ", "a/c", "air conditioning", "heat", "furnace", "no cool air"],
  refrigerator: ["fridge", "refrigerator", "freezer"],
  tv_streaming: ["tv", "television", "roku", "netflix", "streaming", "remote", "firestick"],
  dishwasher: ["dishwasher"],
  washer_dryer: ["washer", "dryer", "laundry", "washing machine"],
  hot_water: ["hot water", "water heater", "no hot", "cold water only"],
  toilet: ["toilet", "clogged", "clog"],
  power: ["power", "breaker", "gfci", "outlet", "no electricity", "lights out"],
};

export function guideKeyFor(text: string | null | undefined, category?: string | null): string | null {
  if (category && GUIDE_KEYWORDS[category]) return category;
  const hay = ` ${(text ?? "").toLowerCase()} `;
  for (const [key, words] of Object.entries(GUIDE_KEYWORDS)) {
    if (words.some((w) => hay.includes(w))) return key;
  }
  return null;
}
