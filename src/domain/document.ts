export const id = () =>
  globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const clone = (document: import('./types').MapDocument): import('./types').MapDocument =>
  structuredClone(document);

export function empty(): import('./types').MapDocument {
  return { version: 1, name: 'My network', devices: [], rooms: [], links: [] };
}
