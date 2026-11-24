import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_ID,
  DEFAULT_FONT_SIZE_ID,
  DEFAULT_MODE_ID,
  DEFAULT_THEME_ID,
  FONT_SIZES,
  FONT_SIZE_STORAGE_KEY,
  MODE_STORAGE_KEY,
  MODES,
  APPEARANCES,
  THEME_STORAGE_KEY,
  THEMES,
  getFontSizeById,
  getThemeById,
  resolveThemeColors,
} from '../constants/themes';

const ThemeContext = createContext(null);

/** "#964F4C" → "150 79 76" for Tailwind alpha support */
function hexToRgbChannels(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function applyThemeVars(colors) {
  const root = document.documentElement;
  const keys = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  keys.forEach((k) => {
    root.style.setProperty(`--brand-${k}`, hexToRgbChannels(colors[k]));
  });
  root.style.setProperty('--brand-sidebar', colors.sidebar);
  root.style.setProperty('--brand-sidebar-active', colors.sidebarActive);
  root.style.setProperty('--brand-sidebar-hover', colors.sidebarHover);
  root.style.setProperty('--brand-sidebar-text', colors.sidebarText);
  root.style.setProperty('--brand-sidebar-muted', colors.sidebarMuted);

  let styleEl = document.getElementById('tusion-brand-overrides');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'tusion-brand-overrides';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    .bg-brand-50 { background-color: ${colors[50]} !important; }
    .bg-brand-100 { background-color: ${colors[100]} !important; }
    .bg-brand-400 { background-color: ${colors[400]} !important; }
    .bg-brand-500 { background-color: ${colors[500]} !important; }
    .bg-brand-600 { background-color: ${colors[600]} !important; }
    .bg-brand-700 { background-color: ${colors[700]} !important; }
    .bg-brand-800 { background-color: ${colors[800]} !important; }
    .bg-brand-900 { background-color: ${colors[900]} !important; }
    .bg-brand-900\\/80 { background-color: ${colors[900]}cc !important; }
    .hover\\:bg-brand-400:hover { background-color: ${colors[400]} !important; }
    .hover\\:bg-brand-50:hover { background-color: ${colors[50]} !important; }
    .hover\\:bg-brand-100:hover { background-color: ${colors[100]} !important; }
    .hover\\:bg-brand-700:hover { background-color: ${colors[700]} !important; }
    .text-brand-200 { color: ${colors[200]} !important; }
    .text-brand-300 { color: ${colors[300]} !important; }
    .text-brand-400 { color: ${colors[400]} !important; }
    .text-brand-600 { color: ${colors[600]} !important; }
    .text-brand-700 { color: ${colors[700]} !important; }
    .border-brand-200 { border-color: ${colors[200]} !important; }
    .border-brand-100 { border-color: ${colors[100]} !important; }
    .focus\\:border-brand-500:focus { border-color: ${colors[500]} !important; }
    .fill-brand-600 { fill: ${colors[600]} !important; }
    .from-brand-800 { --tw-gradient-from: ${colors[800]} var(--tw-gradient-from-position) !important; }
    .to-brand-900 { --tw-gradient-to: ${colors[900]} var(--tw-gradient-to-position) !important; }
  `;
}

function applyFontSize(scale) {
  document.documentElement.style.setProperty('--app-font-scale', String(scale));
}

function resolveMode(modeId) {
  if (modeId === 'day') return 'day';
  if (modeId === 'night') return 'night';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'night';
  }
  return 'day';
}

function applyMode(modeId) {
  const resolved = resolveMode(modeId);
  document.documentElement.dataset.mode = resolved;
  document.documentElement.dataset.modePref = modeId;
}

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(() =>
    readStored(THEME_STORAGE_KEY, DEFAULT_THEME_ID)
  );
  const [fontSizeId, setFontSizeIdState] = useState(() =>
    readStored(FONT_SIZE_STORAGE_KEY, DEFAULT_FONT_SIZE_ID)
  );
  const [modeId, setModeIdState] = useState(() => readStored(MODE_STORAGE_KEY, DEFAULT_MODE_ID));
  const [appearanceId, setAppearanceIdState] = useState(() =>
    readStored(APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE_ID)
  );
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [resolvedMode, setResolvedMode] = useState(() => resolveMode(modeId));

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const fontSize = useMemo(() => getFontSizeById(fontSizeId), [fontSizeId]);
  const colors = useMemo(
    () => resolveThemeColors(theme, appearanceId),
    [theme, appearanceId]
  );

  useEffect(() => {
    applyThemeVars(colors);
  }, [colors]);

  useEffect(() => {
    applyFontSize(fontSize.scale);
  }, [fontSize]);

  useEffect(() => {
    applyMode(modeId);
    setResolvedMode(resolveMode(modeId));
    if (modeId !== 'auto') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyMode('auto');
      setResolvedMode(resolveMode('auto'));
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [modeId]);

  const setThemeId = useCallback((id) => {
    const next = getThemeById(id);
    setThemeIdState(next.id);
    writeStored(THEME_STORAGE_KEY, next.id);
  }, []);

  const setFontSizeId = useCallback((id) => {
    const next = getFontSizeById(id);
    setFontSizeIdState(next.id);
    writeStored(FONT_SIZE_STORAGE_KEY, next.id);
  }, []);

  const setModeId = useCallback((id) => {
    const next = MODES.some((m) => m.id === id) ? id : DEFAULT_MODE_ID;
    setModeIdState(next);
    writeStored(MODE_STORAGE_KEY, next);
  }, []);

  const setAppearanceId = useCallback((id) => {
    const next = APPEARANCES.some((a) => a.id === id) ? id : DEFAULT_APPEARANCE_ID;
    setAppearanceIdState(next);
    writeStored(APPEARANCE_STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      themeId: theme.id,
      theme,
      colors,
      themes: THEMES,
      setThemeId,
      fontSizeId: fontSize.id,
      fontSize,
      fontSizes: FONT_SIZES,
      setFontSizeId,
      modeId,
      resolvedMode,
      modes: MODES,
      setModeId,
      appearanceId,
      appearances: APPEARANCES,
      setAppearanceId,
      customizeOpen,
      openCustomize: () => setCustomizeOpen(true),
      closeCustomize: () => setCustomizeOpen(false),
    }),
    [
      theme,
      colors,
      setThemeId,
      fontSize,
      setFontSizeId,
      modeId,
      resolvedMode,
      setModeId,
      appearanceId,
      setAppearanceId,
      customizeOpen,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

if (typeof document !== 'undefined') {
  try {
    const theme = getThemeById(localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID);
    const appearance = localStorage.getItem(APPEARANCE_STORAGE_KEY) || DEFAULT_APPEARANCE_ID;
    applyThemeVars(resolveThemeColors(theme, appearance));
    applyMode(localStorage.getItem(MODE_STORAGE_KEY) || DEFAULT_MODE_ID);
  } catch {
    applyThemeVars(resolveThemeColors(getThemeById(DEFAULT_THEME_ID), DEFAULT_APPEARANCE_ID));
  }
}
