import type { AppLanguage, AppTheme } from '../domain/types';
import { loadPreferences, savePreferences } from '../services/storage';
export const AppSettings = (() => {
  const current: {
    language: AppLanguage;
    theme: AppTheme;
  } = {
    language: navigator.language.startsWith('de') ? 'de' : 'en',
    theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
  try {
    const saved = loadPreferences();
    if (saved && typeof saved === 'object') {
      if ('language' in saved && (saved.language === 'de' || saved.language === 'en'))
        current.language = saved.language;
      if ('theme' in saved && (saved.theme === 'light' || saved.theme === 'dark'))
        current.theme = saved.theme;
    }
  } catch {}
  function apply() {
    document.documentElement.lang = current.language;
    document.documentElement.dataset.theme = current.theme;
  }
  function save() {
    apply();
    try {
      savePreferences(current);
      return true;
    } catch {
      return false;
    }
  }
  return { current, apply, save };
})();
