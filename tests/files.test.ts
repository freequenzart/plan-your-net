import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, parseCustomDeviceType, serializeCustomDeviceType } from '../src/services/files';

test('CSV cells quote values and neutralize spreadsheet formulas', () => {
  assert.equal(csvCell('=1+1'), `"'=1+1"`);
  assert.equal(csvCell(' +1'), `"' +1"`);
  assert.equal(csvCell('\t@SUM(A1:A2)'), `"'\t@SUM(A1:A2)"`);
  assert.equal(csvCell('Router "office"'), `"Router ""office"""`);
  assert.equal(csvCell(42), '"42"');
});

test('custom device types export and import individually without trusting arbitrary icons', () => {
  const exported = serializeCustomDeviceType({ id: 'custom-tv', name: 'Smart TV', icon: 'tv' });
  assert.deepEqual(parseCustomDeviceType(exported), { name: 'Smart TV', icon: 'tv' });
  assert.throws(
    () =>
      parseCustomDeviceType(
        JSON.stringify({
          format: 'plan-your-net-device-type',
          version: 1,
          name: 'Unknown',
          icon: 'external-script',
        }),
      ),
    /error.invalidCustomDeviceType/,
  );
});
