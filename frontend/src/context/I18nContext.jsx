import { createContext, useContext, useMemo, useState } from 'react';
import { t as translate } from '../i18n/messages';
import { useAuth } from './AuthContext';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const { user } = useAuth();
  const [langOverride, setLangOverride] = useState(() => localStorage.getItem('tusion_lang') || '');
  const language = langOverride || user?.language || 'en-US';

  const value = useMemo(
    () => ({
      language,
      setLanguage(next) {
        localStorage.setItem('tusion_lang', next);
        setLangOverride(next);
      },
      t(key) {
        return translate(language, key);
      },
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
