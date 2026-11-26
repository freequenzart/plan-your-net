import type { MapDocument, MapPoint, MapSelection } from '../domain/types';
export interface CanvasDrag {
  mode: string;
  start: MapPoint;
  last: MapPoint;
  selection: MapSelection;
  before: MapDocument;
  moved: boolean;
  origin: MapPoint;
  width: number;
  height: number;
  members: string[];
  waypointIndex: number;
  routeIndex: number;
  wasSelected: boolean;
}
