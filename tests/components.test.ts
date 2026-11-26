import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDeviceReference,
  componentKey,
  componentMembers,
  detachComponent,
} from '../src/domain/components';
import { demo, validate } from '../src/domain/model';
import {
  entryCostCents,
  planningEntries,
  planningRows,
  planningSummary,
} from '../src/domain/planning';
import { updatePlanning } from '../src/domain/planning-updates';

test('references count physical devices, clear per-instance status and survive JSON', () => {
  const document = demo();
  const source = document.devices.find((device) => device.id === 'switch')!;
  source.planning = { quantity: 20, unitPrice: 100, purchased: true, installed: true };
  const copy = addDeviceReference(document, source, { x: source.x + 20, y: source.y + 20 });
  assert.equal(componentKey(copy), componentKey(source));
  assert.equal(copy.ip, '');
  assert.equal(copy.planning?.purchased, undefined);
  assert.equal(copy.planning?.quantity, undefined);
  assert.equal(componentMembers(document, componentKey(source)).length, 2);
  assert.equal(planningSummary(document).totalCents, 20000);
  assert.deepEqual(validate(document), document);
  const row = planningRows(planningEntries(document)).find(
    (entry) => entry.kind === 'device' && entry.item.id === source.id,
  )!;
  assert.equal(entryCostCents(row), 20000);
});

test('editing individual shared properties detaches just that device', () => {
  const document = demo();
  const source = document.devices.find((device) => device.id === 'switch')!;
  source.specifications = { ports: 24 };
  const copy = addDeviceReference(document, source, { x: 700, y: 300 });
  const updated = updatePlanning(document, 'device', copy.id, 'specifications.ports', 8);
  assert.notEqual(
    componentKey(updated.devices.find((device) => device.id === copy.id)!),
    componentKey(updated.devices.find((device) => device.id === source.id)!),
  );
  assert.equal(
    updated.devices.find((device) => device.id === source.id)?.specifications?.ports,
    24,
  );
  assert.equal(updated.devices.find((device) => device.id === copy.id)?.specifications?.ports, 8);
});

test('shared component prices update all references, room statuses update only selected members', () => {
  const document = demo();
  const source = document.devices.find((device) => device.id === 'switch')!;
  const copy = addDeviceReference(document, source, { x: 700, y: 300 });
  let updated = updatePlanning(
    document,
    'component',
    componentKey(source),
    'planning.unitPrice',
    79.9,
  );
  assert.equal(planningSummary(updated).totalCents, 15980);
  updated = updatePlanning(updated, 'component', componentKey(source), 'planning.purchased', true, [
    copy.id,
  ]);
  assert.equal(
    updated.devices.find((device) => device.id === source.id)?.planning?.purchased,
    undefined,
  );
  assert.equal(updated.devices.find((device) => device.id === copy.id)?.planning?.purchased, true);
  assert.equal(componentMembers(updated, componentKey(source)).length, 2);
  addDeviceReference(
    updated,
    updated.devices.find((device) => device.id === source.id)!,
    { x: 500, y: 300 },
  );
  updated = updatePlanning(updated, 'component', componentKey(source), 'planning.unitPrice', 100);
  assert.equal(planningSummary(updated).totalCents, 30000);
  assert.equal(componentMembers(updated, componentKey(source)).length, 3);
  const unchanged = updatePlanning(updated, 'device', copy.id, 'planning.unitPrice', 100);
  assert.equal(componentMembers(unchanged, componentKey(source)).length, 3);
  assert.throws(() => updatePlanning(unchanged, 'device', copy.id, 'planning.quantity', 9));
});

test('deleting the source preserves usable references and explicit detachment is isolated', () => {
  const document = demo();
  const source = document.devices.find((device) => device.id === 'switch')!;
  const first = addDeviceReference(document, source, { x: 400, y: 300 });
  const second = addDeviceReference(document, source, { x: 700, y: 300 });
  document.devices = document.devices.filter((device) => device.id !== source.id);
  document.links = document.links.filter(
    (link) => link.source !== source.id && link.target !== source.id,
  );
  assert.equal(componentMembers(document, componentKey(first)).length, 2);
  detachComponent(document, second);
  assert.equal(componentMembers(document, componentKey(first)).length, 1);
  assert.deepEqual(validate(document), document);
});

test('grouped device prices and physical totals use the same cent rounding', () => {
  const document = demo();
  const source = document.devices.find((device) => device.id === 'switch')!;
  source.planning = { unitPrice: 0.335 };
  addDeviceReference(document, source, { x: source.x + 10, y: source.y + 10 });
  addDeviceReference(document, source, { x: source.x + 20, y: source.y + 20 });
  const row = planningRows(planningEntries(document)).find(
    (entry) => entry.kind === 'device' && entry.item.id === source.id,
  )!;
  assert.equal(entryCostCents(row), 102);
  assert.equal(planningSummary(document).totalCents, 102);
});
