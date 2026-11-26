import * as NetworkModel from '../domain/model';
import { deviceIcon } from '../domain/catalog';
import type { EditorState, MapDevice, MapLink, MapRoom } from '../domain/types';
import { eventElement, send } from '../editor/events';
import { deviceName, mediumName, t } from '../i18n';
import { html } from '../ui/html';
import { icon, iconButton, inputField, options } from '../ui/templates';
import { FieldCommitter, retainFieldFocus } from '../ui/field-committer';
import { componentKey, componentMembers } from '../domain/components';
import type { MessageKey } from '../i18n/locales/en';
import {
  customFields,
  linkFields,
  notesField,
  planningFields,
  specificationFieldsHtml,
} from '../ui/planning-fields';
export class PropertyPanel extends HTMLElement {
  initialized = false;
  committer = new FieldCommitter();
  private selectedId = '';
  private sections = new Set<string>();
  private disclosure(key: string, label: MessageKey, content: string): string {
    return `<details class="property-disclosure" data-section="${key}" ${this.sections.has(key) ? 'open' : ''}><summary>${t(label)}${icon('chevron-down', 15)}</summary><div>${content}</div></details>`;
  }
  update(state: EditorState) {
    const restoreFocus = retainFieldFocus(this);
    const selection = state.selection;
    if (this.selectedId === selection?.id)
      this.querySelectorAll<HTMLDetailsElement>('details[data-section]').forEach((details) => {
        if (details.open) this.sections.add(details.dataset.section || '');
        else this.sections.delete(details.dataset.section || '');
      });
    else {
      this.sections.clear();
      this.selectedId = selection?.id || '';
    }
    const list =
      selection?.kind === 'device'
        ? state.document.devices
        : selection?.kind === 'room'
          ? state.document.rooms
          : state.document.links;
    const item = selection ? list.find((entry) => entry.id === selection.id) : null;
    const device = selection?.kind === 'device' ? (item as MapDevice | undefined) : undefined;
    const room = selection?.kind === 'room' ? (item as MapRoom | undefined) : undefined;
    const link = selection?.kind === 'link' ? (item as MapLink | undefined) : undefined;
    const kind = t(device ? 'device' : room ? 'room' : 'link');
    const members = device ? componentMembers(state.document, componentKey(device)) : [];
    if (!item) {
      this.innerHTML = `<div class="panel-heading"><span>${t('overview')}</span>${icon('sliders-horizontal', 17)}</div>
        <div class="overview"><div class="overview-symbol">${icon('network', 29)}</div><h2>${t('allConnected')}</h2><p class="muted">${html(state.document.name)}</p>
        <div class="stat-grid">${(['devices', 'links', 'rooms'] as const).map((key) => `<div><strong>${state.document[key].length}</strong><span>${t(key)}</span></div>`).join('')}</div></div>
        <section class="panel-section"><h3>${t('connectionTypes')}</h3>${NetworkModel.media.map((medium) => `<div class="legend-row"><i class="line-sample ${medium}"></i><span>${mediumName(medium)}</span></div>`).join('')}</section>
        <section class="panel-section inventory"><h3>${t('inventory')} <span>${state.document.devices.length}</span></h3>${state.document.devices.length ? state.document.devices.map((entry) => `<button data-select="${html(entry.id)}"><span class="inventory-icon" style="color:${entry.color}">${icon(deviceIcon(entry.type, state.document.customDeviceTypes), 17)}</span><span>${html(entry.name)}<small>${html(entry.ip || deviceName(entry.type, state.document.customDeviceTypes))}</small></span>${icon('chevron-right', 14)}</button>`).join('') : `<p class="muted empty-note">${t('noDevices')}</p>`}</section>`;
      restoreFocus();
      return;
    }
    this.innerHTML = `<div class="panel-heading"><span>${kind}</span>${iconButton('deselect', 'x', t('deselect'))}</div>
      <div class="selected-heading"><span class="selected-icon" style="color:${item.color};background:${item.color}10">${icon(device ? deviceIcon(device.type, state.document.customDeviceTypes) : room ? 'scan' : 'cable', 27)}</span><div><h2>${html(item.name || (link ? mediumName(link.medium) : kind))}</h2><span class="muted">${device ? html(deviceName(device.type, state.document.customDeviceTypes)) : kind}</span></div></div>
      ${state.editing ? `<div class="selection-actions primary-selection-actions">${!link ? `<button class="button secondary" data-action="duplicate" title="${t('duplicate')}">${icon('copy', 16)}${t('duplicate')}</button>` : ''}<button class="button danger" data-action="delete" title="${t('delete')}">${icon('trash-2', 16)}${t('delete')}</button></div>` : ''}
      ${members.length > 1 ? `<div class="reference-notice" title="${html(t('referenceNotice', { count: members.length }))}">${icon('link', 15)}<span>${t('references', { count: members.length })}</span>${state.editing ? `<button class="text-button" data-action="detach-reference">${t('detachReference')}</button>` : ''}</div>` : ''}
      <form class="properties"><fieldset ${state.editing ? '' : 'disabled'}>
      ${inputField('name', 'name', item.name, `maxlength="120" placeholder="${t('namePlaceholder')}"`)}
      ${device ? `<label>${t('deviceType')}<select name="type">${[...NetworkModel.types.map((type) => `<option value="${type.id}" ${type.id === device.type ? 'selected' : ''}>${deviceName(type.id)}</option>`), ...(state.document.customDeviceTypes || []).map((type) => `<option value="${html(type.id)}" ${type.id === device.type ? 'selected' : ''}>${html(type.name)}</option>`)].join('')}</select></label>${inputField('ip', 'ipAddress', device.ip, `maxlength="120" placeholder="${t('ipPlaceholder')}"`)}` : ''}
      ${link ? `<label>${t('medium')}<select name="medium">${NetworkModel.media.map((medium) => `<option value="${medium}" ${medium === link.medium ? 'selected' : ''}>${mediumName(medium)}</option>`).join('')}</select></label><label>${t('speed')}<select name="speed">${options(NetworkModel.speeds, link.speed)}</select></label><div class="link-endpoints">${icon('git-branch', 17)}<span>${html(state.document.devices.find((entry) => entry.id === link.source)?.name)}<br>${html(state.document.devices.find((entry) => entry.id === link.target)?.name)}</span></div>` : ''}
      <label>${t('color')}</label><div class="color-options">${NetworkModel.colors.map((color) => `<button type="button" class="swatch ${item.color === color ? 'active' : ''}" data-color="${color}" style="--swatch:${color}" aria-label="${t('color')} ${color}" aria-pressed="${item.color === color}">${item.color === color ? icon('check', 14) : ''}</button>`).join('')}<label class="custom-color" title="${t('customColor')}">${icon('pipette', 17)}<input type="color" name="color" value="${item.color}" aria-label="${t('customColor')}"></label></div>
      ${room ? `<div class="dimension-fields">${inputField('width', 'width', room.width, 'type="number" min="140" max="10000" step="10" required')}${inputField('height', 'height', room.height, 'type="number" min="120" max="10000" step="10" required')}</div>` : ''}
      ${device ? this.disclosure('technical', 'technicalDetails', `${specificationFieldsHtml(device)}<h3>${t('customProperties')}</h3>${customFields(device)}`) : ''}
      ${device || link ? this.disclosure('planning', 'procurement', `${link ? linkFields(link) : ''}${planningFields((device || link)?.planning, !!link && link.medium !== 'wireless', !link || link.medium !== 'wireless', false, { quantity: !device })}`) : this.disclosure('notes', 'notes', notesField('notes', room?.notes))}
      ${'x' in item ? this.disclosure('position', 'positionDetails', `<div class="dimension-fields">${inputField('x', 'positionX', item.x, 'type="number" min="-20000" max="20000" required')}${inputField('y', 'positionY', item.y, 'type="number" min="-20000" max="20000" required')}</div>`) : ''}
      </fieldset></form>
      ${link && state.editing ? `<section class="panel-section routing-section"><h3>${t('routing')}</h3><div class="route-actions"><button class="button secondary" data-action="add-bend">${icon('git-commit-horizontal', 16)}${t('addBend')}</button>${iconButton('reset-route', 'rotate-ccw', t('resetRoute'), link.waypoints?.length ? '' : 'disabled')}</div><div class="waypoint-list">${(link.waypoints || []).map((point, index) => `<div><span>${t('bendPoint', { number: index + 1 })}<small>${point.x}, ${point.y}</small></span><button class="icon-button" data-remove-waypoint="${index}" title="${t('removeBend')}" aria-label="${t('removeBend')}">${icon('x', 15)}</button></div>`).join('')}</div></section>` : ''}
      ${!state.editing ? `<div class="readonly-tag">${icon('lock-keyhole', 15)}${t('viewMode')}</div>` : ''}`;
    restoreFocus();
  }
  commitField(target: EventTarget | null) {
    this.committer.commit(this, target, (field, value) => {
      if (value === undefined && !field.name.includes('.')) return;
      send(this, { action: 'property', name: field.name, value });
    });
  }
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.addEventListener('submit', (event) => event.preventDefault());
    this.addEventListener('change', (event) => this.commitField(event.target));
    this.addEventListener('focusout', (event) => this.commitField(event.target));
    this.addEventListener('click', (event) => {
      const target = eventElement(event)?.closest(
        '[data-color], [data-select], [data-remove-waypoint], [data-plan-command]',
      );
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.select)
        send(this, { action: 'select', kind: 'device', id: target.dataset.select });
      if (target.dataset.color)
        send(this, { action: 'property', name: 'color', value: target.dataset.color });
      if (target.dataset.removeWaypoint !== undefined)
        send(this, { action: 'remove-waypoint', index: Number(target.dataset.removeWaypoint) });
      if (target.dataset.planCommand)
        send(this, { action: 'property', name: target.dataset.planCommand, value: undefined });
    });
  }
}
