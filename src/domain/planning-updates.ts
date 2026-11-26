import { clone } from './document';
import { specificationFields } from './specifications';
import type { MapDocument } from './types';
import { validate } from './validation';
import { componentKey, componentMembers, detachComponent } from './components';

export type PlanningKind = 'device' | 'component' | 'link' | 'material' | 'room' | 'document';
export type PlanningValue = string | number | boolean | undefined;

export function updatePlanning(
  document: MapDocument,
  kind: PlanningKind,
  id: string,
  path: string,
  value: PlanningValue,
  deviceIds?: string[],
): MapDocument {
  if (kind === 'component') {
    const members = componentMembers(document, id);
    if (!members.length) throw new Error('error.invalidReference');
    let result = clone(document);
    const status = path === 'planning.purchased' || path === 'planning.installed';
    const targets = members.filter(
      (device) => !status || !deviceIds || deviceIds.includes(device.id),
    );
    for (const member of targets) {
      result = updatePlanning(result, 'device', member.id, path, value);
    }
    for (const member of targets)
      result.devices.find((device) => device.id === member.id)!.componentId = componentKey(member);
    return validate(result);
  }
  const result = clone(document);
  const item =
    kind === 'document'
      ? result
      : kind === 'room'
        ? result.rooms.find((entry) => entry.id === id)
        : kind === 'device'
          ? result.devices.find((entry) => entry.id === id)
          : kind === 'link'
            ? result.links.find((entry) => entry.id === id)
            : result.materials?.find((entry) => entry.id === id);
  if (!item) throw new Error('error.invalidPlanning');
  if (kind === 'device' && path === 'planning.quantity') throw new Error('error.invalidPlanning');
  if (
    kind === 'device' &&
    'type' in item &&
    (path.startsWith('specifications.') ||
      path.startsWith('attributes.') ||
      ['planning.manufacturer', 'planning.model', 'planning.unitPrice'].includes(path))
  ) {
    const [section, key, field] = path.split('.');
    const previous =
      section === 'specifications'
        ? Reflect.get(item.specifications || {}, key)
        : section === 'planning'
          ? Reflect.get(item.planning || {}, key)
          : /^\d+$/.test(key) && field
            ? Reflect.get(item.attributes?.[Number(key)] || {}, field)
            : Symbol();
    if (Object.is(previous, value)) return validate(result);
    detachComponent(result, item);
  }
  if (path === 'notes' && (kind === 'room' || kind === 'document'))
    Object.assign(item, { notes: value });
  else if (path.startsWith('planning.') && kind !== 'document' && kind !== 'room') {
    const key = path.slice('planning.'.length);
    if (
      ![
        'quantity',
        'unitPrice',
        'priceMode',
        'lengthMeters',
        'purchased',
        'installed',
        'manufacturer',
        'model',
        'notes',
      ].includes(key)
    )
      throw new Error('error.invalidPlanning');
    const planning = 'planning' in item && item.planning ? { ...item.planning } : {};
    Object.assign(planning, { [key]: value });
    Object.assign(item, { planning });
  } else if (kind === 'device' && 'type' in item && path.startsWith('specifications.')) {
    const key = path.slice('specifications.'.length);
    if (!specificationFields.some((field) => field.key === key && field.types.includes(item.type)))
      throw new Error('error.invalidPlanning');
    item.specifications = { ...item.specifications, [key]: value === '' ? undefined : value };
  } else if (kind === 'device' && 'type' in item && path.startsWith('attributes.')) {
    const attributes = (item.attributes ||= []);
    const parts = path.split('.');
    if (parts[1] === 'add' && attributes.length < 30) attributes.push({ name: '', value: '' });
    else if (
      parts[1] === 'remove' &&
      Number.isInteger(Number(parts[2])) &&
      attributes[Number(parts[2])]
    )
      attributes.splice(Number(parts[2]), 1);
    else if (
      /^\d+$/.test(parts[1]) &&
      attributes[Number(parts[1])] &&
      (parts[2] === 'name' || parts[2] === 'value') &&
      typeof value === 'string'
    )
      Object.assign(attributes[Number(parts[1])], { [parts[2]]: value });
    else throw new Error('error.invalidPlanning');
  } else if (path === 'cableType' && kind === 'link') Object.assign(item, { cableType: value });
  else if (kind === 'material' && ['name', 'roomId', 'unit'].includes(path))
    Object.assign(item, { [path]: path === 'roomId' && value === '' ? undefined : value });
  else throw new Error('error.invalidPlanning');
  return validate(result);
}
