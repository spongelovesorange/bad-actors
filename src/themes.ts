/**
 * Theme catalog.
 *
 * The scaffold ships two placeholder themes: `slate` (dark default, defined
 * in styles.css) and `paper` (light example, defined in themes.css). They
 * are scaffolding, not a design — give the app its own theme before first
 * deploy:
 *   1. Add a `[data-theme="my-id"] { ... }` block in src/themes.css with
 *      the shadcn token overrides (include `color-scheme: light;` for
 *      light themes).
 *   2. Add an entry here for type safety, autocomplete, and UI display.
 *   3. Add the theme's background to the first-paint <style> block in
 *      index.html so the pre-CSS frame matches (no white flash).
 *   4. Switch via `data-theme` on <html> in index.html.
 *
 * Color values live in styles.css / themes.css — this file is metadata only.
 */

export const THEMES = [
  { id: 'theater', label: 'Theater', description: 'Warm rehearsal paper and burgundy stage curtains.' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export function getActiveTheme(): ThemeId { return 'theater' }
export function getTheme(id: string) { return THEMES.find(theme => theme.id === id) ?? THEMES[0] }
