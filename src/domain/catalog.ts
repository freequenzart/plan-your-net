import type { CustomDeviceType } from './types';

export const colors = ['#167d67', '#3972cf', '#885fc1', '#dc8c25', '#d75769', '#697987'];
export const customDeviceIcons = [
  'camera',
  'cctv',
  'cloud',
  'cpu',
  'laptop',
  'monitor',
  'printer',
  'router',
  'server',
  'smartphone',
  'tv',
  'wifi',
] as const;

export const types = [
  { id: 'router', icon: 'router', group: 'network' },
  { id: 'switch', icon: 'network', group: 'network' },
  { id: 'wifi', icon: 'wifi', group: 'network' },
  { id: 'firewall', icon: 'shield-check', group: 'network' },
  { id: 'internet', icon: 'cloud', group: 'network' },
  { id: 'server', icon: 'server', group: 'endpoints' },
  { id: 'desktop', icon: 'monitor', group: 'endpoints' },
  { id: 'tv', icon: 'tv', group: 'endpoints' },
  { id: 'laptop', icon: 'laptop', group: 'endpoints' },
  { id: 'phone', icon: 'smartphone', group: 'endpoints' },
  { id: 'printer', icon: 'printer', group: 'endpoints' },
  { id: 'camera', icon: 'cctv', group: 'endpoints' },
  { id: 'iot', icon: 'cpu', group: 'endpoints' },
];

export function deviceIcon(typeId: string, customTypes: readonly CustomDeviceType[] = []): string {
  return (
    customTypes.find((type) => type.id === typeId)?.icon ||
    types.find((type) => type.id === typeId)?.icon ||
    'monitor'
  );
}

export const speeds = [
  '10 Mbit/s',
  '100 Mbit/s',
  '1 Gbit/s',
  '2.5 Gbit/s',
  '10 Gbit/s',
  '25 Gbit/s',
  '40 Gbit/s',
  '100 Gbit/s',
  '400 Gbit/s',
  '1000 Gbit/s',
];

export const media: import('./types').MapMedium[] = ['ethernet', 'fiber', 'wireless'];
