import { t } from '../i18n';
import type { MessageKey } from '../i18n/locales/en';
import { html } from '../ui/html';
import { icon } from '../ui/templates';

export const onboardingKey = 'netmap.onboarding.v1';
export const tourSteps = [
  { id: 'overview', selector: '.mode-switch' },
  { id: 'rooms', selector: '.editing-tools [data-action="room"]' },
  { id: 'devices', selector: 'device-palette [data-type="router"]' },
  {
    id: 'properties',
    selector: 'property-panel input[name="name"], property-panel .panel-heading',
  },
  {
    id: 'references',
    selector: '[data-tour="used-components"] .used-component, [data-tour="used-components"]',
  },
  { id: 'links', selector: '.editing-tools [data-action="connect"]' },
  { id: 'build', selector: '.assembly-item-cost, .assembly-header' },
  { id: 'files', selector: '.file-menu > summary' },
] as const;
export type TourStepId = (typeof tourSteps)[number]['id'];

export class AppTour extends HTMLElement {
  private dialog = document.createElement('dialog');
  private step = 0;
  private prepare: (step: TourStepId) => void = () => {};
  private finished: () => void = () => {};
  private initialized = false;
  private target: Element | null = null;
  private readonly handleResize = () => {
    if (this.dialog.open) this.showStep(this.step);
  };

  connectedCallback(): void {
    if (this.initialized) {
      window.addEventListener('resize', this.handleResize);
      return;
    }
    this.initialized = true;
    this.dialog.className = 'tour-dialog';
    this.dialog.setAttribute('aria-labelledby', 'tour-title');
    this.dialog.setAttribute('aria-describedby', 'tour-description');
    this.append(this.dialog);
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.finish();
    });
    this.dialog.addEventListener('click', (event) => {
      const action =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-tour-action]')?.dataset.tourAction
          : undefined;
      if (action === 'skip') this.finish();
      else if (action === 'back') this.showStep(this.step - 1);
      else if (action === 'next') {
        if (this.step === tourSteps.length - 1) this.finish();
        else this.showStep(this.step + 1);
      }
    });
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.finish();
        return;
      }
      if (event.key === 'ArrowRight' && this.step < tourSteps.length - 1) {
        event.preventDefault();
        this.showStep(this.step + 1);
      }
      if (event.key === 'ArrowLeft' && this.step > 0) {
        event.preventDefault();
        this.showStep(this.step - 1);
      }
    });
    window.addEventListener('resize', this.handleResize);
  }

  disconnectedCallback(): void {
    window.removeEventListener('resize', this.handleResize);
  }

  start(prepare: (step: TourStepId) => void, finished: () => void): void {
    this.prepare = prepare;
    this.finished = finished;
    if (!this.dialog.open) this.dialog.showModal();
    this.showStep(0);
  }

  private showStep(index: number): void {
    this.step = Math.max(0, Math.min(tourSteps.length - 1, index));
    const step = tourSteps[this.step];
    this.prepare(step.id);
    const candidates = step.selector
      .split(',')
      .flatMap((selector) => [...document.querySelectorAll(selector)]);
    this.target =
      candidates.find((element) => element.getBoundingClientRect().width > 0) ||
      document.querySelector('.mode-switch');
    this.target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.dialog.innerHTML = `<div class="tour-spotlight" aria-hidden="true"></div><section class="tour-popover"><div class="tour-progress"><span>${t('tourStep', { step: this.step + 1, total: tourSteps.length })}</span><button type="button" class="icon-button" data-tour-action="skip" title="${t('tourSkip')}" aria-label="${t('tourSkip')}">${icon('x', 17)}</button></div><h2 id="tour-title" tabindex="-1">${html(t(`tour.${step.id}.title` as MessageKey))}</h2><p id="tour-description">${html(t(`tour.${step.id}.body` as MessageKey))}</p><div class="tour-step-dots" aria-hidden="true">${tourSteps.map((_, number) => `<i class="${number === this.step ? 'active' : ''}"></i>`).join('')}</div><div class="tour-navigation"><button class="text-button" data-tour-action="skip">${t('tourSkip')}</button><div><button class="button secondary" data-tour-action="back" ${this.step === 0 ? 'disabled' : ''}>${t('tourBack')}</button><button class="button primary" data-tour-action="next">${t(this.step === tourSteps.length - 1 ? 'tourDone' : 'tourNext')}${icon('chevron-right', 15)}</button></div></div></section>`;
    this.dataset.step = step.id;
    this.position();
    this.dialog.querySelector<HTMLElement>('#tour-title')?.focus({ preventScroll: true });
  }

  private position(): void {
    const spotlight = this.dialog.querySelector<HTMLElement>('.tour-spotlight');
    const popover = this.dialog.querySelector<HTMLElement>('.tour-popover');
    if (!spotlight || !popover || !this.target) return;
    const bounds = this.target.getBoundingClientRect();
    const left = Math.max(8, bounds.left - 6),
      top = Math.max(8, bounds.top - 6);
    const right = Math.min(innerWidth - 8, bounds.right + 6),
      bottom = Math.min(innerHeight - 8, bounds.bottom + 6);
    Object.assign(spotlight.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(20, right - left)}px`,
      height: `${Math.max(20, bottom - top)}px`,
    });
    const width = Math.min(360, innerWidth - 24);
    popover.style.width = `${width}px`;
    const height = popover.getBoundingClientRect().height;
    let panelLeft = Math.max(12, Math.min(innerWidth - width - 12, left));
    let panelTop = bottom + 14;
    if (panelTop + height > innerHeight - 12) {
      if (left > width + 28) {
        panelLeft = left - width - 14;
        panelTop = top;
      } else if (right + width + 28 < innerWidth) {
        panelLeft = right + 14;
        panelTop = top;
      } else panelTop = top - height - 14;
    }
    panelTop = Math.max(12, Math.min(innerHeight - height - 12, panelTop));
    Object.assign(popover.style, {
      width: `${width}px`,
      left: `${panelLeft}px`,
      top: `${panelTop}px`,
    });
  }

  private finish(): void {
    if (!this.dialog.open) return;
    this.dialog.close();
    try {
      localStorage.setItem(onboardingKey, 'seen');
    } catch {}
    this.finished();
    document.querySelector<HTMLElement>('[data-action="tour"]')?.focus({ preventScroll: true });
  }
}
