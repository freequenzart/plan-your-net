import * as NetworkModel from '../domain/model';
import type { EditorState, MapDocument, MapPoint, MapTool } from '../domain/types';
import type { EditorEvent } from '../editor/events';
import { eventElement } from '../editor/events';
import { AppSettings, deviceName, errorMessage, mediumName, t } from '../i18n';
import type { MessageKey } from '../i18n/locales/en';
import {
  csvCell,
  downloadFile,
  parseDocument,
  type FilePickerApi,
  type WritableFileHandle,
} from '../services/files';
import { loadDocument, saveDocument } from '../services/storage';
import { html } from '../ui/html';
import { icon, iconButton } from '../ui/templates';
import { NetworkCanvas } from './network-canvas';
import { PropertyPanel } from './property-panel';
import { AssemblyView } from './assembly-view';
import { updatePlanning, type PlanningKind, type PlanningValue } from '../domain/planning-updates';
import { planningEntries, entryCostCents, entryPriced } from '../domain/planning';
import { money } from '../ui/planning-fields';
import { addDeviceReference, detachComponent } from '../domain/components';
import { DevicePalette } from './device-palette';
import { AppTour, onboardingKey, type TourStepId } from './app-tour';
import { planningRows } from '../domain/planning';
export class PlanYourNetApp extends HTMLElement {
  state: EditorState = {
    document: NetworkModel.demo(),
    selection: null,
    tool: 'select',
    editing: true,
    mode: 'edit',
    camera: { x: 30, y: 20, zoom: 0.8 },
    connecting: null,
    grid: true,
  };
  past: MapDocument[] = [];
  future: MapDocument[] = [];
  canvas: NetworkCanvas = document.createElement('network-canvas') as NetworkCanvas;
  inspector: PropertyPanel = document.createElement('property-panel') as PropertyPanel;
  assembly: AssemblyView = document.createElement('assembly-view') as AssemblyView;
  tour: AppTour = document.createElement('app-tour') as AppTour;
  toastTimer = 0;
  private refreshFrame = 0;
  private lifecycleController: AbortController | null = null;
  private jsonFileHandle: WritableFileHandle | null = null;
  storageAvailable = true;
  renderShell() {
    this.innerHTML = `<header class="app-header">
      <a class="brand" href="./index.html" aria-label="${t('home')}"><span class="brand-symbol">${icon('network', 23)}</span><span class="brand-wordmark"><span>plan your</span><strong>net<span class="brand-dot">.</span></strong></span></a>
      <span class="header-divider"></span><div class="document-title"><input id="document-name" aria-label="${t('documentName')}" maxlength="120" value="${html(this.state.document.name)}"><span class="save-status" role="status"></span></div>
      <div class="header-actions"><div class="mode-switch" aria-label="${t('viewMode')}"><button data-action="edit" title="${t('edit')}">${icon('pencil', 15)}<span>${t('edit')}</span></button><button data-action="view" title="${t('view')}">${icon('eye', 16)}<span>${t('view')}</span></button><button data-action="build" title="${t('buildMode')}">${icon('clipboard-check', 15)}<span>${t('buildMode')}</span></button></div>
      <details class="file-menu"><summary class="button secondary" title="${t('fileActions')}">${icon('folder-open', 17)}<span>${t('file')}</span>${icon('chevron-down', 13)}</summary><div class="dropdown">
      ${(
        [
          ['import', 'upload', 'import'],
          ['export', 'file-json', 'exportJson'],
          ['export-svg', 'image-down', 'exportSvg'],
          ['new', 'file-plus-2', 'newPlan'],
          ['demo', 'panels-top-left', 'loadDemo'],
        ] as [string, string, MessageKey][]
      )
        .map(
          ([action, symbol, label]) =>
            `<button data-action="${action}">${icon(symbol, 16)}${t(label)}</button>`,
        )
        .join('')}</div></details>
      <button class="button secondary mark-actual-state" data-action="mark-actual" title="${t('markActualState')}" aria-label="${t('markActualState')}">${icon('clipboard-check', 16)}<span>${t('markActualState')}</span></button>
      <button class="button secondary save-json-button" data-action="save-json" title="${t('saveJson')}" aria-label="${t('saveJson')}">${icon('save', 16)}<span>${t('saveJson')}</span></button>
      <button class="button primary export-button" data-action="export" title="${t('exportJson')}">${icon('download', 16)}<span>${t('export')}</span></button></div></header>
      <div class="workspace-bar"><div class="breadcrumbs">${t('workspace')} ${icon('chevron-right', 13)}<span>${t('networkPlan')}</span><span class="local-badge"><i></i>${t('localOnly')}</span></div><div class="workspace-actions"><button class="text-button mobile-library" data-action="toggle-palette">${icon('blocks', 16)}${t('library')}</button><button class="text-button mobile-inspector" data-action="toggle-inspector">${icon('sliders-horizontal', 16)}${t('details')}</button><span class="document-count"></span>
      <label class="language-control" title="${t('language')}">${icon('languages', 15)}<select name="language" aria-label="${t('language')}"><option value="de" ${AppSettings.current.language === 'de' ? 'selected' : ''}>DE</option><option value="en" ${AppSettings.current.language === 'en' ? 'selected' : ''}>EN</option></select></label>${iconButton('toggle-theme', 'moon', t('theme'))}${iconButton('tour', 'circle-help', t('tour'))}</div></div>
      <main class="editor-layout"><device-palette></device-palette><section class="canvas-area" aria-label="${t('editor')}"><div class="canvas-title"><span class="canvas-title-icon">${icon('workflow', 17)}</span><span>${t('topology')}</span><span class="canvas-subtitle">${icon('circle', 6)}${t('livePlan')}</span></div>
      <div class="floating-toolbar" role="toolbar" aria-label="${t('tools')}"><div class="editing-tools">${iconButton('select', 'mouse-pointer-2', t('selectTool'))}${iconButton('pan', 'hand', t('panTool'))}<span class="tool-divider"></span>${iconButton('room', 'scan', t('roomTool'))}${iconButton('connect', 'cable', t('connectTool'))}</div><span class="tool-divider edit-divider"></span>${iconButton('undo', 'undo-2', t('undo'))}${iconButton('redo', 'redo-2', t('redo'))}</div><div class="canvas-mount"></div>
      <div class="canvas-bottom"><div class="canvas-legend">${NetworkModel.media.map((medium) => `<span><i class="${medium === 'wireless' ? 'legend-dash' : medium === 'fiber' ? 'legend-dot fiber-dot' : 'legend-dot'}"></i>${mediumName(medium)}</span>`).join('')}</div><div class="status-color-legend" hidden><span><i class="actual-status-dot"></i>${t('actualState')}</span><span><i class="planned-status-dot"></i>${t('plannedState')}</span></div><div class="zoom-controls">${iconButton('zoom-out', 'minus', t('zoomOut'))}<button class="zoom-value" data-action="reset-zoom" title="${t('resetZoom')}">100 %</button>${iconButton('zoom-in', 'plus', t('zoomIn'))}<span class="tool-divider"></span>${iconButton('fit', 'maximize', t('fit'))}${iconButton('grid', 'grid-2x2', t('toggleGrid'))}</div></div><div class="tool-hint" role="status" hidden></div></section><div class="inspector-mount"></div></main>
      <footer class="status-bar"><span>${icon('shield-check', 13)}<span>${t('privacy')}</span></span><span class="status-selection"></span><span class="version-label">PLAN YOUR NET <span>1.1</span></span></footer>
      <input class="file-input" type="file" accept=".json,.svg,application/json,image/svg+xml" aria-label="${t('import')}"><div class="toast" role="status" hidden></div>
      <dialog class="confirm-dialog replace-plan-dialog"><form method="dialog"><span class="dialog-symbol">${icon('file-warning', 25)}</span><h2>${t('confirmTitle')}</h2><p>${t('confirmBody')}</p><div><button class="button secondary" value="cancel">${t('cancel')}</button><button class="button primary" value="confirm">${t('replace')}</button></div></form></dialog>`;
    this.querySelector('.canvas-mount')?.append(this.canvas);
    this.querySelector('.inspector-mount')?.append(this.inspector);
    this.querySelector('.editor-layout')?.after(this.assembly);
    this.append(this.tour);
  }
  connectedCallback() {
    this.lifecycleController?.abort();
    const lifecycle = new AbortController();
    this.lifecycleController = lifecycle;
    let storageError = false;
    try {
      const saved = loadDocument();
      if (saved) this.state.document = saved;
    } catch {
      storageError = true;
    }
    this.renderShell();
    this.addEventListener(
      'map-action',
      (event) => this.handle((event as CustomEvent<EditorEvent>).detail),
      { signal: lifecycle.signal },
    );
    this.addEventListener(
      'click',
      (event) => {
        const target = eventElement(event)?.closest('[data-action]');
        if (target instanceof HTMLElement && !target.closest('device-palette'))
          void this.action(target.dataset.action || '');
      },
      { signal: lifecycle.signal },
    );
    this.addEventListener(
      'change',
      (event) => {
        const field = event.target;
        if (field instanceof HTMLSelectElement && field.name === 'language') {
          if (field.value !== 'de' && field.value !== 'en') return;
          this.canvas.cancel();
          AppSettings.current.language = field.value;
          const saved = AppSettings.save();
          this.renderShell();
          this.refresh();
          if (!saved) this.toast(t('preferencesError'));
        } else if (
          field instanceof HTMLInputElement &&
          field.id === 'document-name' &&
          this.state.mode !== 'view'
        ) {
          const name = field.value.trim() || t('defaultName');
          this.change(() => {
            this.state.document.name = name;
          });
        } else if (field instanceof HTMLInputElement && field.classList.contains('file-input'))
          void this.importFile(field);
      },
      { signal: lifecycle.signal },
    );
    document.addEventListener('keydown', (event) => this.keydown(event), {
      signal: lifecycle.signal,
    });
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!eventElement(event)?.closest('.file-menu'))
          this.querySelector('.file-menu')?.removeAttribute('open');
      },
      { signal: lifecycle.signal },
    );
    this.refresh();
    requestAnimationFrame(() => this.canvas.fit());
    setTimeout(() => {
      try {
        if (!localStorage.getItem(onboardingKey)) this.startTour();
      } catch {}
    }, 0);
    if (storageError) this.toast(t('storageLoadError'));
  }
  disconnectedCallback() {
    this.lifecycleController?.abort();
    this.lifecycleController = null;
    if (this.refreshFrame) cancelAnimationFrame(this.refreshFrame);
    this.refreshFrame = 0;
    clearTimeout(this.toastTimer);
  }
  refresh() {
    if (this.refreshFrame) {
      cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = 0;
    }
    document.title = t('appTitle');
    this.dataset.mode = this.state.mode || (this.state.editing ? 'edit' : 'view');
    this.canvas.update(this.state);
    this.inspector.update(this.state);
    this.querySelector<DevicePalette>('device-palette')?.update(this.state.document);
    if (this.state.mode === 'build') this.assembly.update(this.state.document);
    const input = this.querySelector('#document-name') as HTMLInputElement | null;
    if (input) {
      input.value = this.state.document.name;
      input.readOnly = this.state.mode === 'view';
    }
    this.querySelectorAll(
      '[data-action="edit"], [data-action="view"], [data-action="build"]',
    ).forEach((button) => {
      const active = button.getAttribute('data-action') === this.dataset.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const statusLegend = this.querySelector<HTMLElement>('.status-color-legend');
    if (statusLegend) statusLegend.hidden = this.state.mode !== 'view';
    const connectionLegend = this.querySelector<HTMLElement>('.canvas-legend');
    if (connectionLegend) connectionLegend.hidden = this.state.mode === 'view';
    const markActual = this.querySelector<HTMLButtonElement>('[data-action="mark-actual"]');
    if (markActual) {
      markActual.hidden = this.state.mode !== 'edit';
      markActual.disabled =
        !this.state.document.devices.length ||
        (this.state.document.devices.every(
          (device) => device.planning?.purchased && device.planning?.installed,
        ) &&
          this.state.document.links.every((link) =>
            link.medium === 'wireless'
              ? link.planning?.installed
              : link.planning?.purchased && link.planning?.installed,
          ));
    }
    this.querySelectorAll('.editing-tools [data-action]').forEach((button) => {
      const active = button.getAttribute('data-action') === this.state.tool;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    for (const action of ['undo', 'redo']) {
      this.querySelectorAll<HTMLButtonElement>(`[data-action="${action}"]`).forEach((button) => {
        button.disabled =
          this.state.mode === 'view' || !(action === 'undo' ? this.past : this.future).length;
      });
    }
    const zoom = this.querySelector('.zoom-value');
    if (zoom) zoom.textContent = `${Math.round(this.state.camera.zoom * 100)} %`;
    const count = this.querySelector('.document-count');
    if (count)
      count.textContent = t('deviceCount', {
        devices: this.state.document.devices.length,
        links: this.state.document.links.length,
      });
    const selected = this.querySelector('.status-selection');
    if (selected)
      selected.textContent = this.state.selection
        ? t(
            this.state.selection.kind === 'device'
              ? 'deviceSelected'
              : this.state.selection.kind === 'room'
                ? 'roomSelected'
                : 'linkSelected',
          )
        : t('noSelection');
    const hint = this.querySelector('.tool-hint') as HTMLElement | null;
    if (hint) {
      hint.hidden =
        !this.state.editing ||
        (!['room', 'connect'].includes(this.state.tool) && this.state.selection?.kind !== 'link');
      hint.textContent = t(
        this.state.tool === 'room'
          ? 'roomHint'
          : this.state.tool === 'connect'
            ? this.state.connecting
              ? 'targetHint'
              : 'connectHint'
            : 'routeHint',
      );
    }
    this.querySelector('[data-action="grid"]')?.setAttribute(
      'aria-pressed',
      String(this.state.grid),
    );
    const themeButton = this.querySelector('[data-action="toggle-theme"]');
    if (themeButton) {
      const dark = AppSettings.current.theme === 'dark';
      const label = `${t('theme')}: ${t(dark ? 'light' : 'dark')}`;
      themeButton.innerHTML = icon(dark ? 'sun' : 'moon');
      themeButton.setAttribute('title', label);
      themeButton.setAttribute('aria-label', label);
      themeButton.setAttribute('aria-pressed', String(dark));
    }
    const status = this.querySelector('.save-status');
    if (status) {
      status.innerHTML = `${icon(this.storageAvailable ? 'circle-check' : 'triangle-alert', 12)}<span>${t(this.storageAvailable ? 'saved' : 'unsaved')}</span>`;
      status.classList.toggle('save-error', !this.storageAvailable);
    }
  }
  change(mutate: () => void, deferRefresh = false) {
    this.past.push(NetworkModel.clone(this.state.document));
    if (this.past.length > 60) this.past.shift();
    this.future = [];
    mutate();
    this.save();
    if (deferRefresh) {
      if (!this.refreshFrame)
        this.refreshFrame = requestAnimationFrame(() => {
          this.refreshFrame = 0;
          this.refresh();
        });
    } else this.refresh();
  }
  save() {
    try {
      saveDocument(this.state.document);
      this.storageAvailable = true;
    } catch {
      this.storageAvailable = false;
      this.toast(t('storageSaveError'));
    }
  }
  toast(message: string) {
    const toast = this.querySelector('.toast') as HTMLElement | null;
    if (!toast) return;
    clearTimeout(this.toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }
  handle(detail: EditorEvent) {
    if (detail.action === 'inspect-device') {
      void this.action('edit');
      this.state.selection = { kind: 'device', id: detail.id };
      if (innerWidth <= 950) this.classList.add('inspector-open');
      this.refresh();
      return;
    }
    if (detail.action === 'plan-change') {
      if (this.state.mode !== 'view')
        this.changePlanning(detail.kind, detail.id, detail.name, detail.value, detail.deviceIds);
      return;
    }
    if (
      detail.action === 'add-custom-device-type' ||
      detail.action === 'import-custom-device-type'
    ) {
      if (this.state.mode !== 'edit') return;
      const name = detail.name.trim();
      if (
        !name ||
        name.length > 80 ||
        !NetworkModel.customDeviceIcons.includes(
          detail.icon as (typeof NetworkModel.customDeviceIcons)[number],
        )
      ) {
        this.toast(t('error.invalidCustomDeviceType'));
        return;
      }
      this.change(() => {
        (this.state.document.customDeviceTypes ||= []).push({
          id: `custom-${NetworkModel.id()}`,
          name,
          icon: detail.icon,
        });
      });
      return;
    }
    if (detail.action === 'remove-custom-device-type') {
      if (this.state.mode !== 'edit') return;
      if (this.state.document.devices.some((device) => device.type === detail.id)) {
        this.toast(t('customDeviceTypeInUse'));
        return;
      }
      this.change(() => {
        const remaining = this.state.document.customDeviceTypes?.filter(
          (type) => type.id !== detail.id,
        );
        this.state.document.customDeviceTypes = remaining?.length ? remaining : undefined;
      });
      return;
    }
    if (detail.action === 'remove-material') {
      if (this.state.mode !== 'view')
        this.change(() => {
          this.state.document.materials = this.state.document.materials?.filter(
            (item) => item.id !== detail.id,
          );
        });
      return;
    }
    if (detail.action === 'camera') {
      const value = this.querySelector('.zoom-value');
      if (value) value.textContent = `${Math.round(this.state.camera.zoom * 100)} %`;
      return;
    }
    if (detail.action === 'hint') {
      this.toast(detail.message);
      return;
    }
    if (detail.action === 'select') {
      this.state.selection = detail.kind && detail.id ? { kind: detail.kind, id: detail.id } : null;
      this.refresh();
      return;
    }
    if (!this.state.editing) return;
    if (detail.action === 'add-reference') {
      const source = this.state.document.devices.find((device) => device.id === detail.id);
      if (!source) return;
      const point = detail.point || this.canvas.center();
      this.change(() => {
        const copy = addDeviceReference(this.state.document, source, {
          x: Math.round(point.x / 10) * 10,
          y: Math.round(point.y / 10) * 10,
        });
        this.state.selection = { kind: 'device', id: copy.id };
        this.state.tool = 'select';
        this.state.connecting = null;
      });
      this.classList.remove('palette-open');
      return;
    }
    if (detail.action === 'tool') {
      void this.action(detail.tool);
      return;
    }
    if (detail.action === 'drag-commit') {
      this.past.push(detail.before);
      if (this.past.length > 60) this.past.shift();
      this.future = [];
      this.save();
      this.refresh();
      return;
    }
    if (detail.action === 'add-device') {
      const type = NetworkModel.types.find((entry) => entry.id === detail.type);
      const customType = this.state.document.customDeviceTypes?.find(
        (entry) => entry.id === detail.type,
      );
      if (!type && !customType) return;
      const point = detail.point || this.canvas.center();
      this.change(() => {
        const id = NetworkModel.id();
        const amount = this.state.document.devices.filter(
          (entry) => entry.type === detail.type,
        ).length;
        this.state.document.devices.push({
          id,
          type: detail.type,
          name:
            deviceName(detail.type, this.state.document.customDeviceTypes) +
            (amount ? ` ${amount + 1}` : ''),
          ip: '',
          color: NetworkModel.colors[0],
          x: Math.round(point.x / 10) * 10,
          y: Math.round(point.y / 10) * 10,
        });
        this.state.selection = { kind: 'device', id };
        this.state.tool = 'select';
        this.state.connecting = null;
      });
      this.classList.remove('palette-open');
      return;
    }
    if (detail.action === 'add-room') {
      this.change(() => {
        const id = NetworkModel.id();
        this.state.document.rooms.push({
          id,
          name: `${t('room')} ${this.state.document.rooms.length + 1}`,
          color: NetworkModel.colors[0],
          x: detail.x,
          y: detail.y,
          width: detail.width,
          height: detail.height,
        });
        this.state.selection = { kind: 'room', id };
        this.state.tool = 'select';
      });
      return;
    }
    if (detail.action === 'connect') {
      if (!this.state.connecting) {
        this.state.connecting = detail.id;
        this.refresh();
        return;
      }
      if (this.state.connecting === detail.id) {
        this.toast(t('selectOtherDevice'));
        return;
      }
      const source = this.state.connecting;
      if (
        this.state.document.links.some(
          (link) =>
            (link.source === source && link.target === detail.id) ||
            (link.target === source && link.source === detail.id),
        )
      ) {
        this.toast(t('alreadyConnected'));
        return;
      }
      this.change(() => {
        const id = NetworkModel.id();
        this.state.document.links.push({
          id,
          source,
          target: detail.id,
          name: '',
          medium: 'ethernet',
          speed: '1 Gbit/s',
          color: NetworkModel.colors[0],
        });
        this.state.selection = { kind: 'link', id };
        this.state.connecting = null;
      });
      return;
    }
    if (detail.action === 'add-waypoint') {
      this.addWaypoint(detail.id, detail.point, detail.index);
      return;
    }
    if (detail.action === 'remove-waypoint') {
      const link = this.selected();
      if (link && 'source' in link && link.waypoints?.[detail.index])
        this.change(() => {
          link.waypoints?.splice(detail.index, 1);
        });
      return;
    }
    if (detail.action === 'property') {
      const selected = this.selected();
      if (!selected) return;
      if (detail.name.includes('.') || detail.name === 'notes' || detail.name === 'cableType') {
        if (this.state.selection)
          this.changePlanning(this.state.selection.kind, selected.id, detail.name, detail.value);
        return;
      }
      const allowed =
        this.state.selection?.kind === 'device'
          ? ['name', 'ip', 'type', 'color', 'x', 'y']
          : this.state.selection?.kind === 'room'
            ? ['name', 'color', 'x', 'y', 'width', 'height']
            : ['name', 'color', 'medium', 'speed'];
      if (!allowed.includes(detail.name)) return;
      if (Object.is(Reflect.get(selected, detail.name), detail.value)) return;
      this.change(() => {
        if ('type' in selected && detail.name === 'type')
          detachComponent(this.state.document, selected);
        Object.assign(selected, { [detail.name]: detail.value });
      });
    }
  }
  selected() {
    const selection = this.state.selection;
    return !selection
      ? undefined
      : (selection.kind === 'device'
          ? this.state.document.devices
          : selection.kind === 'room'
            ? this.state.document.rooms
            : this.state.document.links
        ).find((item) => item.id === selection.id);
  }
  changePlanning(
    kind: PlanningKind,
    id: string,
    name: string,
    value: PlanningValue,
    deviceIds?: string[],
  ): void {
    try {
      const document = updatePlanning(this.state.document, kind, id, name, value, deviceIds);
      if (JSON.stringify(document) === JSON.stringify(this.state.document)) return;
      this.change(() => {
        this.state.document = document;
      }, true);
    } catch (error) {
      this.toast(errorMessage(error));
    }
  }
  addWaypoint(id: string, point: MapPoint, index: number) {
    const link = this.state.document.links.find((entry) => entry.id === id);
    if (!link || !this.state.editing) return;
    if ((link.waypoints?.length || 0) >= 100) {
      this.toast(t('error.invalidWaypoints'));
      return;
    }
    this.change(() => {
      link.waypoints ||= [];
      link.waypoints.splice(Math.max(0, Math.min(link.waypoints.length, index)), 0, {
        x: Math.max(-20000, Math.min(20000, Math.round(point.x / 10) * 10)),
        y: Math.max(-20000, Math.min(20000, Math.round(point.y / 10) * 10)),
      });
      this.state.selection = { kind: 'link', id: link.id };
    });
  }
  async action(action: string) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('property-panel, assembly-view'))
      active.blur();
    this.querySelector('.file-menu')?.removeAttribute('open');
    if (action === 'tour') {
      this.startTour();
      return;
    }
    if (action === 'toggle-theme') {
      this.canvas.cancel();
      AppSettings.current.theme = AppSettings.current.theme === 'dark' ? 'light' : 'dark';
      if (!AppSettings.save()) this.toast(t('preferencesError'));
      this.refresh();
      return;
    }
    if (['select', 'pan', 'room', 'connect'].includes(action)) {
      if (!this.state.editing) return;
      this.state.tool = action as MapTool;
      this.state.connecting = null;
      if (action === 'room') this.classList.remove('palette-open');
      this.refresh();
      return;
    }
    if (action === 'edit' || action === 'view' || action === 'build') {
      this.canvas.cancel();
      this.state.editing = action === 'edit';
      this.state.mode = action;
      this.state.tool = 'select';
      this.state.connecting = null;
      this.state.selection = null;
      this.classList.remove('palette-open', 'inspector-open');
      this.refresh();
      requestAnimationFrame(() => this.canvas.render());
      return;
    }
    if (action === 'deselect') {
      this.state.selection = null;
      this.refresh();
      return;
    }
    if (action === 'zoom-in' || action === 'zoom-out') {
      this.canvas.zoom(action === 'zoom-in' ? 1.2 : 1 / 1.2);
      return;
    }
    if (action === 'reset-zoom') {
      this.canvas.zoom(1 / this.state.camera.zoom);
      return;
    }
    if (action === 'fit') {
      this.canvas.fit();
      return;
    }
    if (action === 'grid') {
      this.state.grid = !this.state.grid;
      this.refresh();
      return;
    }
    if (action === 'toggle-palette' || action === 'toggle-inspector') {
      const name = action === 'toggle-palette' ? 'palette-open' : 'inspector-open';
      this.classList.remove(name === 'palette-open' ? 'inspector-open' : 'palette-open');
      this.classList.toggle(name);
      return;
    }
    if (action === 'export' || action === 'export-svg') {
      this.export(action === 'export-svg' ? 'svg' : 'json');
      return;
    }
    if (action === 'save-json') {
      await this.saveJson();
      return;
    }
    if (action === 'mark-actual') {
      if (this.state.mode !== 'edit') return;
      const devices = this.state.document.devices;
      const hasIncompleteDevice = devices.some(
        (device) => !device.planning?.purchased || !device.planning?.installed,
      );
      const hasIncompleteLink = this.state.document.links.some((link) =>
        link.medium === 'wireless'
          ? !link.planning?.installed
          : !link.planning?.purchased || !link.planning?.installed,
      );
      if (!hasIncompleteDevice && !hasIncompleteLink) return;
      this.change(() => {
        for (const device of this.state.document.devices)
          device.planning = { ...device.planning, purchased: true, installed: true };
        for (const link of this.state.document.links)
          link.planning =
            link.medium === 'wireless'
              ? { ...link.planning, installed: true }
              : { ...link.planning, purchased: true, installed: true };
      });
      this.toast(t('actualStateSet'));
      return;
    }
    if (action === 'export-shopping') {
      const rows = [
        [
          t('room'),
          t('name'),
          t('deviceType'),
          t('quantity'),
          t('unitPrice'),
          t('lengthMeters'),
          t('lineTotal'),
          t('notes'),
        ],
        ...planningRows(
          planningEntries(this.state.document).filter(
            (entry) => entry.costable && !entry.item.planning?.purchased,
          ),
        ).map((entry) => [
          entry.room?.name || t('roomUnassigned'),
          entry.item.name ||
            (entry.kind === 'link'
              ? `${this.state.document.devices.find((device) => device.id === entry.item.source)?.name} → ${this.state.document.devices.find((device) => device.id === entry.item.target)?.name}`
              : ''),
          entry.kind === 'device'
            ? deviceName(entry.item.type)
            : entry.kind === 'link'
              ? mediumName(entry.item.medium)
              : t('material'),
          entry.kind === 'device'
            ? entry.devices?.length || 1
            : (entry.item.planning?.quantity ?? 1),
          entry.item.planning?.unitPrice ?? '',
          entry.kind === 'link' ? (entry.item.planning?.lengthMeters ?? '') : '',
          !entryPriced(entry) ? '' : money(entryCostCents(entry)),
          entry.item.planning?.notes || '',
        ]),
      ];
      downloadFile(
        this.state.document.name,
        '\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n'),
        'csv',
      );
      return;
    }
    if (!this.state.editing && this.state.mode !== 'build') {
      this.toast(t('editingRequired'));
      return;
    }
    if (action === 'add-material') {
      const id = NetworkModel.id();
      this.assembly.openItems.set(`material:${id}`, true);
      this.change(() => {
        (this.state.document.materials ||= []).push({
          id,
          name: t('newMaterial'),
          unit: 'piece',
          planning: { quantity: 1 },
        });
      });
      return;
    }
    if (action === 'import') {
      const picker = window as unknown as FilePickerApi;
      if (picker.showOpenFilePicker) await this.importWithPicker(picker);
      else (this.querySelector('.file-input') as HTMLInputElement).click();
      return;
    }
    if (action === 'add-bend' || action === 'reset-route') {
      const link = this.selected();
      if (!link || !('source' in link)) return;
      if (action === 'reset-route') {
        this.change(() => {
          delete link.waypoints;
        });
        return;
      }
      const source = this.state.document.devices.find((device) => device.id === link.source),
        target = this.state.document.devices.find((device) => device.id === link.target);
      if (source && target)
        this.addWaypoint(
          link.id,
          NetworkModel.route(link, source, target).label,
          Math.floor((link.waypoints?.length || 0) / 2),
        );
      return;
    }
    if (action === 'undo' || action === 'redo') {
      const from = action === 'undo' ? this.past : this.future,
        to = action === 'undo' ? this.future : this.past;
      const next = from.pop();
      if (!next) return;
      to.push(NetworkModel.clone(this.state.document));
      this.state.document = next;
      this.state.selection = null;
      this.state.connecting = null;
      this.save();
      this.refresh();
      return;
    }
    if (action === 'delete' && this.state.selection) {
      const selection = this.state.selection;
      this.change(() => {
        if (selection.kind === 'device') {
          this.state.document.devices = this.state.document.devices.filter(
            (item) => item.id !== selection.id,
          );
          this.state.document.links = this.state.document.links.filter(
            (link) => link.source !== selection.id && link.target !== selection.id,
          );
        } else if (selection.kind === 'room') {
          this.state.document.rooms = this.state.document.rooms.filter(
            (item) => item.id !== selection.id,
          );
          this.state.document.materials?.forEach((item) => {
            if (item.roomId === selection.id) delete item.roomId;
          });
        } else
          this.state.document.links = this.state.document.links.filter(
            (item) => item.id !== selection.id,
          );
        this.state.selection = null;
        this.state.connecting = null;
      });
      return;
    }
    if (action === 'duplicate') {
      const selected = this.selected();
      if (!selected || !('x' in selected)) return;
      this.change(() => {
        if ('type' in selected) {
          const copy = addDeviceReference(
            this.state.document,
            selected,
            { x: selected.x + 40, y: selected.y + 40 },
            `${selected.name.slice(0, 110)} ${t('copySuffix')}`,
          );
          this.state.selection = { kind: 'device', id: copy.id };
          return;
        }
        const copy = {
          ...structuredClone(selected),
          id: NetworkModel.id(),
          name: `${selected.name.slice(0, 110)} ${t('copySuffix')}`,
          x: selected.x + 40,
          y: selected.y + 40,
        };
        this.state.document.rooms.push(copy);
        this.state.selection = { kind: 'room', id: copy.id };
      });
      return;
    }
    if (action === 'detach-reference') {
      const selected = this.selected();
      if (selected && 'type' in selected)
        this.change(() => detachComponent(this.state.document, selected));
      return;
    }
    if ((action === 'new' || action === 'demo') && (await this.confirmReplace())) {
      const model = action === 'new' ? NetworkModel.empty() : NetworkModel.demo();
      if (action === 'new') model.name = t('defaultName');
      this.replace(model);
      this.toast(t(action === 'new' ? 'newCreated' : 'demoLoaded'));
    }
  }
  replace(model: MapDocument, fileHandle: WritableFileHandle | null = null) {
    this.jsonFileHandle = fileHandle;
    this.change(() => {
      this.state.document = model;
      this.state.selection = null;
      this.state.connecting = null;
      this.state.tool = 'select';
    });
    this.canvas.fit();
  }
  private startTour(): void {
    const previous = {
      mode: this.state.mode || 'edit',
      selection: this.state.selection,
      tool: this.state.tool,
      palette: this.classList.contains('palette-open'),
      inspector: this.classList.contains('inspector-open'),
    };
    this.tour.start(
      (step: TourStepId) => {
        const build = step === 'build';
        void this.action(build ? 'build' : 'edit');
        this.classList.remove('palette-open', 'inspector-open');
        if (['devices', 'references'].includes(step) && innerWidth <= 720)
          this.classList.add('palette-open');
        if (step === 'properties') {
          const device = this.state.document.devices[0];
          if (device) this.state.selection = { kind: 'device', id: device.id };
          if (innerWidth <= 950) this.classList.add('inspector-open');
        }
        this.refresh();
      },
      () => {
        void this.action(previous.mode);
        this.state.selection = previous.selection;
        this.state.tool = previous.tool;
        this.classList.toggle('palette-open', previous.palette);
        this.classList.toggle('inspector-open', previous.inspector);
        this.refresh();
      },
    );
  }
  confirmReplace() {
    const dialog = this.querySelector<HTMLDialogElement>('.replace-plan-dialog');
    if (!dialog) return Promise.resolve(false);
    dialog.returnValue = '';
    dialog.showModal();
    return new Promise((resolve) =>
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {
        once: true,
      }),
    );
  }
  export(format: 'json' | 'svg' = 'json') {
    const contents =
      format === 'svg' ? this.canvas.createSvg() : JSON.stringify(this.state.document, null, 2);
    downloadFile(this.state.document.name, contents, format);
    this.toast(t('exported', { format: format.toUpperCase() }));
  }
  parseFile(contents: string, svg: boolean): MapDocument {
    return parseDocument(contents, svg);
  }
  async importFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.importSelectedFile(file);
  }
  private async importWithPicker(picker: FilePickerApi): Promise<void> {
    try {
      const [handle] = await picker.showOpenFilePicker!({
        multiple: false,
        types: [
          {
            description: 'Network plan',
            accept: { 'application/json': ['.json'], 'image/svg+xml': ['.svg'] },
          },
        ],
      });
      if (!handle) return;
      await this.importSelectedFile(await handle.getFile(), handle);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        this.toast(errorMessage(error));
    }
  }
  private async importSelectedFile(file: File, fileHandle: WritableFileHandle | null = null) {
    if (this.state.mode === 'view') return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('error.fileTooLarge');
      const isSvg = file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml';
      const model = this.parseFile(await file.text(), isSvg);
      if (await this.confirmReplace()) {
        this.replace(model, isSvg ? null : fileHandle);
        this.toast(t('imported'));
      }
    } catch (error) {
      this.toast(errorMessage(error));
    }
  }
  private async saveJson(): Promise<void> {
    const picker = window as unknown as FilePickerApi;
    let handle = this.jsonFileHandle;
    try {
      if (!handle && picker.showSaveFilePicker)
        handle = await picker.showSaveFilePicker({
          suggestedName: `${this.state.document.name.replace(/[^\p{L}\p{N}_-]/gu, '-') || 'plan-your-net'}.json`,
          types: [{ description: 'JSON network plan', accept: { 'application/json': ['.json'] } }],
        });
      if (!handle) {
        this.export('json');
        return;
      }
      let permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted')
        permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        this.toast(t('savePermissionDenied'));
        return;
      }
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(this.state.document, null, 2));
      await writable.close();
      this.jsonFileHandle = handle;
      this.toast(t('jsonSaved'));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        this.toast(t('saveFailed'));
    }
  }
  keydown(event: KeyboardEvent) {
    const target = eventElement(event);
    if (target?.closest('input, select, textarea, dialog') || this.querySelector('dialog[open]'))
      return;
    if (event.key === 'Escape') {
      this.canvas.cancel();
      this.state.tool = 'select';
      this.state.connecting = null;
      this.state.selection = null;
      this.classList.remove('palette-open', 'inspector-open');
      this.refresh();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void this.saveJson();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      void this.action(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo');
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const shortcuts = {
      v: 'select',
      h: 'pan',
      r: 'room',
      c: 'connect',
      Delete: 'delete',
      Backspace: 'delete',
    } as Record<string, string>;
    if (shortcuts[event.key]) {
      event.preventDefault();
      void this.action(shortcuts[event.key]);
    }
    if (event.key === '+' || event.key === '=') this.canvas.zoom(1.2);
    if (event.key === '-') this.canvas.zoom(1 / 1.2);
    if (event.key.toLowerCase() === 'f') this.canvas.fit();
  }
}
