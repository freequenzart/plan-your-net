import type { ItemPlanning, MapDevice, MapDocument, MapLink, MapMaterial, MapRoom } from './types';
import { componentKey } from './components';

export type PlanningEntry =
  | {
      kind: 'device';
      item: MapDevice;
      room: MapRoom | undefined;
      costable: true;
      devices?: MapDevice[];
    }
  | { kind: 'link'; item: MapLink; room: MapRoom | undefined; costable: boolean }
  | { kind: 'material'; item: MapMaterial; room: MapRoom | undefined; costable: true };

export type PlanningGrouping = 'room' | 'deviceType';
export type PlanningFilter = 'all' | 'open' | 'shopping' | 'planned' | 'actual';
export type PlanningGroup =
  | { key: string; kind: 'room'; room: MapRoom | undefined; entries: PlanningEntry[] }
  | { key: string; kind: 'deviceType'; deviceType: string; entries: PlanningEntry[] }
  | { key: string; kind: 'medium'; medium: MapLink['medium']; entries: PlanningEntry[] }
  | { key: string; kind: 'material'; entries: PlanningEntry[] };

export function deviceRoom(document: MapDocument, device: MapDevice): MapRoom | undefined {
  return document.rooms
    .filter(
      (room) =>
        device.x >= room.x &&
        device.x <= room.x + room.width &&
        device.y >= room.y &&
        device.y <= room.y + room.height,
    )
    .sort(
      (left, right) =>
        left.width * left.height - right.width * right.height || left.id.localeCompare(right.id),
    )[0];
}

export function planningEntries(document: MapDocument): PlanningEntry[] {
  const rooms = new Map(
    document.devices.map((device) => [device.id, deviceRoom(document, device)]),
  );
  return [
    ...document.devices.map((item): PlanningEntry => ({
      kind: 'device',
      item,
      room: rooms.get(item.id),
      costable: true,
    })),
    ...document.links.map((item): PlanningEntry => ({
      kind: 'link',
      item,
      room: rooms.get(item.source) || rooms.get(item.target),
      costable: item.medium !== 'wireless',
    })),
    ...(document.materials || []).map((item): PlanningEntry => ({
      kind: 'material',
      item,
      room: document.rooms.find((room) => room.id === item.roomId),
      costable: true,
    })),
  ];
}

export function entryCostCents(entry: PlanningEntry): number {
  if (!entry.costable) return 0;
  const plan = entry.item.planning;
  const multiplier =
    entry.kind === 'link' && plan?.priceMode === 'perMeter' ? plan.lengthMeters || 0 : 1;
  const quantity = entry.kind === 'device' ? entry.devices?.length || 1 : (plan?.quantity ?? 1);
  if (entry.kind === 'device') return quantity * Math.round((plan?.unitPrice ?? 0) * 100);
  return Math.round(quantity * (plan?.unitPrice ?? 0) * multiplier * 100);
}

export function planningRows(
  entries: PlanningEntry[],
  grouping: PlanningGrouping = 'room',
): PlanningEntry[] {
  const rows: PlanningEntry[] = [];
  const groups = new Map<string, Extract<PlanningEntry, { kind: 'device' }>>();
  for (const entry of entries) {
    if (entry.kind !== 'device') {
      rows.push(entry);
      continue;
    }
    const key = JSON.stringify([
      grouping === 'room' ? entry.room?.id || '' : '',
      componentKey(entry.item),
    ]);
    const group = groups.get(key);
    if (group) group.devices!.push(entry.item);
    else {
      const row = { ...entry, devices: [entry.item] };
      groups.set(key, row);
      rows.push(row);
    }
  }
  return rows;
}

export function isActualState(item: { planning?: ItemPlanning }, costable: boolean): boolean {
  return !!item.planning?.installed && (!costable || !!item.planning?.purchased);
}

export function planningGroups(
  document: MapDocument,
  grouping: PlanningGrouping = 'room',
  filter: PlanningFilter = 'all',
): PlanningGroup[] {
  const entries = planningRows(
    planningEntries(document).filter(
      (entry) =>
        filter === 'all' ||
        (filter === 'actual'
          ? isActualState(entry.item, entry.costable)
          : filter === 'planned'
            ? !isActualState(entry.item, entry.costable)
            : filter === 'open'
              ? !entry.item.planning?.installed
              : entry.costable && !entry.item.planning?.purchased),
    ),
    grouping,
  );
  if (grouping === 'room') {
    const groups: PlanningGroup[] = document.rooms.map((room) => ({
      key: `room:${room.id}`,
      kind: 'room',
      room,
      entries: entries.filter((entry) => entry.room?.id === room.id),
    }));
    const unassigned = entries.filter((entry) => !entry.room);
    if (unassigned.length)
      groups.push({ key: 'room:unassigned', kind: 'room', room: undefined, entries: unassigned });
    return groups;
  }
  const groups = new Map<string, PlanningGroup>();
  for (const entry of entries) {
    const key =
      entry.kind === 'device'
        ? `deviceType:${entry.item.type}`
        : entry.kind === 'link'
          ? `medium:${entry.item.medium}`
          : 'material';
    const existing = groups.get(key);
    if (existing) existing.entries.push(entry);
    else
      groups.set(
        key,
        entry.kind === 'device'
          ? { key, kind: 'deviceType', deviceType: entry.item.type, entries: [entry] }
          : entry.kind === 'link'
            ? { key, kind: 'medium', medium: entry.item.medium, entries: [entry] }
            : { key, kind: 'material', entries: [entry] },
      );
  }
  return [...groups.values()];
}

export function entryPriced(entry: PlanningEntry): boolean {
  const plan = entry.item.planning;
  return (
    entry.costable &&
    plan?.unitPrice !== undefined &&
    (entry.kind !== 'link' || plan.priceMode !== 'perMeter' || plan.lengthMeters !== undefined)
  );
}

export function planningSummary(document: MapDocument) {
  return planningEntries(document).reduce(
    (summary, entry) => {
      const plan = entry.item.planning;
      const cost = entryCostCents(entry);
      summary.totalCents += cost;
      summary.remainingCents += plan?.purchased ? 0 : cost;
      summary.installed += plan?.installed ? 1 : 0;
      summary.purchased += plan?.purchased ? 1 : 0;
      summary.count++;
      if (entry.costable && !entryPriced(entry)) summary.unpriced++;
      if (entry.kind === 'link' && entry.costable)
        summary.cableMeters += (plan?.lengthMeters || 0) * (plan?.quantity ?? 1);
      return summary;
    },
    {
      totalCents: 0,
      remainingCents: 0,
      installed: 0,
      purchased: 0,
      count: 0,
      unpriced: 0,
      cableMeters: 0,
    },
  );
}

function record(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

export function validatePlanning(
  input: unknown,
  fractionalQuantity = false,
): ItemPlanning | undefined {
  if (input === undefined) return undefined;
  if (!record(input)) throw new Error('error.invalidPlanning');
  const output: ItemPlanning = {};
  for (const key of ['quantity', 'unitPrice', 'lengthMeters'] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < (key === 'quantity' ? (fractionalQuantity ? 0.1 : 1) : 0) ||
      value > 1000000 ||
      (key === 'quantity' && !fractionalQuantity && !Number.isInteger(value))
    )
      throw new Error('error.invalidPlanning');
    output[key] = value;
  }
  for (const key of ['purchased', 'installed'] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean') throw new Error('error.invalidPlanning');
    output[key] = input[key];
  }
  for (const key of ['manufacturer', 'model', 'notes'] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'string' || input[key].length > (key === 'notes' ? 4000 : 120))
      throw new Error('error.invalidPlanning');
    output[key] = input[key];
  }
  if (input.priceMode !== undefined) {
    if (input.priceMode !== 'perMeter' && input.priceMode !== 'perUnit')
      throw new Error('error.invalidPlanning');
    output.priceMode = input.priceMode;
  }
  return output;
}
