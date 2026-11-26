import * as NetworkModel from '../domain/model';
import { eventElement, send } from '../editor/events';
import { AppSettings, deviceName, t } from '../i18n';
import { html } from '../ui/html';
import { icon } from '../ui/templates';
import { componentGroups } from '../domain/components';
import { deviceIcon } from '../domain/catalog';
import type { MapDocument } from '../domain/types';
import { downloadFile, parseCustomDeviceType, serializeCustomDeviceType } from '../services/files';
export class DevicePalette extends HTMLElement {
  private documentModel: MapDocument | null = null;

  update(document: MapDocument): void {
    this.documentModel = document;
    const list = this.querySelector('.used-component-list');
    if (!list) return;
    list.innerHTML =
      componentGroups(document)
        .map((devices) => {
          const source = devices[0];
          return `<button class="used-component" draggable="true" data-reference-id="${html(source.id)}" title="${t('addReference')}"><span class="inventory-icon" style="color:${source.color}">${icon(deviceIcon(source.type, document.customDeviceTypes), 18)}</span><span class="used-component-name">${html(source.planning?.model || source.name)}<small>${html(deviceName(source.type, document.customDeviceTypes))}</small></span><span class="component-count">${devices.length}×</span>${icon('plus', 14)}</button>`;
        })
        .join('') || `<p class="muted empty-note">${t('noDevices')}</p>`;
    const customTypes = document.customDeviceTypes || [];
    const customGrid = this.querySelector('.custom-device-grid');
    if (customGrid)
      customGrid.innerHTML = customTypes
        .map((type) => {
          const inUse = document.devices.some((device) => device.type === type.id);
          return `<div class="custom-device-entry"><button class="device-tile" draggable="true" data-type="${html(type.id)}" title="${html(t('addDevice', { name: type.name }))}"><span class="tile-icon">${icon(type.icon, 24)}</span><span>${html(type.name)}</span></button><div class="custom-device-card-actions"><button class="icon-button" data-custom-action="export" data-type-id="${html(type.id)}" title="${t('exportCustomDeviceType')}" aria-label="${t('exportCustomDeviceType')}">${icon('download', 14)}</button><button class="icon-button" data-custom-action="remove" data-type-id="${html(type.id)}" title="${t(inUse ? 'customDeviceTypeInUse' : 'removeCustomDeviceType')}" aria-label="${t('removeCustomDeviceType')}" ${inUse ? 'disabled' : ''}>${icon('trash-2', 14)}</button></div></div>`;
        })
        .join('');
    const count = this.querySelector('.mini-label');
    if (count) count.textContent = String(NetworkModel.types.length + customTypes.length);
    this.filter();
  }
  private filter(): void {
    const term = (this.querySelector('input')?.value || '').toLocaleLowerCase(
      AppSettings.current.language,
    );
    this.querySelectorAll<HTMLElement>(
      '.device-tile, .used-component, .custom-device-entry',
    ).forEach((tile) => {
      tile.hidden = !(tile.textContent || '')
        .toLocaleLowerCase(AppSettings.current.language)
        .includes(term);
    });
  }
  connectedCallback() {
    this.innerHTML = `<div class="panel-heading"><span>${t('library')}</span><span class="mini-label">${NetworkModel.types.length}</span></div>
      <label class="search-field">${icon('search', 16)}<input type="search" placeholder="${t('searchPlaceholder')}" aria-label="${t('searchDevices')}"></label>
      <section class="used-components" data-tour="used-components"><h3>${t('usedComponents')}</h3><div class="used-component-list"></div></section>
      <div class="palette-content" data-tour="basic-devices"><h3 class="basic-devices-heading">${t('basicDevices')}</h3>${(
        ['network', 'endpoints'] as const
      )
        .map(
          (group) =>
            `<section class="device-group"><h3>${t(group)}</h3><div class="device-grid" data-device-group="${group}">${NetworkModel.types
              .filter((type) => type.group === group)
              .map(
                (type) =>
                  `<button class="device-tile" draggable="true" data-type="${type.id}" title="${html(t('addDevice', { name: deviceName(type.id) }))}"><span class="tile-icon">${icon(type.icon, 24)}</span><span>${deviceName(type.id)}</span></button>`,
              )
              .join(
                '',
              )}${group === 'endpoints' ? `<h3 class="custom-device-heading">${t('customDeviceTypes')}</h3><div class="custom-device-grid"></div><div class="custom-device-actions"><button class="text-button" data-custom-command="create">${icon('plus', 15)}${t('addCustomDeviceType')}</button><button class="icon-button" data-custom-command="import" title="${t('importCustomDeviceType')}" aria-label="${t('importCustomDeviceType')}">${icon('upload', 15)}</button><input class="custom-device-file" type="file" accept=".json,application/json" hidden></div>` : ''}</section>`,
        )
        .join('')}
      <section class="device-group"><h3>${t('floorPlan')}</h3><button class="room-tile" data-action="room">${icon('scan', 22)}<span>${t('drawRoom')}</span>${icon('plus', 15)}</button></section></div>
      <div class="palette-footer">${icon('hard-drive', 16)}<span>${t('localPrivacy')}</span></div>
      <dialog class="confirm-dialog custom-device-dialog"><form class="custom-device-form"><span class="dialog-symbol">${icon('monitor', 24)}</span><h2>${t('addCustomDeviceType')}</h2><label>${t('customDeviceName')}<input name="name" maxlength="80" required></label><label>${t('customDeviceIcon')}<select name="icon">${NetworkModel.customDeviceIcons.map((name) => `<option value="${name}">${name}</option>`).join('')}</select></label><div><button type="button" class="button secondary" data-custom-command="cancel">${t('cancel')}</button><button type="submit" class="button primary">${t('addCustomDeviceType')}</button></div></form></dialog>`;
    this.addEventListener('click', (event) => {
      const target = eventElement(event)?.closest<HTMLElement>(
        '[data-type], [data-action], [data-reference-id], [data-custom-command], [data-custom-action]',
      );
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.customCommand) {
        if (target.dataset.customCommand === 'create')
          this.querySelector<HTMLDialogElement>('.custom-device-dialog')?.showModal();
        else if (target.dataset.customCommand === 'import')
          this.querySelector<HTMLInputElement>('.custom-device-file')?.click();
        else this.querySelector<HTMLDialogElement>('.custom-device-dialog')?.close();
        return;
      }
      if (target.dataset.customAction) {
        const type = this.documentModel?.customDeviceTypes?.find(
          (entry) => entry.id === target.dataset.typeId,
        );
        if (!type) return;
        if (target.dataset.customAction === 'export')
          downloadFile(type.name, serializeCustomDeviceType(type), 'json');
        else if (!this.documentModel?.devices.some((device) => device.type === type.id))
          send(this, { action: 'remove-custom-device-type', id: type.id });
        return;
      }
      if (target.dataset.referenceId)
        send(this, { action: 'add-reference', id: target.dataset.referenceId });
      else if (target.dataset.type) send(this, { action: 'add-device', type: target.dataset.type });
      else send(this, { action: 'tool', tool: 'room' });
    });
    this.addEventListener('submit', (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches('.custom-device-form')) return;
      event.preventDefault();
      const data = new FormData(form);
      send(this, {
        action: 'add-custom-device-type',
        name: String(data.get('name') || ''),
        icon: String(data.get('icon') || ''),
      });
      this.querySelector<HTMLDialogElement>('.custom-device-dialog')?.close();
    });
    this.addEventListener('change', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches('.custom-device-file')) return;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      void file
        .text()
        .then(parseCustomDeviceType)
        .then((type) => send(this, { action: 'import-custom-device-type', ...type }))
        .catch(() => send(this, { action: 'hint', message: t('error.invalidCustomDeviceType') }));
    });
    this.addEventListener('dragstart', (event) => {
      const tile = eventElement(event)?.closest('[data-type], [data-reference-id]');
      if (tile instanceof HTMLElement && event.dataTransfer) {
        event.dataTransfer.setData(
          tile.dataset.referenceId
            ? 'application/x-plan-your-net-reference'
            : 'application/x-plan-your-net-device',
          tile.dataset.referenceId || tile.dataset.type || '',
        );
        event.dataTransfer.effectAllowed = 'copy';
      }
    });
    this.querySelector<HTMLInputElement>('.search-field input')?.addEventListener('input', () =>
      this.filter(),
    );
  }
}
