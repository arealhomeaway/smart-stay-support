import { useEffect, useState, type ReactNode } from "react";
import { readThemePreference, saveThemePreference, themeIsDark, type ThemePreference } from "@/lib/theme";
import { ThemeContext } from "@/lib/theme-context";
import { useTheme } from "@/hooks/useTheme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setTheme(readThemePreference(localStorage)); }
    catch { setTheme("system"); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = themeIsDark(theme, media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, ready]);
  const update = (next: ThemePreference) => {
    setTheme(next);
    try { saveThemePreference(localStorage, next); } catch { /* Storage may be disabled. */ }
  };
  return <ThemeContext.Provider value={{ theme, setTheme: update }}>{children}</ThemeContext.Provider>;
}

export function ThemeControl() {
  const { theme, setTheme } = useTheme();
  return <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <span>Theme</span>
    <select aria-label="Theme" className="min-h-9 rounded-md border border-input bg-background px-2 text-foreground" value={theme}
      onChange={(event) => setTheme(event.target.value as ThemePreference)}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </label>;
}
