import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bounds, clone, demo, empty, validate } from '../src/domain/model';
import { GermanMessages } from '../src/i18n/locales/de';
import { EnglishMessages } from '../src/i18n/locales/en';
import {
  loadDocument,
  loadPreferences,
  saveDocument,
  savePreferences,
} from '../src/services/storage';

test('example and empty documents validate without data loss', () => {
  assert.deepEqual(validate(demo()), demo());
  assert.deepEqual(validate(empty()), empty());
});

test('custom device types and devices survive document validation', () => {
  const model = demo();
  model.customDeviceTypes = [{ id: 'custom-tv', name: 'Smart TV', icon: 'tv' }];
  model.devices.push({
    id: 'custom-tv-1',
    type: 'custom-tv',
    name: 'Living room TV',
    ip: '',
    color: '#167d67',
    x: 700,
    y: 440,
  });
  assert.deepEqual(validate(model), model);
  model.customDeviceTypes[0].icon = 'script';
  assert.throws(() => validate(model), /error.invalidDeviceType/);
});

test('legacy localized media are normalized without changing names or control points', () => {
  const legacy: unknown = {
    ...demo(),
    links: demo().links.map((link) => ({
      ...link,
      medium: 'Glasfaser',
      waypoints: [{ x: 320, y: 550 }],
    })),
  };
  const migrated = validate(legacy);
  assert(migrated.links.every((link) => link.medium === 'fiber'));
  assert.deepEqual(migrated.links[0].waypoints, [{ x: 320, y: 550 }]);
  assert.equal(migrated.name, demo().name);
});

test('validation rejects invalid endpoints and nonfinite control points', () => {
  const model = demo();
  model.links[0].target = 'missing';
  assert.throws(() => validate(model), /error.invalidLink/);
  model.links[0].target = model.devices[0].id;
  model.links[0].waypoints = [{ x: Infinity, y: 0 }];
  assert.throws(() => validate(model));
});

test('cloning history snapshots isolates nested control points', () => {
  const model = demo();
  model.links[0].waypoints = [{ x: 320, y: 550 }];
  const snapshot = clone(model);
  snapshot.links[0].waypoints![0].x = 100;
  assert.equal(model.links[0].waypoints[0].x, 320);
});

test('link label positions validate, persist, and contribute to document bounds', () => {
  const model = demo();
  model.links[0].name = 'A long manual connection label at the edge';
  model.links[0].labelPosition = { x: 1200, y: 1800 };
  assert.deepEqual(validate(model), model);
  const labelWidth = Math.max(70, model.links[0].name.length * 6.4);
  const documentBounds = bounds(model);
  assert(documentBounds.x + documentBounds.width + 0.001 >= 1200 + labelWidth / 2 + 40);
  model.links[0].labelPosition = { x: Infinity, y: 0 };
  assert.throws(() => validate(model));
});

test('storage preserves existing keys and keeps preferences separate', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  assert.equal(loadDocument(storage), null);
  saveDocument(demo(), storage);
  savePreferences({ language: 'de', theme: 'dark' }, storage);
  assert.deepEqual(loadDocument(storage), demo());
  assert.deepEqual(loadPreferences(storage), { language: 'de', theme: 'dark' });
  assert(data.has('netmap.document.v1'));
  assert(data.has('netmap.preferences.v1'));
});

test('German and English language packs have matching keys', () => {
  assert.deepEqual(Object.keys(GermanMessages).sort(), Object.keys(EnglishMessages).sort());
});
