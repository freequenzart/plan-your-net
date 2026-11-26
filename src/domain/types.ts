export interface MapPoint {
  x: number;
  y: number;
}
export interface MapRouteSegment {
  start: MapPoint;
  end: MapPoint;
  index: number;
}
export interface MapDevice extends MapPoint {
  id: string;
  componentId?: string;
  type: string;
  name: string;
  ip: string;
  color: string;
  planning?: ItemPlanning;
  specifications?: DeviceSpecifications;
  attributes?: CustomAttribute[];
}
export interface MapRoom extends MapPoint {
  id: string;
  name: string;
  color: string;
  width: number;
  height: number;
  notes?: string;
}
export type MapMedium = 'ethernet' | 'fiber' | 'wireless';
export interface MapLink {
  id: string;
  source: string;
  target: string;
  name: string;
  medium: MapMedium;
  speed: string;
  color: string;
  waypoints?: MapPoint[];
  labelPosition?: MapPoint;
  planning?: ItemPlanning;
  cableType?: string;
}
export interface MapDocument {
  version: 1;
  name: string;
  devices: MapDevice[];
  rooms: MapRoom[];
  links: MapLink[];
  customDeviceTypes?: CustomDeviceType[];
  materials?: MapMaterial[];
  notes?: string;
}
export interface CustomDeviceType {
  id: string;
  name: string;
  icon: string;
}
export interface ItemPlanning {
  quantity?: number;
  unitPrice?: number;
  priceMode?: 'perUnit' | 'perMeter';
  lengthMeters?: number;
  purchased?: boolean;
  installed?: boolean;
  manufacturer?: string;
  model?: string;
  notes?: string;
}
export interface MapMaterial {
  id: string;
  name: string;
  roomId?: string;
  unit: 'piece' | 'meter';
  planning?: ItemPlanning;
}
export interface CustomAttribute {
  name: string;
  value: string;
}
export interface DeviceSpecifications {
  ports?: number;
  uplinkPorts?: number;
  management?: 'managed' | 'unmanaged' | 'smart';
  poe?: boolean;
  maxSpeed?: string;
  wirelessStandard?: string;
  ssid?: string;
  cpu?: string;
  ramGb?: number;
  storageGb?: number;
  os?: string;
  resolution?: string;
  powerWatts?: number;
  connector?: string;
}
export type AppMode = 'edit' | 'view' | 'build';
export type MapSelection = { kind: 'device' | 'room' | 'link'; id: string } | null;
export type MapTool = 'select' | 'pan' | 'room' | 'connect';
export interface MapCamera extends MapPoint {
  zoom: number;
}
export interface EditorState {
  document: MapDocument;
  selection: MapSelection;
  tool: MapTool;
  editing: boolean;
  mode?: AppMode;
  camera: MapCamera;
  connecting: string | null;
  grid: boolean;
}
export type AppLanguage = 'de' | 'en';
export type AppTheme = 'light' | 'dark';
