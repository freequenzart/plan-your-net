import type { MapDocument, MapPoint, MapSelection, MapTool } from '../domain/types';
import type { PlanningKind, PlanningValue } from '../domain/planning-updates';

export type EditorEvent =
  | { action: 'camera' }
  | { action: 'hint'; message: string }
  | ({ action: 'select' } & (NonNullable<MapSelection> | { kind: null; id: null }))
  | { action: 'tool'; tool: MapTool }
  | { action: 'drag-commit'; before: MapDocument }
  | { action: 'add-device'; type: string; point?: MapPoint }
  | { action: 'add-custom-device-type'; name: string; icon: string }
  | { action: 'remove-custom-device-type'; id: string }
  | { action: 'import-custom-device-type'; name: string; icon: string }
  | { action: 'add-reference'; id: string; point?: MapPoint }
  | { action: 'inspect-device'; id: string }
  | { action: 'add-room'; x: number; y: number; width: number; height: number }
  | { action: 'connect'; id: string }
  | { action: 'property'; name: string; value: PlanningValue }
  | {
      action: 'plan-change';
      kind: PlanningKind;
      id: string;
      name: string;
      value: PlanningValue;
      deviceIds?: string[];
    }
  | { action: 'remove-material'; id: string }
  | { action: 'add-waypoint'; id: string; point: MapPoint; index: number }
  | { action: 'remove-waypoint'; index: number };

export function send(element: HTMLElement, detail: EditorEvent): void {
  element.dispatchEvent(new CustomEvent<EditorEvent>('map-action', { bubbles: true, detail }));
}

export function eventElement(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}
