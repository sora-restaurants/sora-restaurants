// Must match the check constraint on restaurants.theme (migration 20261109000200).
export const THEME_IDS = ["luxury-minimal", "fast-casual-vibrant", "rustic-traditional"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "fast-casual-vibrant";

export function resolveTheme(value: unknown): ThemeId {
  return THEME_IDS.includes(value as ThemeId) ? (value as ThemeId) : DEFAULT_THEME;
}
