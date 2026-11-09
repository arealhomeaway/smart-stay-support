/**
 * Home banner photo (register T1): a real home's photo that changes daily.
 * Everyone sees the same home on a given day (America/Chicago date), picked
 * from the homes that have a photo. With none, the banner keeps the stock
 * picture.
 */

export type BannerHome = {
  id: string;
  photo: string;
  name: string;
  city: string | null;
};

/** The calendar day in Central time as a whole day number. */
export function centralDayNumber(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Math.floor(Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000);
}

/** The same home for everyone on a given day; the next day moves to the next home. */
export function dailyHomePhoto(homes: BannerHome[], now: Date): BannerHome | null {
  const usable = homes.filter((h) => h.photo).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (usable.length === 0) return null;
  const day = centralDayNumber(now);
  return usable[((day % usable.length) + usable.length) % usable.length] ?? null;
}

/** The small caption: the home's name and city. */
export function bannerCaption(home: Pick<BannerHome, "name" | "city">): string {
  return [home.name, home.city].filter(Boolean).join(", ");
}
