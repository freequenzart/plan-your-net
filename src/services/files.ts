import * as NetworkModel from '../domain/model';
import { customDeviceIcons } from '../domain/catalog';
import type { CustomDeviceType, MapDocument } from '../domain/types';

export function serializeCustomDeviceType(type: CustomDeviceType): string {
  return JSON.stringify(
    { format: 'plan-your-net-device-type', version: 1, name: type.name, icon: type.icon },
    null,
    2,
  );
}

export function parseCustomDeviceType(contents: string): Omit<CustomDeviceType, 'id'> {
  const input: unknown = JSON.parse(contents);
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('error.invalidCustomDeviceType');
  const record = input as Record<string, unknown>;
  if (
    record.format !== 'plan-your-net-device-type' ||
    record.version !== 1 ||
    typeof record.name !== 'string' ||
    !record.name.trim() ||
    record.name.length > 80 ||
    typeof record.icon !== 'string' ||
    !customDeviceIcons.includes(record.icon as (typeof customDeviceIcons)[number])
  )
    throw new Error('error.invalidCustomDeviceType');
  return { name: record.name, icon: record.icon };
}

export type FilePermission = 'granted' | 'denied' | 'prompt';

export interface WritableFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(contents: string): Promise<void>; close(): Promise<void> }>;
  queryPermission(options: { mode: 'readwrite' }): Promise<FilePermission>;
  requestPermission(options: { mode: 'readwrite' }): Promise<FilePermission>;
}

export interface FilePickerApi {
  showOpenFilePicker?: (options: Record<string, unknown>) => Promise<WritableFileHandle[]>;
  showSaveFilePicker?: (options: Record<string, unknown>) => Promise<WritableFileHandle>;
}

export function csvCell(value: string | number): string {
  const text = String(value);
  const formulaLike = /^[=+\-@\t\r]/.test(text) || /^\s+[=+\-@]/.test(text);
  return `"${(formulaLike ? `'${text}` : text).replaceAll('"', '""')}"`;
}

export function downloadFile(name: string, contents: string, format: 'json' | 'svg' | 'csv'): void {
  const blob = new Blob([contents], {
    type:
      format === 'svg'
        ? 'image/svg+xml;charset=utf-8'
        : format === 'csv'
          ? 'text/csv;charset=utf-8'
          : 'application/json',
  });
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 80) || 'plan-your-net'}.${format}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseDocument(contents: string, svg: boolean): MapDocument {
  if (!svg) return NetworkModel.validate(JSON.parse(contents));
  if (/<!DOCTYPE|<!ENTITY/i.test(contents)) throw new Error('error.invalidSvg');
  const parsed = new DOMParser().parseFromString(contents, 'image/svg+xml');
  if (
    parsed.querySelector('parsererror') ||
    parsed.documentElement.localName !== 'svg' ||
    parsed.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg'
  )
    throw new Error('error.invalidSvg');
  const metadata = [...parsed.documentElement.children].find(
    (element) => element.localName === 'metadata' && element.id === 'netmap-document',
  );
  if (!metadata?.textContent) throw new Error('error.svgMetadata');
  return NetworkModel.validate(JSON.parse(metadata.textContent));
}
