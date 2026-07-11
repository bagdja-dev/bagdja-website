export const THEME_MODES = ['light', 'dark'] as const;
export const THEME_ACCENTS = [
  'amber', 'blue', 'emerald', 'rose', 'violet', 'indigo', 'orange', 'teal',
] as const;
export const THEME_PRESETS = ['dark', 'light', 'custom'] as const;
export const HEADING_WEIGHTS = ['500', '600', '700'] as const;
export const BODY_WEIGHTS = ['400', '500'] as const;
export const HEADING_SCALES = ['compact', 'default', 'large'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type ThemeAccent = (typeof THEME_ACCENTS)[number];
export type ThemePreset = (typeof THEME_PRESETS)[number];
export type HeadingWeight = (typeof HEADING_WEIGHTS)[number];
export type BodyWeight = (typeof BODY_WEIGHTS)[number];
export type HeadingScale = (typeof HEADING_SCALES)[number];

export interface ThemeColors {
  background?: string;
  surface?: string;
  text?: string;
  textMuted?: string;
  accent?: string;
  accentHover?: string;
  border?: string;
  onAccent?: string;
}

export interface ThemeTypography {
  headingFont?: string;
  bodyFont?: string;
  headingWeight?: HeadingWeight;
  bodyWeight?: BodyWeight;
  headingScale?: HeadingScale;
}

export interface WebsiteTheme {
  mode?: ThemeMode;
  accent?: ThemeAccent;
  font?: string;
  preset?: ThemePreset;
  colors?: ThemeColors;
  typography?: ThemeTypography;
}

export interface ResolvedTheme {
  colors: Required<ThemeColors>;
  typography: Required<ThemeTypography>;
}

export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter', google: 'Inter:wght@400;500;600;700' },
  { value: 'Poppins', label: 'Poppins', google: 'Poppins:wght@400;500;600;700' },
  { value: 'Roboto', label: 'Roboto', google: 'Roboto:wght@400;500;700' },
  { value: 'Open Sans', label: 'Open Sans', google: 'Open+Sans:wght@400;500;600;700' },
  { value: 'Lato', label: 'Lato', google: 'Lato:wght@400;700' },
  { value: 'Montserrat', label: 'Montserrat', google: 'Montserrat:wght@400;500;600;700' },
  { value: 'Playfair Display', label: 'Playfair Display', google: 'Playfair+Display:wght@400;600;700' },
  { value: 'Merriweather', label: 'Merriweather', google: 'Merriweather:wght@400;700' },
] as const;

const ACCENT_SWATCH: Record<ThemeAccent, string> = {
  amber: '#f59e0b', blue: '#3b82f6', emerald: '#10b981', rose: '#f43f5e',
  violet: '#8b5cf6', indigo: '#6366f1', orange: '#f97316', teal: '#14b8a6',
};

const ACCENT_TOKENS: Record<ThemeAccent, { primary: string; primaryHover: string; onPrimary: string }> = {
  amber: { primary: '#f59e0b', primaryHover: '#d97706', onPrimary: '#09090b' },
  blue: { primary: '#3b82f6', primaryHover: '#2563eb', onPrimary: '#ffffff' },
  emerald: { primary: '#10b981', primaryHover: '#059669', onPrimary: '#ffffff' },
  rose: { primary: '#f43f5e', primaryHover: '#e11d48', onPrimary: '#ffffff' },
  violet: { primary: '#8b5cf6', primaryHover: '#7c3aed', onPrimary: '#ffffff' },
  indigo: { primary: '#6366f1', primaryHover: '#4f46e5', onPrimary: '#ffffff' },
  orange: { primary: '#f97316', primaryHover: '#ea580c', onPrimary: '#ffffff' },
  teal: { primary: '#14b8a6', primaryHover: '#0d9488', onPrimary: '#ffffff' },
};

const MODE_BASE: Record<ThemeMode, Pick<ThemeColors, 'background' | 'surface' | 'text' | 'textMuted' | 'border'>> = {
  dark: { background: '#09090b', surface: '#18181b', text: '#fafafa', textMuted: '#a1a1aa', border: '#27272a' },
  light: { background: '#ffffff', surface: '#f4f4f5', text: '#18181b', textMuted: '#71717a', border: '#e4e4e7' },
};

const DEFAULT_TYPOGRAPHY: Required<ThemeTypography> = {
  headingFont: 'Inter', bodyFont: 'Inter', headingWeight: '600', bodyWeight: '400', headingScale: 'default',
};

const HEADING_SCALE_FACTOR: Record<HeadingScale, number> = { compact: 0.9, default: 1, large: 1.12 };
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

export function normalizeHex(hex: string): string {
  const h = hex.trim();
  if (!HEX_RE.test(h)) return h;
  if (h.length === 4) {
    const [, r, g, b] = h;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return h.toLowerCase();
}

function getLuminance(hex: string): number {
  const n = normalizeHex(hex).slice(1);
  const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const srgb = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function pickOnAccent(accentHex: string): string {
  return getLuminance(accentHex) > 0.4 ? '#09090b' : '#ffffff';
}

export function darkenHex(hex: string, amount = 0.12): string {
  const n = normalizeHex(hex).slice(1);
  const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(f(rgb[0]))}${toHex(f(rgb[1]))}${toHex(f(rgb[2]))}`;
}

function paletteFromModeAccent(mode: ThemeMode, accent: ThemeAccent): Required<ThemeColors> {
  const base = MODE_BASE[mode];
  const a = ACCENT_TOKENS[accent];
  return { ...base, accent: a.primary, accentHover: a.primaryHover, onAccent: a.onPrimary } as Required<ThemeColors>;
}

function sanitizeColors(input: unknown): ThemeColors {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const colors: ThemeColors = {};
  for (const key of ['background', 'surface', 'text', 'textMuted', 'accent', 'accentHover', 'border', 'onAccent'] as const) {
    if (isValidHex(raw[key])) colors[key] = normalizeHex(raw[key] as string);
  }
  return colors;
}

function sanitizeTypography(input: unknown): ThemeTypography {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const typo: ThemeTypography = {};
  const allowed = new Set(FONT_OPTIONS.map((f) => f.value));
  if (typeof raw.headingFont === 'string' && allowed.has(raw.headingFont as typeof FONT_OPTIONS[number]['value'])) typo.headingFont = raw.headingFont;
  if (typeof raw.bodyFont === 'string' && allowed.has(raw.bodyFont as typeof FONT_OPTIONS[number]['value'])) typo.bodyFont = raw.bodyFont;
  if ((HEADING_WEIGHTS as readonly string[]).includes(raw.headingWeight as string)) typo.headingWeight = raw.headingWeight as HeadingWeight;
  if ((BODY_WEIGHTS as readonly string[]).includes(raw.bodyWeight as string)) typo.bodyWeight = raw.bodyWeight as BodyWeight;
  if ((HEADING_SCALES as readonly string[]).includes(raw.headingScale as string)) typo.headingScale = raw.headingScale as HeadingScale;
  return typo;
}

export function sanitizeWebsiteTheme(input: unknown): WebsiteTheme {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const theme: WebsiteTheme = {};
  if ((THEME_MODES as readonly string[]).includes(raw.mode as string)) theme.mode = raw.mode as ThemeMode;
  if ((THEME_ACCENTS as readonly string[]).includes(raw.accent as string)) theme.accent = raw.accent as ThemeAccent;
  if ((THEME_PRESETS as readonly string[]).includes(raw.preset as string)) theme.preset = raw.preset as ThemePreset;
  if (typeof raw.font === 'string' && raw.font.trim()) theme.font = raw.font.trim();
  const colors = sanitizeColors(raw.colors);
  if (Object.keys(colors).length > 0) theme.colors = colors;
  const typography = sanitizeTypography(raw.typography);
  if (Object.keys(typography).length > 0) theme.typography = typography;
  return theme;
}

export function extractTemplateTheme(structure: Record<string, unknown> | null | undefined): WebsiteTheme {
  if (!structure?.theme || typeof structure.theme !== 'object') return {};
  return sanitizeWebsiteTheme(structure.theme);
}

function deriveColorsFromTheme(theme: WebsiteTheme): Required<ThemeColors> {
  if (theme.colors && Object.keys(theme.colors).length > 0) {
    const fallback = paletteFromModeAccent(theme.mode ?? 'dark', theme.accent ?? 'amber');
    const merged = { ...fallback, ...theme.colors };
    if (!merged.onAccent && merged.accent) merged.onAccent = pickOnAccent(merged.accent);
    if (!merged.accentHover && merged.accent) merged.accentHover = darkenHex(merged.accent);
    return merged as Required<ThemeColors>;
  }
  return paletteFromModeAccent(theme.mode ?? 'dark', theme.accent ?? 'amber');
}

export function resolveTheme(templateTheme: WebsiteTheme = {}, websiteTheme: WebsiteTheme = {}): ResolvedTheme {
  const merged: WebsiteTheme = { ...templateTheme, ...websiteTheme };
  if (websiteTheme.colors) merged.colors = { ...templateTheme.colors, ...websiteTheme.colors };
  if (websiteTheme.typography) merged.typography = { ...templateTheme.typography, ...websiteTheme.typography };
  const legacyFont = merged.font ?? merged.typography?.bodyFont;
  return {
    colors: deriveColorsFromTheme(merged),
    typography: {
      ...DEFAULT_TYPOGRAPHY,
      ...merged.typography,
      bodyFont: merged.typography?.bodyFont ?? legacyFont ?? DEFAULT_TYPOGRAPHY.bodyFont,
      headingFont: merged.typography?.headingFont ?? legacyFont ?? DEFAULT_TYPOGRAPHY.headingFont,
    },
  };
}

export function mergeWebsiteTheme(templateTheme: WebsiteTheme, websiteTheme: WebsiteTheme): WebsiteTheme {
  return { ...templateTheme, ...websiteTheme };
}

export function getGoogleFontsUrl(typography: ThemeTypography): string | null {
  const families = new Set<string>();
  for (const font of [typography.headingFont, typography.bodyFont]) {
    const opt = FONT_OPTIONS.find((f) => f.value === font);
    if (opt) families.add(opt.google);
  }
  if (families.size === 0) return null;
  return `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join('&')}&display=swap`;
}

export function themeToCssVariables(resolved: ResolvedTheme): Record<string, string | number> {
  const { colors, typography } = resolved;
  return {
    '--brand-bg': colors.background,
    '--brand-text': colors.text,
    '--brand-muted': colors.textMuted,
    '--brand-surface': colors.surface,
    '--brand-border': colors.border,
    '--brand-accent': colors.accent,
    '--brand-accent-hover': colors.accentHover,
    '--brand-accent-muted': colors.accent,
    '--brand-accent-border': `${colors.accent}66`,
    '--brand-on-accent': colors.onAccent,
    '--font-heading': `'${typography.headingFont}', system-ui, sans-serif`,
    '--font-body': `'${typography.bodyFont}', system-ui, sans-serif`,
    '--font-heading-weight': typography.headingWeight,
    '--font-body-weight': typography.bodyWeight,
    '--heading-scale': HEADING_SCALE_FACTOR[typography.headingScale ?? 'default'],
  };
}

const COLOR_PARAM_MAP: Record<keyof ThemeColors, string> = {
  background: 'c_bg', surface: 'c_surface', text: 'c_text', textMuted: 'c_muted',
  accent: 'c_accent', accentHover: 'c_accent_h', border: 'c_border', onAccent: 'c_on_accent',
};

export function parseThemeFromSearchParams(params: Record<string, string | undefined>): WebsiteTheme {
  const theme: WebsiteTheme = { preset: 'custom' };
  const colors: ThemeColors = {};
  for (const [key, param] of Object.entries(COLOR_PARAM_MAP) as [keyof ThemeColors, string][]) {
    const raw = params[param];
    if (raw && /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw)) {
      colors[key] = normalizeHex(raw.startsWith('#') ? raw : `#${raw}`);
    }
  }
  if (Object.keys(colors).length > 0) theme.colors = colors;
  const typo: ThemeTypography = {};
  if (params.tf_head) typo.headingFont = params.tf_head.replace(/\+/g, ' ');
  if (params.tf_body) typo.bodyFont = params.tf_body.replace(/\+/g, ' ');
  if (params.tw_head && (HEADING_WEIGHTS as readonly string[]).includes(params.tw_head)) typo.headingWeight = params.tw_head as HeadingWeight;
  if (params.tw_body && (BODY_WEIGHTS as readonly string[]).includes(params.tw_body)) typo.bodyWeight = params.tw_body as BodyWeight;
  if (params.ts_scale && (HEADING_SCALES as readonly string[]).includes(params.ts_scale)) typo.headingScale = params.ts_scale as HeadingScale;
  if (Object.keys(typo).length > 0) theme.typography = typo;
  if (!theme.colors) {
    if (params.theme_mode === 'light' || params.theme_mode === 'dark') theme.mode = params.theme_mode;
    if (params.theme_accent && (THEME_ACCENTS as readonly string[]).includes(params.theme_accent)) {
      theme.accent = params.theme_accent as ThemeAccent;
    }
  }
  return theme;
}

export { ACCENT_SWATCH };
