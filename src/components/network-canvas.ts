import * as NetworkModel from '../domain/model';
import type { EditorState, MapPoint, MapSelection } from '../domain/types';
import { eventElement, send } from '../editor/events';
import type { CanvasDrag } from '../editor/types';
import { t } from '../i18n';
import { renderDiagram } from '../rendering/diagram';
import { createSvg } from '../services/svg';
export class NetworkCanvas extends HTMLElement {
  initialized = false;
  state: EditorState | null = null;
  svg: SVGSVGElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  drag: CanvasDrag | null = null;
  preview: MapPoint | null = null;
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', t('networkPlan'));
    this.svg.setAttribute('tabindex', '0');
    this.append(this.svg);
    this.svg.addEventListener('pointerdown', (event) => this.pointerDown(event));
    this.svg.addEventListener('pointermove', (event) => this.pointerMove(event));
    this.svg.addEventListener('pointerup', (event) => this.pointerUp(event));
    this.svg.addEventListener('pointercancel', () => this.cancel());
    this.svg.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, { x: event.clientX, y: event.clientY });
      },
      { passive: false },
    );
    this.addEventListener('dragover', (event) => {
      if (this.state?.editing) event.preventDefault();
    });
    this.addEventListener('drop', (event) => {
      event.preventDefault();
      const reference = event.dataTransfer?.getData('application/x-plan-your-net-reference');
      if (reference && this.state?.editing) {
        send(this, {
          action: 'add-reference',
          id: reference,
          point: this.point(event.clientX, event.clientY),
        });
        return;
      }
      const type = event.dataTransfer?.getData('application/x-plan-your-net-device');
      if (type && this.state?.editing)
        send(this, { action: 'add-device', type, point: this.point(event.clientX, event.clientY) });
    });
    new ResizeObserver(() => this.render()).observe(this);
  }
  update(state: EditorState) {
    this.state = state;
    this.render();
  }
  point(clientX: number, clientY: number): MapPoint {
    const bounds = this.getBoundingClientRect();
    const camera = this.state?.camera || { x: 0, y: 0, zoom: 1 };
    return {
      x: (clientX - bounds.left - camera.x) / camera.zoom,
      y: (clientY - bounds.top - camera.y) / camera.zoom,
    };
  }
  center() {
    const rect = this.getBoundingClientRect();
    return this.point(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  zoom(factor: number, at?: MapPoint) {
    if (!this.state) return;
    const rect = this.getBoundingClientRect();
    const client = at || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const point = this.point(client.x, client.y),
      camera = this.state.camera;
    camera.zoom = Math.max(0.2, Math.min(2.5, camera.zoom * factor));
    camera.x = client.x - rect.left - point.x * camera.zoom;
    camera.y = client.y - rect.top - point.y * camera.zoom;
    this.render();
    send(this, { action: 'camera' });
  }
  fit() {
    if (!this.state) return;
    const bounds = NetworkModel.bounds(this.state.document);
    const width = this.clientWidth,
      height = this.clientHeight;
    const zoom = Math.max(
      0.15,
      Math.min(1.25, (width - 40) / bounds.width, (height - 120) / bounds.height),
    );
    Object.assign(this.state.camera, {
      zoom,
      x: (width - bounds.width * zoom) / 2 - bounds.x * zoom,
      y: (height - bounds.height * zoom) / 2 - bounds.y * zoom + 12,
    });
    this.render();
    send(this, { action: 'camera' });
  }
  render(exporting = false) {
    if (!this.state) return;
    this.dataset.tool = this.state.editing ? this.state.tool : 'pan';
    renderDiagram(this.svg, this.state, this.drag, this.preview, exporting);
  }
  createSvg() {
    if (!this.state) throw new Error('error.invalidDocument');
    return createSvg(this.svg, this.state.document, (exporting) => this.render(exporting));
  }
  pointerDown(event: PointerEvent) {
    if (!this.state || (event.button !== 0 && event.button !== 1)) return;
    const activeField = document.activeElement;
    if (activeField instanceof HTMLElement && activeField.closest('property-panel'))
      activeField.blur();
    const state = this.state,
      point = this.point(event.clientX, event.clientY);
    const target = eventElement(event)?.closest('[data-kind]');
    const labelTarget = eventElement(event)?.closest('[data-link-label]');
    const labelLinkId =
      labelTarget instanceof SVGElement ? labelTarget.dataset.linkLabel : undefined;
    const labelLink = state.document.links.find((link) => link.id === labelLinkId);
    const labelOrigin = labelLink
      ? labelLink.labelPosition ||
        NetworkModel.route(
          labelLink,
          state.document.devices.find((device) => device.id === labelLink.source)!,
          state.document.devices.find((device) => device.id === labelLink.target)!,
        ).label
      : null;
    const selection =
      target instanceof SVGElement
        ? ({ kind: target.dataset.kind, id: target.dataset.id } as MapSelection)
        : null;
    const waypoint = eventElement(event)?.closest('[data-waypoint]');
    const waypointIndex = waypoint instanceof SVGElement ? Number(waypoint.dataset.waypoint) : -1;
    const routeSegment = eventElement(event)?.closest('[data-route-index]');
    const routeIndex =
      routeSegment instanceof SVGElement ? Number(routeSegment.dataset.routeIndex) : 0;
    const wasSelected =
      selection?.kind === 'link' &&
      state.selection?.kind === 'link' &&
      state.selection.id === selection.id;
    if (state.editing && state.tool === 'connect' && event.button === 0) {
      if (selection?.kind === 'device') send(this, { action: 'connect', id: selection.id });
      return;
    }
    const mode =
      event.button === 1 || state.tool === 'pan' || !state.editing
        ? 'pan'
        : state.tool === 'room'
          ? 'room'
          : labelLink && state.tool === 'select'
            ? 'link-label'
            : waypointIndex >= 0
              ? 'waypoint'
              : selection?.kind === 'device'
                ? 'device'
                : selection?.kind === 'room'
                  ? eventElement(event)?.hasAttribute('data-resize')
                    ? 'resize'
                    : 'room-move'
                  : 'select';
    if (mode !== 'pan' && mode !== 'room')
      send(this, { action: 'select', ...(selection || { kind: null, id: null }) });
    if (!state.editing && selection) send(this, { action: 'select', ...selection });
    const item =
      selection?.kind === 'device'
        ? state.document.devices.find((entry) => entry.id === selection.id)
        : state.document.rooms.find((entry) => entry.id === selection?.id);
    const room =
      selection?.kind === 'room'
        ? state.document.rooms.find((entry) => entry.id === selection.id)
        : null;
    this.drag = {
      mode,
      start: point,
      last: { x: event.clientX, y: event.clientY },
      selection,
      before: NetworkModel.clone(state.document),
      moved: false,
      origin: labelOrigin || (item ? { x: item.x, y: item.y } : { x: 0, y: 0 }),
      width: room?.width || 0,
      height: room?.height || 0,
      members: room
        ? state.document.devices
            .filter(
              (device) =>
                device.x > room.x &&
                device.x < room.x + room.width &&
                device.y > room.y &&
                device.y < room.y + room.height,
            )
            .map((device) => device.id)
        : [],
      waypointIndex,
      routeIndex,
      wasSelected,
    };
    this.svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  pointerMove(event: PointerEvent) {
    if (!this.state) return;
    const point = this.point(event.clientX, event.clientY),
      drag = this.drag;
    this.preview = point;
    if (!drag) {
      if (this.state.connecting) this.render();
      return;
    }
    const dx = point.x - drag.start.x,
      dy = point.y - drag.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.mode === 'pan') {
      this.state.camera.x += event.clientX - drag.last.x;
      this.state.camera.y += event.clientY - drag.last.y;
    } else if (drag.mode === 'waypoint' && drag.moved) {
      const link = this.state.document.links.find((entry) => entry.id === drag.selection?.id);
      if (link?.waypoints?.[drag.waypointIndex])
        link.waypoints[drag.waypointIndex] = {
          x: Math.max(-20000, Math.min(20000, Math.round(point.x / 10) * 10)),
          y: Math.max(-20000, Math.min(20000, Math.round(point.y / 10) * 10)),
        };
    } else if (drag.mode === 'link-label' && drag.moved) {
      const link = this.state.document.links.find((entry) => entry.id === drag.selection?.id);
      if (link)
        link.labelPosition = {
          x: Math.round(drag.origin.x + dx),
          y: Math.round(drag.origin.y + dy),
        };
    } else if (drag.mode === 'device' || drag.mode === 'room-move' || drag.mode === 'resize') {
      const item =
        drag.mode === 'device'
          ? this.state.document.devices.find((entry) => entry.id === drag.selection?.id)
          : this.state.document.rooms.find((entry) => entry.id === drag.selection?.id);
      if (item && drag.moved) {
        if (drag.mode === 'resize' && 'width' in item) {
          item.width = Math.max(140, Math.round((drag.width + dx) / 10) * 10);
          item.height = Math.max(120, Math.round((drag.height + dy) / 10) * 10);
        } else {
          item.x = Math.round((drag.origin.x + dx) / 10) * 10;
          item.y = Math.round((drag.origin.y + dy) / 10) * 10;
          if (drag.mode === 'room-move')
            for (const id of drag.members) {
              const member = this.state.document.devices.find((device) => device.id === id),
                original = drag.before.devices.find((device) => device.id === id);
              if (member && original) {
                member.x = original.x + item.x - drag.origin.x;
                member.y = original.y + item.y - drag.origin.y;
              }
            }
        }
      }
    }
    drag.last = { x: event.clientX, y: event.clientY };
    this.render();
  }
  pointerUp(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || !this.state) return;
    const end = this.point(event.clientX, event.clientY);
    this.drag = null;
    this.preview = null;
    if (this.svg.hasPointerCapture(event.pointerId))
      this.svg.releasePointerCapture(event.pointerId);
    if (drag.mode === 'room') {
      if (Math.abs(end.x - drag.start.x) >= 30 && Math.abs(end.y - drag.start.y) >= 30)
        send(this, {
          action: 'add-room',
          x: Math.round(Math.min(end.x, drag.start.x) / 10) * 10,
          y: Math.round(Math.min(end.y, drag.start.y) / 10) * 10,
          width: Math.max(140, Math.round(Math.abs(end.x - drag.start.x) / 10) * 10),
          height: Math.max(120, Math.round(Math.abs(end.y - drag.start.y) / 10) * 10),
        });
      else send(this, { action: 'hint', message: t('roomTooSmallHint') });
    } else if (
      drag.moved &&
      ['device', 'room-move', 'resize', 'waypoint', 'link-label'].includes(drag.mode)
    )
      send(this, { action: 'drag-commit', before: drag.before });
    else if (!drag.moved && drag.mode === 'select' && drag.wasSelected && drag.selection)
      send(this, {
        action: 'add-waypoint',
        id: drag.selection.id,
        point: end,
        index: drag.routeIndex,
      });
    else if (drag.mode === 'pan') send(this, { action: 'camera' });
    this.render();
  }
  cancel() {
    if (this.drag && this.state && this.drag.mode !== 'pan') this.state.document = this.drag.before;
    this.drag = null;
    this.preview = null;
    this.render();
  }
}
