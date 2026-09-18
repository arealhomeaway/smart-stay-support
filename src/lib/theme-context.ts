import { createContext } from "react";
import type { ThemePreference } from "./theme";

export type ThemeContextValue = { theme: ThemePreference; setTheme: (theme: ThemePreference) => void };
export const ThemeContext = createContext<ThemeContextValue | null>(null);
