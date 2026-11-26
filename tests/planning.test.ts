import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demo, validate } from '../src/domain/model';
import { deviceRoom, planningEntries, planningSummary } from '../src/domain/planning';
import { updatePlanning } from '../src/domain/planning-updates';

test('planning data and device specifications survive import without changing legacy documents', () => {
  assert.deepEqual(validate(demo()), demo());
  const model = demo();
  model.devices[0].planning = {
    unitPrice: 125.5,
    quantity: 2,
    purchased: true,
    notes: 'Keep invoice',
  };
  model.devices[1].specifications = { ports: 24, management: 'managed', poe: true };
  model.devices[1].attributes = [{ name: 'Rack', value: 'A-02' }];
  model.rooms[0].notes = 'Key required';
  model.links[0].planning = { lengthMeters: 10, priceMode: 'perMeter', unitPrice: 1.25 };
  model.materials = [
    { id: 'm1', name: 'Patch panel', roomId: 'r1', unit: 'piece', planning: { unitPrice: 25 } },
  ];
  model.notes = 'Installation on Friday';
  assert.deepEqual(validate(model), model);
});

test('room assignment uses the smallest containing room and counts cross-room links once', () => {
  const model = demo();
  const device = model.devices.find((item) => item.id === 'switch')!;
  model.rooms.push({
    id: 'nested',
    name: 'Rack',
    color: '#167d67',
    x: device.x - 20,
    y: device.y - 20,
    width: 140,
    height: 120,
  });
  assert.equal(deviceRoom(model, device)?.id, 'nested');
  const entries = planningEntries(model);
  assert.equal(entries.filter((entry) => entry.kind === 'link').length, model.links.length);
  assert.equal(entries.find((entry) => entry.item.id === 'l3')?.room?.id, 'nested');
});

test('costs count physical devices once and use explicit cable lengths and material quantities', () => {
  const model = demo();
  model.devices[0].planning = { unitPrice: 19.99, quantity: 2, purchased: true, installed: true };
  model.links[0].planning = {
    unitPrice: 1.25,
    lengthMeters: 12.5,
    priceMode: 'perMeter',
    quantity: 2,
  };
  model.links[5].planning = { unitPrice: 1000, lengthMeters: 999, priceMode: 'perMeter' };
  model.materials = [
    { id: 'm1', name: 'Connectors', unit: 'piece', planning: { unitPrice: 0.1, quantity: 3 } },
  ];
  const summary = planningSummary(model);
  assert.equal(summary.totalCents, 1999 + 3125 + 30);
  assert.equal(summary.remainingCents, 3125 + 30);
  assert.equal(summary.cableMeters, 25);
  assert.equal(summary.installed, 1);
});

test('negative, nonfinite and malformed planning data are rejected', () => {
  for (const planning of [
    { unitPrice: -1 },
    { lengthMeters: Infinity },
    { quantity: 1.5 },
    { purchased: 'yes' },
  ]) {
    const model = demo();
    Object.assign(model.devices[0], { planning });
    assert.throws(() => validate(model), /error.invalidPlanning/);
  }
  const model = demo();
  model.devices[0].specifications = { ports: 2.5 };
  assert.throws(() => validate(model), /error.invalidPlanning/);
});

test('individual updates are validated, isolated, and retain custom attributes', () => {
  const original = demo();
  let updated = updatePlanning(original, 'device', 'switch', 'specifications.ports', 24);
  updated = updatePlanning(updated, 'device', 'switch', 'specifications.management', 'managed');
  updated = updatePlanning(updated, 'device', 'switch', 'attributes.add', undefined);
  updated = updatePlanning(updated, 'device', 'switch', 'attributes.0.name', 'Rack');
  updated = updatePlanning(updated, 'device', 'switch', 'attributes.0.value', 'A-02');
  assert.equal(original.devices.find((item) => item.id === 'switch')?.specifications, undefined);
  assert.equal(updated.devices.find((item) => item.id === 'switch')?.specifications?.ports, 24);
  assert.deepEqual(updated.devices.find((item) => item.id === 'switch')?.attributes, [
    { name: 'Rack', value: 'A-02' },
  ]);
  assert.throws(() => updatePlanning(updated, 'device', 'switch', 'specifications.ramGb', 32));
  assert.throws(() => updatePlanning(updated, 'device', 'switch', 'planning.__proto__', 'x'));
});

test('meter materials support fractional quantities and incomplete cable prices remain visible', () => {
  const model = demo();
  model.materials = [
    { id: 'm1', name: 'Cable duct', unit: 'meter', planning: { quantity: 2.5, unitPrice: 3 } },
  ];
  model.links[0].planning = { unitPrice: 2, priceMode: 'perMeter' };
  assert.deepEqual(validate(model), model);
  assert.equal(planningSummary(model).totalCents, 750);
  assert.equal(
    planningSummary(model).unpriced,
    planningEntries(model).filter((entry) => entry.costable).length - 1,
  );
});
