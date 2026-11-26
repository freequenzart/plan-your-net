import type { AppLanguage, AppTheme, MapDocument } from '../domain/types';
import { validate } from '../domain/validation';

export const storageKeys = {
  document: 'netmap.document.v1',
  preferences: 'netmap.preferences.v1',
} as const;

export function loadDocument(storage: Pick<Storage, 'getItem'> = localStorage): MapDocument | null {
  const saved = storage.getItem(storageKeys.document);
  return saved === null ? null : validate(JSON.parse(saved));
}

export function saveDocument(
  model: MapDocument,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(storageKeys.document, JSON.stringify(model));
}

export function loadPreferences(storage: Pick<Storage, 'getItem'> = localStorage): unknown {
  return JSON.parse(storage.getItem(storageKeys.preferences) || '{}');
}

export function savePreferences(
  preferences: { language: AppLanguage; theme: AppTheme },
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(storageKeys.preferences, JSON.stringify(preferences));
}
