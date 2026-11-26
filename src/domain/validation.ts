import { customDeviceIcons, media, speeds, types } from './catalog';
import { LegacyMediaNames } from './legacy';
import { validatePlanning } from './planning';
import { validateAttributes, validateSpecifications } from './specifications';
import { componentKey, componentSignature } from './components';
import type { MapDocument, MapMaterial, MapMedium, MapPoint } from './types';
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validate(input: unknown): MapDocument {
  if (!input || typeof input !== 'object') throw new Error('error.invalidDocument');
  const raw = input as Record<string, unknown>;
  if (
    raw.version !== 1 ||
    !Array.isArray(raw.devices) ||
    !Array.isArray(raw.rooms) ||
    !Array.isArray(raw.links)
  )
    throw new Error('error.invalidFormat');
  if (raw.devices.length > 1000 || raw.rooms.length > 300 || raw.links.length > 5000)
    throw new Error('error.documentTooLarge');
  const text = (value: unknown, max: number = 120) => {
    if (typeof value !== 'string' || value.length > max) throw new Error('error.invalidText');
    return value;
  };
  const number = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 20000)
      throw new Error('error.invalidPosition');
    return value;
  };
  const color = (value: unknown) => {
    const result = text(value);
    if (!/^#[0-9a-f]{6}$/i.test(result)) throw new Error('error.invalidColor');
    return result;
  };
  const ids = new Set();
  const uniqueId = (value: unknown) => {
    const result = text(value);
    if (!result || ids.has(result)) throw new Error('error.invalidId');
    ids.add(result);
    return result;
  };
  if (
    raw.customDeviceTypes !== undefined &&
    (!Array.isArray(raw.customDeviceTypes) || raw.customDeviceTypes.length > 100)
  )
    throw new Error('error.invalidDeviceType');
  const customTypeIds = new Set<string>();
  const customDeviceTypes = (raw.customDeviceTypes || []).map((item: unknown) => {
    if (!isRecord(item)) throw new Error('error.invalidDeviceType');
    const id = text(item.id, 80);
    const name = text(item.name, 80);
    const icon = text(item.icon, 40);
    if (
      !/^custom-[a-z0-9-]+$/i.test(id) ||
      !name.trim() ||
      !customDeviceIcons.includes(icon as (typeof customDeviceIcons)[number])
    )
      throw new Error('error.invalidDeviceType');
    if (customTypeIds.has(id) || types.some((type) => type.id === id))
      throw new Error('error.invalidDeviceType');
    customTypeIds.add(id);
    return { id, name, icon };
  });
  const validDeviceTypes = new Set([
    ...types.map((type) => type.id),
    ...customDeviceTypes.map((type) => type.id),
  ]);
  const devices = raw.devices.map((item: unknown) => {
    if (!isRecord(item)) throw new Error('error.invalidDevice');
    const type = text(item.type);
    if (!validDeviceTypes.has(type)) throw new Error('error.invalidDeviceType');
    return {
      id: uniqueId(item.id),
      ...(item.componentId !== undefined ? { componentId: text(item.componentId) } : {}),
      type,
      name: text(item.name),
      ip: text(item.ip),
      color: color(item.color),
      x: number(item.x),
      y: number(item.y),
      ...(item.planning !== undefined ? { planning: validatePlanning(item.planning) } : {}),
      ...(item.specifications !== undefined
        ? { specifications: validateSpecifications(item.specifications) }
        : {}),
      ...(item.attributes !== undefined ? { attributes: validateAttributes(item.attributes) } : {}),
    };
  });
  const signatures = new Map<string, string>();
  for (const device of devices) {
    if (device.componentId === '') throw new Error('error.invalidReference');
    const key = componentKey(device),
      signature = componentSignature(device);
    if (signatures.has(key) && signatures.get(key) !== signature)
      throw new Error('error.invalidReference');
    signatures.set(key, signature);
  }
  const rooms = raw.rooms.map((item: unknown) => {
    if (!isRecord(item)) throw new Error('error.invalidRoom');
    const width = number(item.width),
      height = number(item.height);
    if (width < 140 || height < 120) throw new Error('error.roomTooSmall');
    return {
      id: uniqueId(item.id),
      name: text(item.name),
      color: color(item.color),
      x: number(item.x),
      y: number(item.y),
      width,
      height,
      ...(item.notes !== undefined ? { notes: text(item.notes, 4000) } : {}),
    };
  });
  const deviceIds = new Set(devices.map((item) => item.id));
  const links = raw.links.map((item: unknown) => {
    if (!isRecord(item)) throw new Error('error.invalidLink');
    const source = text(item.source),
      target = text(item.target),
      rawMedium = text(item.medium),
      speed = text(item.speed);
    const medium = (LegacyMediaNames[rawMedium] || rawMedium) as MapMedium;
    if (
      !deviceIds.has(source) ||
      !deviceIds.has(target) ||
      source === target ||
      !media.includes(medium) ||
      !speeds.includes(speed)
    )
      throw new Error('error.invalidLink');
    let waypoints: MapPoint[] | undefined;
    let labelPosition: MapPoint | undefined;
    if (item.labelPosition !== undefined) {
      if (!isRecord(item.labelPosition)) throw new Error('error.invalidLink');
      labelPosition = {
        x: number(item.labelPosition.x),
        y: number(item.labelPosition.y),
      };
    }
    if (item.waypoints !== undefined) {
      if (!Array.isArray(item.waypoints) || item.waypoints.length > 100)
        throw new Error('error.invalidWaypoints');
      waypoints = item.waypoints.map((point: unknown) => {
        if (!point || typeof point !== 'object' || !('x' in point) || !('y' in point))
          throw new Error('error.invalidWaypoints');
        return { x: number(point.x), y: number(point.y) };
      });
    }
    return {
      id: uniqueId(item.id),
      source,
      target,
      name: text(item.name),
      medium,
      speed,
      color: color(item.color),
      ...(waypoints ? { waypoints } : {}),
      ...(labelPosition ? { labelPosition } : {}),
      ...(item.planning !== undefined ? { planning: validatePlanning(item.planning) } : {}),
      ...(item.cableType !== undefined ? { cableType: text(item.cableType) } : {}),
    };
  });
  const roomIds = new Set(rooms.map((room) => room.id));
  let materials: MapMaterial[] | undefined;
  if (raw.materials !== undefined) {
    if (!Array.isArray(raw.materials) || raw.materials.length > 1000)
      throw new Error('error.invalidPlanning');
    materials = raw.materials.map((item: unknown) => {
      if (!isRecord(item) || (item.unit !== 'piece' && item.unit !== 'meter'))
        throw new Error('error.invalidPlanning');
      const roomId = item.roomId === undefined ? undefined : text(item.roomId);
      if (roomId && !roomIds.has(roomId)) throw new Error('error.invalidPlanning');
      return {
        id: uniqueId(item.id),
        name: text(item.name),
        unit: item.unit,
        ...(roomId ? { roomId } : {}),
        ...(item.planning !== undefined
          ? { planning: validatePlanning(item.planning, item.unit === 'meter') }
          : {}),
      };
    });
  }
  return {
    version: 1,
    name: text(raw.name),
    devices,
    rooms,
    links,
    ...(raw.customDeviceTypes !== undefined ? { customDeviceTypes } : {}),
    ...(materials ? { materials } : {}),
    ...(raw.notes !== undefined ? { notes: text(raw.notes, 4000) } : {}),
  };
}
