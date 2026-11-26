const entities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function html(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}
