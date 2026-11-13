import { palettes, type Palette } from "@koinonia/shared";

export type ThemeChoice = "system" | "light" | "dark";
const THEME_KEY = "koinonia.theme";

const vars = (p: Palette) =>
  Object.entries(p)
    .map(([key, value]) => `--k-${key}:${value}`)
    .join(";");

/** CSS variables for both palettes, generated from the shared design tokens. */
export const themeCss = `
:root{${vars(palettes.light)};color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(palettes.dark)};color-scheme:dark}}
:root[data-theme="dark"]{${vars(palettes.dark)};color-scheme:dark}
`;

/** Runs before paint so a saved light/dark choice never flashes. */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function getThemeChoice(): ThemeChoice {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* ignore */
  }
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}
