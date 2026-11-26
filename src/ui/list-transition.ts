interface ListPosition {
  key: string;
  element: HTMLElement;
  bounds: DOMRect;
  rowKey?: string;
  header: boolean;
}

export class ListTransition {
  private animations = new Set<Animation>();
  private ghosts = new Set<HTMLElement>();

  constructor(private readonly container: HTMLElement) {
    container.addEventListener('wheel', () => this.cancel(), { passive: true });
    container.addEventListener('touchmove', () => this.cancel(), { passive: true });
    container.addEventListener('pointerdown', () => this.cancel(), { passive: true });
  }

  capture(): () => void {
    this.cancel();
    if (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !this.container.getClientRects().length
    )
      return () => {};
    const positions = this.positions();
    const viewport = this.container.getBoundingClientRect();
    return () => {
      if (!this.container.isConnected || !this.container.getClientRects().length) return;
      const current = new Map(this.positions().map((position) => [position.key, position]));
      const rowOffsets = new Map(
        positions
          .filter((position) => position.key.startsWith('row:'))
          .map((position) => [
            position.key,
            position.bounds.top - (current.get(position.key)?.bounds.top ?? position.bounds.top),
          ]),
      );
      for (const previous of positions) {
        if (
          previous.bounds.bottom <= viewport.top ||
          previous.bounds.top >= viewport.bottom ||
          !previous.bounds.width ||
          !previous.bounds.height
        )
          continue;
        const next = current.get(previous.key);
        if (next) {
          const offset =
            previous.bounds.top -
            next.bounds.top -
            (previous.rowKey ? rowOffsets.get(previous.rowKey) || 0 : 0);
          if (Math.abs(offset) > 0.5)
            this.track(
              next.element.animate(
                [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
                { duration: 280, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
              ),
            );
        } else if (!previous.header && (!previous.rowKey || current.has(previous.rowKey))) {
          this.fadeOut(previous, viewport);
        }
      }
    };
  }

  cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    for (const ghost of this.ghosts) ghost.remove();
    this.ghosts.clear();
  }

  private positions(): ListPosition[] {
    return [
      ...this.container.querySelectorAll<HTMLElement>(
        '.assembly-groups .assembly-item, .assembly-groups .assembly-instance, .assembly-groups .assembly-room > header',
      ),
    ].map((element) => {
      if (element.classList.contains('assembly-item'))
        return {
          key: `row:${element.dataset.openKey}`,
          element,
          bounds: element.getBoundingClientRect(),
          header: false,
        };
      if (element.classList.contains('assembly-instance')) {
        const row = element.closest<HTMLElement>('.assembly-item');
        const rowKey = `row:${row?.dataset.openKey}`;
        return {
          key: `${rowKey}:instance:${element.dataset.entryId}`,
          rowKey,
          element,
          bounds: element.getBoundingClientRect(),
          header: false,
        };
      }
      return {
        key: `header:${element.parentElement?.dataset.planGroup}`,
        element,
        bounds: element.getBoundingClientRect(),
        header: true,
      };
    });
  }

  private fadeOut(position: ListPosition, viewport: DOMRect): void {
    const ghost = position.element.cloneNode(true) as HTMLElement;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.dataset.exitAnimation = 'true';
    for (const node of [ghost, ...ghost.querySelectorAll<HTMLElement>('*')]) {
      for (const attribute of [
        'id',
        'data-entry-kind',
        'data-entry-id',
        'data-open-key',
        'data-plan-group',
      ])
        node.removeAttribute(attribute);
      if (
        node instanceof HTMLInputElement ||
        node instanceof HTMLSelectElement ||
        node instanceof HTMLTextAreaElement ||
        node instanceof HTMLButtonElement
      )
        node.disabled = true;
    }
    const bounds = position.bounds;
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      margin: '0',
      pointerEvents: 'none',
      zIndex: '6',
      overflow: 'hidden',
      background: 'var(--surface)',
      clipPath: `inset(${Math.max(0, viewport.top - bounds.top)}px ${Math.max(0, bounds.right - viewport.right)}px ${Math.max(0, bounds.bottom - viewport.bottom)}px ${Math.max(0, viewport.left - bounds.left)}px)`,
    });
    this.container.append(ghost);
    this.ghosts.add(ghost);
    const animation = ghost.animate(
      [
        { opacity: 1, transform: 'translateX(0)', offset: 0 },
        { opacity: 1, transform: 'translateX(0)', offset: 0.15 },
        { opacity: 0, transform: 'translateX(16px)', offset: 1 },
      ],
      { duration: 280, easing: 'ease-out' },
    );
    this.track(animation, () => {
      ghost.remove();
      this.ghosts.delete(ghost);
    });
  }

  private track(animation: Animation, finished: () => void = () => {}): void {
    this.animations.add(animation);
    void animation.finished
      .catch(() => {})
      .then(() => {
        this.animations.delete(animation);
        finished();
      });
  }
}
