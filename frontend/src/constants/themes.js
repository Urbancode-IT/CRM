/** Theme presets — circular swatches like product customize panel. */

export const THEME_STORAGE_KEY = 'tusion.themeId';
export const FONT_SIZE_STORAGE_KEY = 'tusion.fontSizeId';
export const MODE_STORAGE_KEY = 'tusion.mode';
export const APPEARANCE_STORAGE_KEY = 'tusion.appearance';

export const FONT_SIZES = [
  { id: 'small', name: 'Small', description: 'Compact text', scale: 0.9 },
  { id: 'medium', name: 'Medium', description: 'Default size', scale: 1 },
  { id: 'large', name: 'Large', description: 'Easier to read', scale: 1.1 },
  { id: 'xlarge', name: 'Extra large', description: 'Maximum comfort', scale: 1.2 },
];

export const DEFAULT_FONT_SIZE_ID = 'medium';
export const DEFAULT_THEME_ID = 'ocean';
export const DEFAULT_MODE_ID = 'auto';
export const DEFAULT_APPEARANCE_ID = 'dark';

export const MODES = [
  { id: 'day', name: 'Day', icon: 'sun' },
  { id: 'night', name: 'Night', icon: 'moon' },
  { id: 'auto', name: 'Auto', icon: 'monitor' },
];

export const APPEARANCES = [
  { id: 'dark', name: 'Dark' },
  { id: 'lite', name: 'Lite' },
];

export function getFontSizeById(id) {
  return FONT_SIZES.find((f) => f.id === id) || FONT_SIZES[1];
}

/** Build a full brand scale from a primary (~600) hex. */
function scaleFromPrimary(primary, sidebarDark, sidebarLite) {
  return {
    50: lighten(primary, 0.92),
    100: lighten(primary, 0.84),
    200: lighten(primary, 0.68),
    300: lighten(primary, 0.48),
    400: lighten(primary, 0.28),
    500: lighten(primary, 0.12),
    600: primary,
    700: darken(primary, 0.14),
    800: darken(primary, 0.28),
    900: darken(primary, 0.42),
    sidebarDark,
    sidebarLite,
    sidebarActiveDark: primary,
    sidebarActiveLite: primary,
  };
}

function hexToRgb(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount
  );
}

function lighten(hex, amount) {
  return mix(hex, '#ffffff', amount);
}

function darken(hex, amount) {
  return mix(hex, '#000000', amount);
}

export const THEMES = [
  {
    id: 'navy',
    name: 'Navy',
    swatch: '#1e3a5f',
    colors: scaleFromPrimary('#2549d1', '#0b1c2e', '#e8eef8'),
  },
  {
    id: 'teal',
    name: 'Teal',
    swatch: '#0d9488',
    colors: scaleFromPrimary('#0f766e', '#0a2422', '#e6f5f3'),
  },
  {
    id: 'green',
    name: 'Green',
    swatch: '#16a34a',
    colors: scaleFromPrimary('#15803d', '#0f2418', '#e8f6ec'),
  },
  {
    id: 'olive',
    name: 'Olive',
    swatch: '#65a30d',
    colors: scaleFromPrimary('#4d7c0f', '#1a220c', '#f0f6e6'),
  },
  {
    id: 'gold',
    name: 'Gold',
    swatch: '#ca8a04',
    colors: scaleFromPrimary('#a16207', '#2a1c10', '#faf4e8'),
  },
  {
    id: 'orange',
    name: 'Orange',
    swatch: '#ea580c',
    colors: scaleFromPrimary('#c2410c', '#2a1408', '#fff1e8'),
  },
  {
    id: 'red',
    name: 'Red',
    swatch: '#dc2626',
    colors: scaleFromPrimary('#b91c1c', '#2a0c0c', '#fceceb'),
  },
  {
    id: 'marsala',
    name: 'Burgundy',
    swatch: '#800020',
    colors: scaleFromPrimary('#800020', '#1a0810', '#faf4f5'),
  },
  {
    id: 'purple',
    name: 'Purple',
    swatch: '#9333ea',
    colors: scaleFromPrimary('#7e22ce', '#1a0f24', '#f5edfb'),
  },
  {
    id: 'violet',
    name: 'Violet',
    swatch: '#7c3aed',
    colors: scaleFromPrimary('#6d28d9', '#160f2a', '#f3edfc'),
  },
  {
    id: 'ocean',
    name: 'Royal Blue',
    swatch: '#2563eb',
    colors: scaleFromPrimary('#1d4ed8', '#0b1c2e', '#eef4ff'),
  },
  {
    id: 'sky',
    name: 'Sky',
    swatch: '#0ea5e9',
    colors: scaleFromPrimary('#0284c7', '#0a1e2a', '#e8f6fc'),
  },
  {
    id: 'brown',
    name: 'Brown',
    swatch: '#92400e',
    colors: scaleFromPrimary('#78350f', '#1f1208', '#f8efe6'),
  },
];

export function getThemeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_THEME_ID) || THEMES[0];
}

/** Resolve runtime color tokens for sidebar + brand scale. */
export function resolveThemeColors(theme, appearance = DEFAULT_APPEARANCE_ID) {
  const c = theme.colors;
  const isLite = appearance === 'lite';
  const sidebar = isLite ? c.sidebarLite : c.sidebarDark;
  const sidebarActive = isLite ? c.sidebarActiveLite : c.sidebarActiveDark;
  return {
    50: c[50],
    100: c[100],
    200: c[200],
    300: c[300],
    400: c[400],
    500: c[500],
    600: c[600],
    700: c[700],
    800: c[800],
    900: c[900],
    sidebar,
    sidebarActive,
    sidebarHover: isLite ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
    sidebarText: isLite ? '#1e293b' : '#f0e8ec',
    sidebarMuted: isLite ? '#64748b' : '#b89aa3',
  };
}
