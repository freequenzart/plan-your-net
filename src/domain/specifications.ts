import type { CustomAttribute, DeviceSpecifications } from './types';

export interface SpecificationField {
  key: keyof DeviceSpecifications;
  kind: 'text' | 'number' | 'checkbox' | 'select';
  types: readonly string[];
  options?: readonly string[];
}

export const specificationFields: readonly SpecificationField[] = [
  { key: 'ports', kind: 'number', types: ['switch', 'router', 'firewall'] },
  { key: 'uplinkPorts', kind: 'number', types: ['switch'] },
  {
    key: 'management',
    kind: 'select',
    types: ['switch'],
    options: ['managed', 'unmanaged', 'smart'],
  },
  { key: 'poe', kind: 'checkbox', types: ['switch', 'wifi', 'camera', 'iot'] },
  { key: 'maxSpeed', kind: 'text', types: ['switch', 'router', 'firewall', 'server', 'internet'] },
  { key: 'wirelessStandard', kind: 'text', types: ['wifi', 'router', 'phone', 'laptop'] },
  { key: 'ssid', kind: 'text', types: ['wifi', 'router'] },
  { key: 'cpu', kind: 'text', types: ['server', 'desktop', 'laptop'] },
  { key: 'ramGb', kind: 'number', types: ['server', 'desktop', 'laptop', 'phone'] },
  { key: 'storageGb', kind: 'number', types: ['server', 'desktop', 'laptop', 'phone'] },
  { key: 'os', kind: 'text', types: ['server', 'desktop', 'laptop', 'phone', 'iot'] },
  { key: 'resolution', kind: 'text', types: ['camera', 'monitor', 'printer'] },
  {
    key: 'powerWatts',
    kind: 'number',
    types: [
      'switch',
      'router',
      'firewall',
      'wifi',
      'server',
      'desktop',
      'laptop',
      'printer',
      'camera',
      'iot',
    ],
  },
  { key: 'connector', kind: 'text', types: ['internet', 'printer', 'camera', 'iot'] },
];

export function validateSpecifications(input: unknown): DeviceSpecifications | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('error.invalidPlanning');
  const source = input as Record<string, unknown>;
  const output: DeviceSpecifications = {};
  for (const field of specificationFields) {
    const value = source[field.key];
    if (value === undefined) continue;
    if (
      field.kind === 'number'
        ? typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1000000 ||
          ((field.key === 'ports' || field.key === 'uplinkPorts') && !Number.isInteger(value))
        : field.kind === 'checkbox'
          ? typeof value !== 'boolean'
          : typeof value !== 'string' ||
            value.length > 240 ||
            (field.options && !field.options.includes(value))
    )
      throw new Error('error.invalidPlanning');
    Object.assign(output, { [field.key]: value });
  }
  return output;
}

export function validateAttributes(input: unknown): CustomAttribute[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > 30) throw new Error('error.invalidPlanning');
  return input.map((item: unknown) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('name' in item) ||
      !('value' in item) ||
      typeof item.name !== 'string' ||
      typeof item.value !== 'string' ||
      item.name.length > 80 ||
      item.value.length > 240
    )
      throw new Error('error.invalidPlanning');
    return { name: item.name, value: item.value };
  });
}
