export type EditableField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type FieldValue = string | number | boolean | undefined;
export function retainFieldFocus(owner: HTMLElement): () => void {
  const active = document.activeElement;
  if (
    !(
      active instanceof HTMLInputElement ||
      active instanceof HTMLSelectElement ||
      active instanceof HTMLTextAreaElement
    ) ||
    !owner.contains(active)
  )
    return () => {};
  const name = active.name;
  const entry = active.closest<HTMLElement>('[data-entry-kind]');
  const kind = entry?.dataset.entryKind;
  const id = entry?.dataset.entryId;
  const openKey = entry?.dataset.openKey;
  return () => {
    const roots = kind
      ? [
          ...owner.querySelectorAll(
            `[data-entry-kind="${CSS.escape(kind)}"][data-entry-id="${CSS.escape(id || '')}"]${openKey ? `[data-open-key="${CSS.escape(openKey)}"]` : ''}`,
          ),
        ]
      : [owner];
    const replacement = roots
      .map((root) =>
        root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          `[name="${CSS.escape(name)}"]`,
        ),
      )
      .find((field) => field && field.getClientRects().length);
    if (replacement && replacement.getClientRects().length)
      replacement.focus({ preventScroll: true });
  };
}

export class FieldCommitter {
  private values = new WeakMap<EditableField, string>();
  commit(
    owner: HTMLElement,
    target: EventTarget | null,
    apply: (field: EditableField, value: FieldValue) => void,
  ): void {
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) ||
      !owner.contains(target) ||
      target.matches(':disabled')
    )
      return;
    const checkbox = target instanceof HTMLInputElement && target.type === 'checkbox';
    const current = checkbox ? String(target.checked) : target.value;
    const initial =
      this.values.get(target) ??
      (checkbox
        ? String(target.defaultChecked)
        : target instanceof HTMLSelectElement
          ? ([...target.options].find((option) => option.defaultSelected)?.value ??
            target.options[0]?.value)
          : target.defaultValue);
    if (current === initial) return;
    if (!target.checkValidity()) {
      target.reportValidity();
      return;
    }
    this.values.set(target, current);
    apply(
      target,
      checkbox
        ? target.checked
        : target instanceof HTMLInputElement && target.type === 'number'
          ? target.value === ''
            ? undefined
            : Number(target.value)
          : target.value,
    );
  }
}
