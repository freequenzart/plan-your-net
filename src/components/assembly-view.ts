import {
  entryCostCents,
  planningGroups,
  planningSummary,
  deviceRoom,
  type PlanningFilter,
  type PlanningGroup,
  type PlanningGrouping,
  type PlanningEntry,
} from '../domain/planning';
import type { PlanningKind } from '../domain/planning-updates';
import type { MapDocument } from '../domain/types';
import { eventElement, send } from '../editor/events';
import { deviceName, mediumName, t } from '../i18n';
import { FieldCommitter, retainFieldFocus } from '../ui/field-committer';
import { html } from '../ui/html';
import {
  customFields,
  linkFields,
  money,
  notesField,
  planInput,
  planningFields,
  specificationFieldsHtml,
} from '../ui/planning-fields';
import { icon, iconButton } from '../ui/templates';
import { componentKey, componentMembers } from '../domain/components';
import { ListTransition } from '../ui/list-transition';

export class AssemblyView extends HTMLElement {
  private initialized = false;
  private documentModel: MapDocument | null = null;
  private committer = new FieldCommitter();
  private filter: PlanningFilter = 'planned';
  private grouping: PlanningGrouping = 'room';
  private transition = new ListTransition(this);
  private animateStatusChange = false;
  readonly openItems = new Map<string, boolean>();

  update(document: MapDocument): void {
    let finishTransition = () => {};
    if (this.animateStatusChange) finishTransition = this.transition.capture();
    else this.transition.cancel();
    this.animateStatusChange = false;
    const restoreFocus = retainFieldFocus(this);
    this.documentModel = document;
    this.querySelectorAll<HTMLDetailsElement>('details[data-open-key]').forEach((details) =>
      this.openItems.set(details.dataset.openKey || '', details.open),
    );
    const summary = planningSummary(document);
    const groups = planningGroups(document, this.grouping, this.filter).sort((left, right) => {
      if (left.kind === 'room' && !left.room) return 1;
      if (right.kind === 'room' && !right.room) return -1;
      return this.groupName(left).localeCompare(this.groupName(right));
    });
    this.innerHTML = `<div class="assembly-header"><div><span class="section-eyebrow">PLAN YOUR NET / ${t('buildMode')}</span><h1>${t('implementation')}</h1><p>${html(document.name)}</p></div><div class="assembly-actions"><button class="button secondary" data-action="export-shopping">${icon('download', 16)}${t('exportShopping')}</button><button class="button primary" data-action="add-material">${icon('plus', 16)}${t('addMaterial')}</button></div></div>
      <div class="assembly-metrics"><div><span>${t('estimatedTotal')}</span><strong>${money(summary.totalCents)}</strong><small>${t('unpriced', { count: summary.unpriced })}</small></div><div><span>${t('remainingBudget')}</span><strong>${money(summary.remainingCents)}</strong><small>${t('shoppingList')}</small></div><div><span>${t('cableLength')}</span><strong>${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(summary.cableMeters)} m</strong><small>${t('medium.ethernet')} / ${t('medium.fiber')}</small></div><div><span>${t('progress')}</span><strong>${summary.count ? Math.round((summary.installed / summary.count) * 100) : 0} %</strong><progress value="${summary.installed}" max="${summary.count || 1}" aria-label="${t('progress')}"></progress><small>${t('completedItems', { done: summary.installed, total: summary.count })}</small></div></div>
      <div class="assembly-toolbar"><div class="assembly-filters" role="group" aria-label="${t('statusView')}">${(['planned', 'actual', 'shopping', 'open'] as const).map((filter) => `<button data-plan-filter="${filter}" aria-pressed="${this.filter === filter}" class="${this.filter === filter ? 'active' : ''}">${t(filter === 'planned' ? 'plannedState' : filter === 'actual' ? 'actualState' : filter === 'open' ? 'openOnly' : 'shoppingList')}</button>`).join('')}</div><label class="assembly-grouping">${t('groupBy')}<select name="assembly-grouping" aria-label="${t('groupBy')}"><option value="room" ${this.grouping === 'room' ? 'selected' : ''}>${t('groupByRoom')}</option><option value="deviceType" ${this.grouping === 'deviceType' ? 'selected' : ''}>${t('groupByDeviceType')}</option></select></label><div class="assembly-history">${iconButton('undo', 'undo-2', t('undo'))}${iconButton('redo', 'redo-2', t('redo'))}</div></div>
      <details class="project-notes" data-entry-kind="document" data-entry-id="" data-open-key="project" ${this.openItems.get('project') ? 'open' : ''}><summary>${icon('pencil', 15)}${t('projectNotes')}${document.notes ? '<span class="note-indicator"></span>' : ''}</summary>${notesField('notes', document.notes, 'projectNotes')}</details>
      <div class="assembly-groups">${
        groups.map((group) => this.renderGroup(group, document)).join('') ||
        `<div class="assembly-empty">${icon('circle-check', 32)}<p>${t('noPlanItems')}</p></div>`
      }</div>`;
    this.querySelectorAll<HTMLInputElement>('input[data-partial]').forEach((input) => {
      input.indeterminate = true;
    });
    restoreFocus();
    finishTransition();
  }

  private groupName(group: PlanningGroup): string {
    if (group.kind === 'room') return group.room?.name || t('roomUnassigned');
    if (group.kind === 'deviceType')
      return deviceName(group.deviceType, this.documentModel?.customDeviceTypes);
    if (group.kind === 'medium')
      return group.medium === 'wireless'
        ? mediumName(group.medium)
        : t('cableGroup', { medium: mediumName(group.medium) });
    return t('material');
  }

  private renderGroup(group: PlanningGroup, document: MapDocument): string {
    const room = group.kind === 'room' ? group.room : undefined;
    const entries = [...group.entries].sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        this.entryName(left).localeCompare(this.entryName(right)),
    );
    const notes = room
      ? `<details class="room-notes" data-entry-kind="room" data-entry-id="${html(room.id)}" data-open-key="room:${html(room.id)}" ${this.openItems.get(`room:${room.id}`) ? 'open' : ''}><summary>${t('roomNotes')}${room.notes ? '<span class="note-indicator"></span>' : ''}</summary>${notesField('notes', room.notes, 'roomNotes')}</details>`
      : '';
    return `<section class="assembly-room" data-plan-group="${html(group.key)}"><header><span class="room-marker" style="background:${room?.color || '#697987'}"></span><h2>${html(this.groupName(group))}</h2><span class="room-item-count">${entries.length}</span><strong>${money(entries.reduce((sum, entry) => sum + entryCostCents(entry), 0))}</strong></header>${notes}${entries.map((entry) => this.renderEntry(entry, document)).join('')}</section>`;
  }

  private entryName(entry: PlanningEntry): string {
    if (entry.kind === 'device' && this.documentModel) {
      const source =
        componentMembers(this.documentModel, componentKey(entry.item))[0] || entry.item;
      return source.planning?.model || source.name;
    }
    if (entry.kind !== 'link') return entry.item.name;
    const document = this.documentModel;
    return (
      entry.item.name ||
      `${document?.devices.find((device) => device.id === entry.item.source)?.name || ''} → ${document?.devices.find((device) => device.id === entry.item.target)?.name || ''}`
    );
  }

  private renderEntry(entry: PlanningEntry, document: MapDocument): string {
    const members = entry.kind === 'device' ? entry.devices || [entry.item] : [];
    const allMembers =
      entry.kind === 'device' ? componentMembers(document, componentKey(entry.item)) : [];
    const quantity =
      entry.kind === 'device' ? members.length : (entry.item.planning?.quantity ?? 1);
    const purchased = members.filter((device) => device.planning?.purchased).length;
    const installed = members.filter((device) => device.planning?.installed).length;
    const plan =
      entry.kind === 'device'
        ? {
            ...entry.item.planning,
            purchased: purchased === quantity,
            installed: installed === quantity,
          }
        : entry.item.planning;
    const ownerKind = entry.kind === 'device' ? 'component' : entry.kind;
    const ownerId = entry.kind === 'device' ? componentKey(entry.item) : entry.item.id;
    const key =
      entry.kind === 'device'
        ? JSON.stringify([
            ownerKind,
            ownerId,
            this.grouping === 'room' ? entry.room?.id || '' : 'deviceType',
          ])
        : `${entry.kind}:${entry.item.id}`;
    const label =
      entry.kind === 'device'
        ? [
            deviceName(entry.item.type, document.customDeviceTypes),
            this.grouping === 'deviceType'
              ? [
                  ...new Set(
                    members.map(
                      (device) => deviceRoom(document, device)?.name || t('roomUnassigned'),
                    ),
                  ),
                ].join(', ')
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : entry.kind === 'link'
          ? `${mediumName(entry.item.medium)} · ${entry.item.speed}`
          : t('material');
    const price = entry.costable
      ? `<label class="inline-unit-price"><span>${t('unitPrice')}</span><input type="number" name="planning.unitPrice" min="0" max="1000000" step="0.01" value="${html(plan?.unitPrice ?? '')}" placeholder="—" aria-label="${t('unitPrice')}" title="${html(allMembers.length > 1 ? t('componentPricing', { count: allMembers.length }) : t('unitPrice'))}"></label>`
      : '—';
    const fields = planningFields(
      plan,
      entry.kind === 'link' && entry.costable,
      entry.costable,
      entry.kind === 'material' && entry.item.unit === 'meter',
      { quantity: entry.kind !== 'device', price: false },
    );
    const instances = members.length
      ? `<section class="assembly-instances"><h3>${t('instances')}</h3>${allMembers.length > 1 ? `<p class="muted">${t('componentPricing', { count: allMembers.length })}</p>` : ''}${members.map((device) => `<div class="assembly-instance" data-entry-kind="device" data-entry-id="${html(device.id)}"><button type="button" class="instance-name" data-inspect-device="${html(device.id)}" title="${t('edit')}">${html(device.name)}${icon('pencil', 13)}<small>${html(device.ip)}</small></button><label><input type="checkbox" name="planning.purchased" ${device.planning?.purchased ? 'checked' : ''}>${t('purchased')}</label><label><input type="checkbox" name="planning.installed" ${device.planning?.installed ? 'checked' : ''}>${t('installed')}</label></div>`).join('')}</section>`
      : '';
    return `<details class="assembly-item ${plan?.installed ? 'is-installed' : ''}" data-entry-kind="${ownerKind}" data-entry-id="${html(ownerId)}" data-device-ids="${html(JSON.stringify(members.map((device) => device.id)))}" data-open-key="${html(key)}" ${this.openItems.get(key) ? 'open' : ''}>
      <summary><span class="assembly-entry-icon">${icon(entry.kind === 'device' ? 'network' : entry.kind === 'link' ? 'cable' : 'blocks', 20)}</span><span class="assembly-item-name"><strong>${html(this.entryName(entry))}</strong><small>${html(label)}</small></span><span class="assembly-quantity" title="${t('quantity')}">${quantity}×</span><span class="assembly-item-status">${entry.costable ? `<label><input type="checkbox" name="planning.purchased" ${plan?.purchased ? 'checked' : ''} ${purchased > 0 && purchased < quantity ? 'data-partial="true"' : ''}>${t('purchased')}${purchased > 0 && purchased < quantity ? ` (${purchased}/${quantity})` : ''}</label>` : ''}<label><input type="checkbox" name="planning.installed" ${plan?.installed ? 'checked' : ''} ${installed > 0 && installed < quantity ? 'data-partial="true"' : ''}>${t('installed')}${installed > 0 && installed < quantity ? ` (${installed}/${quantity})` : ''}</label></span><span class="assembly-item-cost">${price}</span>${icon('chevron-down', 16)}</summary>
      <div class="assembly-item-body"><form class="properties" ${entry.kind === 'device' ? `data-entry-kind="device" data-entry-id="${html(entry.item.id)}"` : ''}><fieldset><h3>${t('moreDetails')}${members.length > 1 ? ` · ${html(entry.item.name)}` : ''}</h3>${members.length > 1 ? `<p class="muted">${t('referenceNotice', { count: allMembers.length })}</p>` : ''}${entry.kind === 'material' ? `${planInput('name', 'name', entry.item.name)}<div class="planning-fields"><label>${t('room')}<select name="roomId"><option value="" ${!entry.item.roomId ? 'selected' : ''}>${t('roomUnassigned')}</option>${document.rooms.map((room) => `<option value="${html(room.id)}" ${entry.item.roomId === room.id ? 'selected' : ''}>${html(room.name)}</option>`).join('')}</select></label><label>${t('unit')}<select name="unit"><option value="piece" ${entry.item.unit === 'piece' ? 'selected' : ''}>${t('piece')}</option><option value="meter" ${entry.item.unit === 'meter' ? 'selected' : ''}>${t('meter')}</option></select></label></div>` : ''}${entry.kind === 'link' ? linkFields(entry.item) : ''}${fields}</fieldset></form>${entry.kind === 'device' ? `<form class="properties assembly-specifications" data-entry-kind="device" data-entry-id="${html(entry.item.id)}"><fieldset><details class="property-disclosure"><summary>${t('technicalDetails')}${icon('chevron-down', 15)}</summary><div>${specificationFieldsHtml(entry.item)}<h3>${t('customProperties')}</h3>${customFields(entry.item)}</div></details></fieldset></form>` : ''}${instances}${entry.kind === 'material' ? `<button class="button danger" data-remove-material="${html(entry.item.id)}">${icon('trash-2', 16)}${t('delete')}</button>` : ''}</div></details>`;
  }

  connectedCallback(): void {
    if (this.initialized) return;
    this.initialized = true;
    const commit = (event: Event) =>
      this.committer.commit(this, event.target, (field, value) => {
        const owner = field.closest<HTMLElement>('[data-entry-kind]');
        if (
          value === true &&
          ((this.filter === 'shopping' && field.name === 'planning.purchased') ||
            (this.filter === 'open' && field.name === 'planning.installed'))
        )
          this.animateStatusChange = true;
        if (owner)
          send(this, {
            action: 'plan-change',
            kind: owner.dataset.entryKind as PlanningKind,
            id: owner.dataset.entryId || '',
            name: field.name,
            value,
            deviceIds: owner.dataset.deviceIds
              ? (JSON.parse(owner.dataset.deviceIds) as string[])
              : undefined,
          });
      });
    this.addEventListener('change', (event) => {
      const field = event.target;
      if (field instanceof HTMLSelectElement && field.name === 'assembly-grouping') {
        if (field.value !== 'room' && field.value !== 'deviceType') return;
        this.animateStatusChange = false;
        this.grouping = field.value;
        if (this.documentModel) this.update(this.documentModel);
      } else commit(event);
    });
    this.addEventListener('focusout', commit);
    this.addEventListener('submit', (event) => event.preventDefault());
    this.addEventListener('click', (event) => {
      const button = eventElement(event)?.closest<HTMLElement>(
        '[data-plan-filter], [data-plan-command], [data-remove-material], [data-inspect-device]',
      );
      if (!button) return;
      if (button.dataset.inspectDevice) {
        send(this, { action: 'inspect-device', id: button.dataset.inspectDevice });
      } else if (button.dataset.planFilter) {
        this.animateStatusChange = false;
        this.filter = button.dataset.planFilter as typeof this.filter;
        if (this.documentModel) this.update(this.documentModel);
      } else if (button.dataset.removeMaterial)
        send(this, { action: 'remove-material', id: button.dataset.removeMaterial });
      else if (button.dataset.planCommand) {
        const owner = button.closest<HTMLElement>('[data-entry-kind]');
        if (owner)
          send(this, {
            action: 'plan-change',
            kind: owner.dataset.entryKind as PlanningKind,
            id: owner.dataset.entryId || '',
            name: button.dataset.planCommand,
            value: undefined,
          });
      }
    });
  }
  disconnectedCallback(): void {
    this.transition.cancel();
  }
}
