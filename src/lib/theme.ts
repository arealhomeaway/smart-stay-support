export type ThemePreference = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "resolve.theme";

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function themeIsDark(theme: ThemePreference, systemDark: boolean) {
  return theme === "dark" || (theme === "system" && systemDark);
}

export function readThemePreference(storage: Pick<Storage, "getItem">): ThemePreference {
  return parseTheme(storage.getItem(THEME_STORAGE_KEY) ?? storage.getItem("preferred-theme"));
}

export function saveThemePreference(storage: Pick<Storage, "setItem" | "removeItem">, theme: ThemePreference) {
  storage.setItem(THEME_STORAGE_KEY, theme);
  storage.removeItem("preferred-theme");
}

// Runs before the stylesheet paints. The old queue-only key is read once for continuity.
export const THEME_BOOTSTRAP = `(function(){try{var value=localStorage.getItem("${THEME_STORAGE_KEY}");if(!value){value=localStorage.getItem("preferred-theme")||"system"}var dark=value==="dark"||(value!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light"}catch(e){}})();`;
