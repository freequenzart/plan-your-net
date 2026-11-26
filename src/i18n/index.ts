import type { CustomDeviceType, MapMedium } from '../domain/types';
import { GermanMessages } from './locales/de';
import { EnglishMessages, type MessageKey } from './locales/en';
import { AppSettings } from './settings';
export function t(key: MessageKey, values: Record<string, string | number> = {}) {
  const messages = AppSettings.current.language === 'de' ? GermanMessages : EnglishMessages;
  return messages[key].replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}
export function deviceName(type: string, customTypes: readonly CustomDeviceType[] = []) {
  const customName = customTypes.find((entry) => entry.id === type)?.name;
  if (customName) return customName;
  return t(`device.${type}` as MessageKey);
}
export function mediumName(medium: MapMedium) {
  return t(`medium.${medium}` as MessageKey);
}
export function errorMessage(error: unknown) {
  if (error instanceof SyntaxError) return t('error.invalidJson');
  if (error instanceof Error && error.message in EnglishMessages)
    return t(error.message as MessageKey);
  return t('error.importFailed');
}

export { AppSettings } from './settings';
