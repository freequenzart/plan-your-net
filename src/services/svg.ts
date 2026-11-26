import * as NetworkModel from '../domain/model';
import type { MapDocument } from '../domain/types';
export function createSvg(
  canvas: SVGSVGElement,
  model: MapDocument,
  render: (exporting?: boolean) => void,
) {
  render(true);
  try {
    const svg = canvas.cloneNode(true) as SVGSVGElement;
    const originalTexts = canvas.querySelectorAll('text');
    svg.querySelectorAll('text').forEach((text, index) => {
      const computed = getComputedStyle(originalTexts[index]);
      for (const property of [
        'font-size',
        'font-weight',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linejoin',
        'paint-order',
      ])
        text.style.setProperty(property, computed.getPropertyValue(property));
      text.style.fontFamily = 'Arial, sans-serif';
    });
    const bounds = NetworkModel.bounds(model);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
    svg.setAttribute('width', String(bounds.width));
    svg.setAttribute('height', String(bounds.height));
    svg.removeAttribute('tabindex');
    const background = svg.querySelector('.diagram-background');
    if (background)
      for (const [key, value] of Object.entries(bounds))
        background.setAttribute(key, String(value));
    const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
    metadata.id = 'netmap-document';
    metadata.textContent = JSON.stringify(model);
    svg.prepend(metadata);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = model.name;
    svg.prepend(title);
    return new XMLSerializer().serializeToString(svg);
  } finally {
    render();
  }
}
