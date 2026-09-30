/**
 * Property market → Vendor Directory market code. Property records use
 * city-style names in places ("Fort Worth") while vendors are grouped by
 * market code ("DFW"). Without this, a Ticket opens the picker on a market
 * with no vendors and wrongly reports "no eligible vendor".
 * Only unambiguous aliases live here; anything else passes through unchanged.
 */
const ALIASES: Record<string, string> = {
  "fort worth": "DFW",
  dallas: "DFW",
  "dallas-fort worth": "DFW",
  okc: "OKC",
  "oklahoma city": "OKC",
  tulsa: "Tulsa",
  indy: "Indy",
  indianapolis: "Indy",
  houston: "Houston",
  eufaula: "Eufaula",
};

export function vendorMarketFor(propertyMarket: string | null | undefined): string | null {
  const raw = propertyMarket?.trim();
  if (!raw) return null;
  return ALIASES[raw.toLowerCase()] ?? raw;
}
