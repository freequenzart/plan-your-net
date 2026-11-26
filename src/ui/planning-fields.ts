import type { DeviceSpecifications, ItemPlanning, MapDevice, MapLink } from '../domain/types';
import { specificationFields } from '../domain/specifications';
import { AppSettings, t } from '../i18n';
import type { MessageKey } from '../i18n/locales/en';
import { html } from './html';
import { icon } from './icons';

export function money(cents: number): string {
  return new Intl.NumberFormat(AppSettings.current.language, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function planInput(
  name: string,
  label: MessageKey,
  value: string | number | undefined,
  type = 'text',
  attributes = '',
): string {
  return `<label>${t(label)}<input name="${name}" type="${type}" value="${html(value ?? '')}" ${type === 'text' ? 'maxlength="120"' : ''} ${attributes}></label>`;
}

export function notesField(
  name: string,
  value: string | undefined,
  label: MessageKey = 'notes',
): string {
  return `<label class="notes-field">${t(label)}<textarea name="${name}" maxlength="4000" rows="3">${html(value || '')}</textarea></label>`;
}

export function planningFields(
  plan: ItemPlanning = {},
  cable = false,
  costable = true,
  fractionalQuantity = false,
  visible: { quantity?: boolean; price?: boolean } = {},
): string {
  return `<div class="planning-fields">${planInput('planning.manufacturer', 'manufacturer', plan.manufacturer)}${planInput('planning.model', 'model', plan.model)}
    ${costable ? `${visible.quantity !== false ? planInput('planning.quantity', 'quantity', plan.quantity ?? 1, 'number', `min="${fractionalQuantity ? '0.1' : '1'}" max="1000000" step="${fractionalQuantity ? '0.1' : '1'}"`) : ''}${visible.price !== false ? planInput('planning.unitPrice', 'unitPrice', plan.unitPrice, 'number', 'min="0" max="1000000" step="0.01"') : ''}` : ''}
    ${cable ? `${planInput('planning.lengthMeters', 'lengthMeters', plan.lengthMeters, 'number', 'min="0" max="1000000" step="0.1"')}<label>${t('priceMode')}<select name="planning.priceMode"><option value="perUnit" ${plan.priceMode !== 'perMeter' ? 'selected' : ''}>${t('perUnit')}</option><option value="perMeter" ${plan.priceMode === 'perMeter' ? 'selected' : ''}>${t('perMeter')}</option></select></label>` : ''}</div>${notesField('planning.notes', plan.notes)}`;
}

export function specificationFieldsHtml(device: MapDevice): string {
  const specifications = device.specifications || {};
  return `<div class="specification-fields">${specificationFields
    .filter((field) => field.types.includes(device.type))
    .map((field) => {
      const value = specifications[field.key];
      const label = t(`spec.${field.key}` as MessageKey);
      const name = `specifications.${field.key}`;
      if (field.kind === 'checkbox')
        return `<label class="check-field"><input type="checkbox" name="${name}" ${value === true ? 'checked' : ''}>${label}</label>`;
      if (field.options)
        return `<label>${label}<select name="${name}"><option value="" ${value === undefined ? 'selected' : ''}>—</option>${field.options.map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${t(`management.${option}` as MessageKey)}</option>`).join('')}</select></label>`;
      return planInput(
        name,
        `spec.${field.key}` as MessageKey,
        typeof value === 'string' || typeof value === 'number' ? value : undefined,
        field.kind,
        field.kind === 'number'
          ? `min="0" max="1000000" step="${field.key === 'ports' || field.key === 'uplinkPorts' ? 1 : 'any'}"`
          : '',
      );
    })
    .join('')}</div>`;
}

export function specificationSummary(
  type: string,
  specifications: DeviceSpecifications = {},
): string {
  return specificationFields
    .filter((field) => field.types.includes(type) && specifications[field.key] !== undefined)
    .map((field) => {
      const value = specifications[field.key];
      return `${t(`spec.${field.key}` as MessageKey)}: ${typeof value === 'boolean' ? t(value ? 'yes' : 'no') : field.key === 'management' ? t(`management.${value}` as MessageKey) : value}`;
    })
    .join(' · ');
}

export function customFields(device: MapDevice): string {
  return `<div class="custom-fields">${(device.attributes || []).map((attribute, index) => `<div class="custom-field-row"><label>${t('propertyName')}<input name="attributes.${index}.name" maxlength="80" value="${html(attribute.name)}"></label><label>${t('propertyValue')}<input name="attributes.${index}.value" maxlength="240" value="${html(attribute.value)}"></label><button type="button" class="icon-button" data-plan-command="attributes.remove.${index}" title="${t('removeProperty')}" aria-label="${t('removeProperty')}">${icon('x', 15)}</button></div>`).join('')}<button type="button" class="text-button" data-plan-command="attributes.add">${icon('plus', 15)}${t('addProperty')}</button></div>`;
}

export function linkFields(link: MapLink): string {
  return link.medium !== 'wireless' ? planInput('cableType', 'cableType', link.cableType) : '';
}
