import { Platform, useColorScheme } from "react-native";
import { palettes, type Palette } from "@koinonia/shared";

export interface Theme {
  c: Palette;
  dark: boolean;
}

export function useTheme(): Theme {
  const dark = useColorScheme() === "dark";
  return { c: dark ? palettes.dark : palettes.light, dark };
}

/** New York on iOS — a real serif for headings, like the web app's Fraunces. */
export const serif = Platform.select({ ios: "ui-serif", android: "serif", default: "Georgia" });

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
