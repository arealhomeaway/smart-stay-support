/**
 * One photo per homeowner plan card, by card code (approved mockup, Nov 16). Browser-safe:
 * Vite turns each file into its own URL. A code with no photo falls back to the caller's cover.
 */
const files = import.meta.glob("../assets/cards/*.jpg", { eager: true, import: "default" }) as Record<string, string>;

const byCode = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const code = /\/([a-z]\d{2})\.jpg$/i.exec(path)?.[1];
  if (code) byCode.set(code.toUpperCase(), url);
}

export function cardPhoto(code: string | null | undefined): string | null {
  return byCode.get((code ?? "").trim().toUpperCase()) ?? null;
}

/** Every card code that has its own photo (for the uniqueness test). */
export function cardPhotoCodes(): string[] {
  return [...byCode.keys()].sort();
}
