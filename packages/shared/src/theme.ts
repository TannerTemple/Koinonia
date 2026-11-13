/**
 * Design tokens shared by web (as CSS variables) and mobile (as a theme object).
 * Marian blue leads; lush forest belongs to the prayer side; gold marks streaks.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  onPrimary: string;
  forest: string;
  forestStrong: string;
  forestSoft: string;
  gold: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  /** Deep hero panels (Today header, daily intention). */
  hero: string;
  heroForest: string;
  onHero: string;
  onHeroMuted: string;
}

export const lightPalette: Palette = {
  bg: "#F6F3EC",
  surface: "#FFFFFF",
  surfaceAlt: "#EFEBE1",
  border: "#DDD7C9",
  text: "#16203A",
  textMuted: "#5C6479",
  primary: "#2B4C9B",
  primaryStrong: "#1D3672",
  primarySoft: "#E3E9F7",
  onPrimary: "#FFFFFF",
  forest: "#1F5D43",
  forestStrong: "#15432F",
  forestSoft: "#DFEDE5",
  gold: "#B8862B",
  goldSoft: "#F6EBD0",
  danger: "#B3372F",
  dangerSoft: "#F8E3E0",
  hero: "#1B2F66",
  heroForest: "#143B2B",
  onHero: "#FFFFFF",
  onHeroMuted: "#C5D0EC",
};

export const darkPalette: Palette = {
  bg: "#0B1020",
  surface: "#141B30",
  surfaceAlt: "#1B2440",
  border: "#2A3555",
  text: "#EEF1F9",
  textMuted: "#9AA5C2",
  primary: "#7D9BEA",
  primaryStrong: "#A5BBF3",
  primarySoft: "#1F2D57",
  onPrimary: "#0B1020",
  forest: "#5DB991",
  forestStrong: "#8AD3B1",
  forestSoft: "#16352A",
  gold: "#E0B458",
  goldSoft: "#3A2E14",
  danger: "#F0857C",
  dangerSoft: "#42201D",
  hero: "#1B2F66",
  heroForest: "#143B2B",
  onHero: "#FFFFFF",
  onHeroMuted: "#C5D0EC",
};

export const palettes = { light: lightPalette, dark: darkPalette } as const;
export type ColorScheme = keyof typeof palettes;

/** Stable, pleasant avatar color per person. */
const AVATAR_COLORS = ["#2B4C9B", "#1F5D43", "#8A4B2D", "#6B3F8C", "#1E6B7A", "#9A3B52", "#5A6B1F"];
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return (first + last).toUpperCase();
}
