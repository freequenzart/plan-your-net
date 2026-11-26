import { id } from './document';
import type { MapDevice, MapDocument, MapPoint } from './types';

export function componentKey(device: MapDevice): string {
  return device.componentId || device.id;
}

export function componentMembers(document: MapDocument, key: string): MapDevice[] {
  return document.devices.filter((device) => componentKey(device) === key);
}

export function componentGroups(document: MapDocument): MapDevice[][] {
  const groups = new Map<string, MapDevice[]>();
  for (const device of document.devices) {
    const key = componentKey(device);
    const group = groups.get(key) || [];
    group.push(device);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function componentSignature(device: MapDevice): string {
  return JSON.stringify({
    type: device.type,
    specifications: device.specifications || {},
    attributes: device.attributes || [],
    manufacturer: device.planning?.manufacturer,
    model: device.planning?.model,
    unitPrice: device.planning?.unitPrice,
  });
}

export function detachComponent(document: MapDocument, device: MapDevice): void {
  if (componentMembers(document, componentKey(device)).length > 1) device.componentId = id();
}

export function addDeviceReference(
  document: MapDocument,
  source: MapDevice,
  point: MapPoint,
  name = source.name,
): MapDevice {
  source.componentId ||= id();
  const copy = structuredClone(source);
  copy.id = id();
  copy.name = name;
  copy.ip = '';
  copy.x = point.x;
  copy.y = point.y;
  if (copy.planning) {
    delete copy.planning.quantity;
    delete copy.planning.notes;
    delete copy.planning.purchased;
    delete copy.planning.installed;
  }
  document.devices.push(copy);
  return copy;
}
