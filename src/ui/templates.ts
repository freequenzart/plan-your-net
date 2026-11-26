import { AppSettings, t } from '../i18n';
import type { MessageKey } from '../i18n/locales/en';
import { html } from './html';
import { icon } from './icons';
export { icon } from './icons';
export function iconButton(action: string, name: string, label: string, extra: string = '') {
  return `<button type="button" class="icon-button" data-action="${action}" title="${html(label)}" aria-label="${html(label)}" ${extra}>${icon(name)}</button>`;
}

export function options(values: string[], selected: string) {
  return values
    .map((value) => `<option ${value === selected ? 'selected' : ''}>${html(value)}</option>`)
    .join('');
}

export function inputField(
  name: string,
  label: MessageKey,
  value: string | number,
  attributes: string = '',
) {
  return `<label>${t(label)}<input name="${name}" value="${html(value)}" ${attributes}></label>`;
}

export function diagramColor(color: string) {
  if (AppSettings.current.theme !== 'dark') return color;
  const channels = [1, 3, 5].map((offset) =>
    Math.round(parseInt(color.slice(offset, offset + 2), 16) * 0.65 + 255 * 0.35),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
