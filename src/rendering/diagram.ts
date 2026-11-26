import * as NetworkModel from '../domain/model';
import { deviceIcon } from '../domain/catalog';
import { isActualState } from '../domain/planning';
import type { EditorState, MapPoint } from '../domain/types';
import type { CanvasDrag } from '../editor/types';
import { t } from '../i18n';
import { html } from '../ui/html';
import { diagramColor, icon } from '../ui/templates';
export function renderDiagram(
  svg: SVGSVGElement,
  state: EditorState,
  drag: CanvasDrag | null,
  previewPoint: MapPoint | null,
  exporting = false,
) {
  const colorStatus = !exporting && state.mode === 'view';
  const model = {
    ...state.document,
    devices: state.document.devices.map((item) => ({ ...item, color: diagramColor(item.color) })),
    rooms: state.document.rooms.map((item) => ({ ...item, color: diagramColor(item.color) })),
    links: state.document.links.map((item) => ({ ...item, color: diagramColor(item.color) })),
  };
  const camera = exporting ? { x: 0, y: 0, zoom: 1 } : state.camera;
  const selection = exporting ? null : state.selection;
  const editing = state.editing && !exporting;
  const styles = getComputedStyle(document.documentElement);
  const surface = styles.getPropertyValue('--node-surface').trim() || '#ffffff';
  const border = styles.getPropertyValue('--node-border').trim() || '#dfe7e5';
  const background = styles.getPropertyValue('--canvas').trim();
  const gridColor = styles.getPropertyValue('--grid-dot').trim() || '#cfd9d6';
  svg.setAttribute('aria-label', t('networkPlan'));
  const selected = (kind: string, id: string) => selection?.kind === kind && selection.id === id;
  const rooms = model.rooms
    .map(
      (room) =>
        `<g data-kind="room" data-id="${html(room.id)}" class="map-room ${selected('room', room.id) ? 'is-selected' : ''}"><rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.height}" rx="12" fill="${room.color}" fill-opacity=".035" stroke="${room.color}" stroke-opacity="${selected('room', room.id) ? 1 : 0.26}" stroke-width="${selected('room', room.id) ? 2 : 1.5}"/><text x="${room.x + 20}" y="${room.y + 29}" fill="${room.color}" class="room-label"><title>${html(room.name)}</title>${html(room.name.slice(0, Math.max(10, Math.floor((room.width - 40) / 7))))}</text>${editing && selected('room', room.id) ? `<rect class="resize-handle" data-resize="true" x="${room.x + room.width - 11}" y="${room.y + room.height - 11}" width="14" height="14" rx="3" fill="${room.color}" stroke="${surface}" stroke-width="2"/>` : ''}</g>`,
    )
    .join('');
  const links = model.links
    .map((link) => {
      const actual = isActualState(link, link.medium !== 'wireless');
      const status = colorStatus ? (actual ? 'actual' : 'planned') : '';
      const lineColor = colorStatus ? (actual ? '#39836b' : '#cf8737') : link.color;
      const source = model.devices.find((item) => item.id === link.source),
        target = model.devices.find((item) => item.id === link.target);
      if (!source || !target) return '';
      const route = NetworkModel.route(link, source, target);
      return `<g class="map-link ${selected('link', link.id) ? 'is-selected' : ''} ${status ? `status-${status}` : ''}" data-kind="link" data-id="${html(link.id)}" ${status ? `data-status="${status}"` : ''}><path class="visible-link" d="${route.path}" fill="none" stroke="${lineColor}" stroke-width="${selected('link', link.id) ? 4 : link.medium === 'fiber' ? 3 : 2}" ${link.medium === 'wireless' ? 'stroke-dasharray="6 6"' : ''} stroke-linejoin="round" stroke-linecap="round"/>${!exporting ? route.segments.map((segment) => `<path data-route-index="${segment.index}" d="M${segment.start.x},${segment.start.y} L${segment.end.x},${segment.end.y}" fill="none" stroke="transparent" stroke-width="18"/>`).join('') : ''}${editing && selected('link', link.id) ? (link.waypoints || []).map((point, index) => `<circle class="waypoint-handle" data-waypoint="${index}" cx="${point.x}" cy="${point.y}" r="${5 / camera.zoom}" fill="${surface}" stroke="${lineColor}" stroke-width="2" vector-effect="non-scaling-stroke"><title>${t('bendPoint', { number: index + 1 })}</title></circle>`).join('') : ''}</g>`;
    })
    .join('');
  const linkLabels = model.links
    .map((link) => {
      const source = model.devices.find((item) => item.id === link.source);
      const target = model.devices.find((item) => item.id === link.target);
      if (!source || !target) return '';
      const route = NetworkModel.route(link, source, target);
      const position = link.labelPosition || route.label;
      const label = link.name || link.speed;
      const width = Math.max(70, label.length * 6.4);
      const actual = isActualState(link, link.medium !== 'wireless');
      const lineColor = colorStatus ? (actual ? '#39836b' : '#cf8737') : link.color;
      return `<g class="link-label-group ${editing ? 'is-draggable' : ''} ${selected('link', link.id) ? 'is-selected' : ''}" data-kind="link" data-id="${html(link.id)}" data-link-label="${html(link.id)}" transform="translate(${position.x},${position.y})" aria-label="${html(label)}"><title>${html(editing ? t('dragLinkLabel') : label)}</title><rect x="${-width / 2}" y="-10" width="${width}" height="20" rx="5" fill="${surface}" stroke="${selected('link', link.id) ? lineColor : border}"/><text x="0" y="3.5" text-anchor="middle" class="link-label" fill="${lineColor}">${html(label)}</text></g>`;
    })
    .join('');
  const devices = model.devices
    .map((device) => {
      const actual = isActualState(device, true);
      const status = colorStatus ? (actual ? 'actual' : 'planned') : '';
      const statusColor = actual ? '#39836b' : '#cf8737';
      const active =
        selected('device', device.id) || (!exporting && state.connecting === device.id);
      return `<g class="map-device ${active ? 'is-selected' : ''} ${status ? `status-${status}` : ''}" data-kind="device" data-id="${html(device.id)}" ${status ? `data-status="${status}"` : ''} transform="translate(${device.x},${device.y})" role="button" aria-label="${html(device.name)}"><title>${html(device.name)}${device.ip ? ` · ${html(device.ip)}` : ''}</title>${active ? `<rect x="-38" y="-38" width="76" height="76" rx="21" fill="none" stroke="${device.color}" stroke-width="1.5" stroke-dasharray="4 3"/>` : ''}<rect x="-31" y="-31" width="62" height="62" rx="16" fill="${status ? statusColor : surface}" fill-opacity="${status ? '.13' : '1'}" stroke="${status ? statusColor : active ? device.color : border}" stroke-opacity="${status ? '.75' : '1'}" stroke-width="${active ? 2 : 1.5}" filter="url(#node-shadow)"/><rect x="-25" y="-25" width="50" height="50" rx="12" fill="${device.color}" fill-opacity=".07"/><g transform="translate(-14,-14)" color="${device.color}">${icon(deviceIcon(device.type, model.customDeviceTypes), 28)}</g><circle cx="23" cy="-23" r="4.5" fill="${status ? statusColor : device.color}" stroke="${surface}" stroke-width="2"/><text y="51" text-anchor="middle" class="device-name">${html(device.name.length > 23 ? device.name.slice(0, 21) + '…' : device.name)}</text>${device.ip ? `<text y="67" text-anchor="middle" class="device-ip">${html(device.ip.length > 25 ? device.ip.slice(0, 23) + '…' : device.ip)}</text>` : ''}</g>`;
    })
    .join('');
  let preview = '';
  if (!exporting && drag?.mode === 'room' && previewPoint) {
    const start = drag.start;
    preview = `<rect x="${Math.min(start.x, previewPoint.x)}" y="${Math.min(start.y, previewPoint.y)}" width="${Math.abs(start.x - previewPoint.x)}" height="${Math.abs(start.y - previewPoint.y)}" fill="#167d6710" stroke="#167d67" stroke-dasharray="6 4" rx="10"/>`;
  }
  if (!exporting && state.connecting && previewPoint) {
    const source = model.devices.find((item) => item.id === state.connecting);
    if (source)
      preview += `<path d="M${source.x},${source.y} L${previewPoint.x},${previewPoint.y}" stroke="#167d67" stroke-width="2" stroke-dasharray="6 4"/>`;
  }
  const gridSize = 24 * camera.zoom;
  svg.innerHTML = `<defs><pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse" x="${camera.x % gridSize}" y="${camera.y % gridSize}"><circle cx="1" cy="1" r=".8" fill="${gridColor}"/></pattern><filter id="node-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#233d35" flood-opacity=".055"/></filter></defs><rect class="diagram-background" width="100%" height="100%" fill="${state.grid && !exporting ? 'url(#grid)' : background}"/><g class="diagram-content" transform="translate(${camera.x},${camera.y}) scale(${camera.zoom})">${rooms}${links}${devices}${preview}${linkLabels}</g>`;
}
