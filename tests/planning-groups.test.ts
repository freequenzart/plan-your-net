import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDeviceReference } from '../src/domain/components';
import { demo } from '../src/domain/model';
import {
  entryCostCents,
  planningGroups,
  type PlanningFilter,
  type PlanningGroup,
} from '../src/domain/planning';

function itemIds(groups: PlanningGroup[]): string[] {
  return groups
    .flatMap((group) =>
      group.entries.flatMap((entry) =>
        entry.kind === 'device'
          ? (entry.devices || [entry.item]).map((device) => device.id)
          : [entry.item.id],
      ),
    )
    .sort();
}

test('room and device-type grouping preserve the same filtered physical items', () => {
  const document = demo();
  const source = document.devices.find((device) => device.type === 'switch')!;
  source.planning = { unitPrice: 79.9, purchased: true, installed: true };
  const reference = addDeviceReference(document, source, { x: 700, y: 300 });
  document.links[0].planning = { unitPrice: 4, installed: true };
  document.materials = [
    {
      id: 'm1',
      name: 'Connectors',
      unit: 'piece',
      roomId: document.rooms[0].id,
      planning: { quantity: 3, unitPrice: 1 },
    },
  ];
  const original = JSON.stringify(document);
  for (const filter of ['all', 'open', 'shopping'] satisfies PlanningFilter[]) {
    const rooms = planningGroups(document, 'room', filter);
    const types = planningGroups(document, 'deviceType', filter);
    assert.deepEqual(itemIds(types), itemIds(rooms));
    assert.equal(new Set(itemIds(types)).size, itemIds(types).length);
    assert.equal(
      types
        .flatMap((group) => group.entries)
        .reduce((sum, entry) => sum + entryCostCents(entry), 0),
      rooms
        .flatMap((group) => group.entries)
        .reduce((sum, entry) => sum + entryCostCents(entry), 0),
    );
    const switches = types.find(
      (group) => group.kind === 'deviceType' && group.deviceType === 'switch',
    )!;
    const row = switches.entries.find((entry) => entry.kind === 'device')!;
    assert.equal(row.kind === 'device' ? row.devices?.length : 0, filter === 'all' ? 2 : 1);
    assert(itemIds(types).includes(reference.id));
    assert.equal(itemIds(types).includes(source.id), filter === 'all');
  }
  assert.equal(JSON.stringify(document), original);
});

test('type grouping separates device types, media and additional materials', () => {
  const document = demo();
  document.materials = [{ id: 'm1', name: 'Patch panel', unit: 'piece' }];
  const groups = planningGroups(document, 'deviceType');
  for (const group of groups) {
    if (group.kind === 'deviceType')
      assert(
        group.entries.every(
          (entry) => entry.kind === 'device' && entry.item.type === group.deviceType,
        ),
      );
    if (group.kind === 'medium')
      assert(
        group.entries.every((entry) => entry.kind === 'link' && entry.item.medium === group.medium),
      );
    if (group.kind === 'material')
      assert(group.entries.every((entry) => entry.kind === 'material'));
  }
  const shopping = planningGroups(document, 'deviceType', 'shopping');
  assert(!shopping.some((group) => group.kind === 'medium' && group.medium === 'wireless'));
});

test('planned and current state filters use acquired and installed together', () => {
  const document = demo();
  document.devices[0].planning = { purchased: true, installed: true };
  document.devices[1].planning = { purchased: false, installed: true };
  document.devices[2].planning = { purchased: true, installed: false };
  document.links[0].planning = { purchased: true, installed: true };
  document.links[1].medium = 'wireless';
  document.links[1].planning = { installed: true };

  const actual = itemIds(planningGroups(document, 'room', 'actual'));
  const planned = itemIds(planningGroups(document, 'room', 'planned'));
  assert(actual.includes(document.devices[0].id));
  assert(actual.includes(document.links[0].id));
  assert(!actual.includes(document.devices[1].id));
  assert(!actual.includes(document.devices[2].id));
  assert(actual.includes(document.links[1].id));
  assert.deepEqual(
    [...actual, ...planned].sort(),
    itemIds(planningGroups(document, 'room', 'all')),
  );
  assert.equal(
    actual.some((id) => planned.includes(id)),
    false,
  );
});
