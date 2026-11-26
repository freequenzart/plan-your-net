import { expect, test } from '@playwright/test';
import type { MapDocument } from '../../src/domain/types';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('netmap.onboarding.v1', 'seen');
    localStorage.setItem(
      'netmap.preferences.v1',
      JSON.stringify({ language: 'en', theme: 'light' }),
    );
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Plan Your Net · Network planner');
});

test('global listeners are removed while the app is disconnected and restored once', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const application = document.querySelector('plan-your-net-app') as HTMLElement & {
      action: (name: string) => unknown;
      state: { tool: string };
      tour: HTMLElement & { dialog: HTMLDialogElement; showStep: (index: number) => void };
    };
    let roomActions = 0;
    let resizeCalls = 0;
    const originalAction = application.action.bind(application);
    application.action = (name) => {
      if (name === 'room') roomActions += 1;
      return originalAction(name);
    };
    application.tour.showStep = () => {
      resizeCalls += 1;
    };

    application.remove();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    const detachedKeydown = roomActions;

    document.body.append(application);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    const reconnectedKeydown = roomActions;

    application.tour.dialog.open = true;
    application.remove();
    window.dispatchEvent(new Event('resize'));
    const detachedResize = resizeCalls;

    document.body.append(application);
    window.dispatchEvent(new Event('resize'));
    return {
      detachedKeydown,
      reconnectedKeydown,
      detachedResize,
      reconnectedResize: resizeCalls,
      tool: application.state.tool,
    };
  });

  expect(result.detachedKeydown).toBe(0);
  expect(result.reconnectedKeydown).toBe(1);
  expect(result.detachedResize).toBe(0);
  expect(result.reconnectedResize).toBe(1);
  expect(result.tool).toBe('room');
});

test('guided introduction highlights controls without changing the document', async ({ page }) => {
  const before = await page.locator('.map-device').count();
  await page.locator('[data-action="tour"]').click();
  await expect(page.locator('app-tour dialog')).toBeVisible();
  for (let step = 0; step < 8; step++) {
    await expect(page.locator('.tour-spotlight')).toBeVisible();
    const bounds = await page.locator('.tour-popover').boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.locator('[data-tour-action="next"]').click();
  }
  await expect(page.locator('app-tour dialog')).not.toBeVisible();
  await expect(page.locator('.map-device')).toHaveCount(before);
});

test('TV endpoint is available and can be placed', async ({ page }) => {
  if (page.viewportSize()!.width <= 720)
    await page.locator('[data-action="toggle-palette"]').click();
  const tvTile = page.locator('.device-tile[data-type="tv"]');
  await expect(tvTile).toHaveText('TV / Smart TV');
  await tvTile.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
        return document.devices.find((device) => device.type === 'tv')?.type;
      }),
    )
    .toBe('tv');
});

test('custom endpoints are created, placed, exported and individually imported', async ({
  page,
}) => {
  if (page.viewportSize()!.width <= 720)
    await page.locator('[data-action="toggle-palette"]').click();
  await page.locator('[data-custom-command="create"]').click();
  const dialog = page.locator('device-palette .custom-device-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="name"]').fill('Rack display');
  await dialog.locator('[name="icon"]').selectOption('tv');
  await dialog.locator('[type="submit"]').click();

  const customTile = page.locator('.custom-device-entry .device-tile').first();
  await expect(customTile).toHaveText('Rack display');
  await customTile.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
        return document.devices.find((device) => device.type.startsWith('custom-'))?.type;
      }),
    )
    .toMatch(/^custom-/);

  if (page.viewportSize()!.width <= 720)
    await page.locator('[data-action="toggle-palette"]').click();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('[data-custom-action="export"]').click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toMatchObject({
    format: 'plan-your-net-device-type',
    name: 'Rack display',
    icon: 'tv',
  });

  await page.locator('.custom-device-file').setInputFiles({
    name: 'imported-endpoint.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'plan-your-net-device-type',
        version: 1,
        name: 'Imported display',
        icon: 'monitor',
      }),
    ),
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
        return document.customDeviceTypes?.length;
      }),
    )
    .toBe(2);
});

test('mark current state sets devices and connections to current', async ({ page }) => {
  const button = page.locator('[data-action="mark-actual"]');
  await expect(button).toBeVisible();
  await button.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
        return (
          document.devices.every(
            (device) => device.planning?.purchased && device.planning?.installed,
          ) &&
          document.links.every((link) =>
            link.medium === 'wireless'
              ? link.planning?.installed
              : link.planning?.purchased && link.planning?.installed,
          )
        );
      }),
    )
    .toBe(true);
  await expect(button).toBeDisabled();
});

test('Status mode shows all devices and cables with acquired/installed colors', async ({
  page,
}) => {
  const statusMode = page.locator('[data-action="view"]');
  await expect(statusMode).toHaveText('Status');
  await statusMode.click();
  await page.setViewportSize({ width: 320, height: 820 });
  await expect(page.locator('.map-device')).toHaveCount(8);
  await expect(page.locator('.map-link')).toHaveCount(7);
  await expect(page.locator('.status-color-legend')).toBeVisible();
  const legendBounds = await page.locator('.status-color-legend').boundingBox();
  expect(legendBounds).not.toBeNull();
  expect(legendBounds!.x).toBeGreaterThanOrEqual(0);
  expect(legendBounds!.x + legendBounds!.width).toBeLessThanOrEqual(320);
  await expect(page.locator('.status-view-switch')).toHaveCount(0);

  await page.evaluate(() => {
    const application = document.querySelector('plan-your-net-app') as HTMLElement & {
      state: { document: MapDocument };
      save: () => void;
      refresh: () => void;
    };
    application.state.document.devices[0].planning = { purchased: true, installed: true };
    application.state.document.links[0].planning = { purchased: true, installed: true };
    application.save();
    application.refresh();
  });
  await expect(page.locator('.map-device[data-status="actual"]')).toHaveCount(1);
  await expect(page.locator('.map-device[data-status="planned"]')).toHaveCount(7);
  await expect(page.locator('.map-link[data-status="actual"]')).toHaveCount(1);
  await expect(page.locator('.map-link[data-status="planned"]')).toHaveCount(6);
  await expect(page.locator('.map-device[data-status="actual"] rect').first()).toHaveAttribute(
    'fill',
    '#39836b',
  );
  await expect(
    page.locator('.map-link[data-status="planned"] path.visible-link').first(),
  ).toHaveAttribute('stroke', '#cf8737');
});

test('connection labels drag independently, persist, undo, and render above every line', async ({
  page,
}) => {
  const label = page.locator('.link-label-group').first();
  const linkId = await label.getAttribute('data-id');
  const initialTransform = await label.getAttribute('transform');
  const bounds = await label.boundingBox();
  expect(bounds).not.toBeNull();
  const aboveEveryLine = await label.evaluate((element) => {
    const root = element.closest('.diagram-content');
    const lines = root?.querySelectorAll('.map-link');
    const lastLine = lines?.item((lines.length || 1) - 1);
    return (
      !!root &&
      !!lastLine &&
      !!(lastLine.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  expect(aboveEveryLine).toBe(true);

  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 60, bounds!.y + bounds!.height / 2 + 35, {
    steps: 6,
  });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate((id) => {
        const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
        return document.links.find((link) => link.id === id)?.labelPosition;
      }, linkId),
    )
    .toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  await expect(label).not.toHaveAttribute('transform', initialTransform || '');
  await expect(page.locator('.floating-toolbar [data-action="undo"]')).toBeEnabled();
  await page.locator('.floating-toolbar [data-action="undo"]').click();
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
        return document.links.find((link) => link.id === id)?.labelPosition;
      }, linkId),
    )
    .toBeUndefined();
});

test('header actions fit responsive breakpoints without overlap', async ({ page }) => {
  for (const width of [320, 360, 390, 600, 720, 721, 768, 950, 951, 1000, 1024, 1100, 1150, 1151]) {
    await page.setViewportSize({ width, height: 820 });
    const layout = await page.evaluate(() => {
      const actions = [...document.querySelectorAll<HTMLElement>('.header-actions > *')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            name: element.className || element.tagName,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            visible: getComputedStyle(element).display !== 'none',
          };
        })
        .filter((element) => element.visible);
      const overlaps: string[] = [];
      for (let left = 0; left < actions.length; left++)
        for (let right = left + 1; right < actions.length; right++)
          if (
            actions[left].left < actions[right].right &&
            actions[left].right > actions[right].left &&
            actions[left].top < actions[right].bottom &&
            actions[left].bottom > actions[right].top
          )
            overlaps.push(`${actions[left].name}/${actions[right].name}`);
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        rightmostAction: Math.max(...actions.map((action) => action.right)),
        overlaps,
      };
    });
    expect(layout.documentWidth, `document overflow at ${width}px`).toBe(width);
    expect(layout.rightmostAction, `header clipped at ${width}px`).toBeLessThanOrEqual(width);
    expect(layout.overlaps, `header overlaps at ${width}px`).toEqual([]);
  }
});

test('save overwrites the selected JSON handle without opening another picker', async ({
  page,
}) => {
  const sourceDocument: MapDocument = {
    version: 1,
    name: 'Opened plan',
    devices: [],
    rooms: [],
    links: [],
  };
  await page.evaluate((contents) => {
    const state = { contents: '', savePickerCalls: 0 };
    const handle = {
      name: 'opened-plan.json',
      getFile: async () => new File([contents], 'opened-plan.json', { type: 'application/json' }),
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      createWritable: async () => ({
        write: async (value: string) => {
          state.contents = value;
        },
        close: async () => {},
      }),
    };
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [handle],
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        state.savePickerCalls += 1;
        throw new Error('Save picker should not be called for an opened file');
      },
    });
    Object.defineProperty(window, '__planSaveTestState', { configurable: true, value: state });
  }, JSON.stringify(sourceDocument));

  await page.locator('.file-menu > summary').click();
  await page.locator('[data-action="import"]').click();
  const replaceDialog = page.locator('dialog.replace-plan-dialog');
  await expect(replaceDialog).toBeVisible();
  await replaceDialog.locator('[value="confirm"]').click();
  const nameInput = page.locator('#document-name');
  await nameInput.fill('Updated plan');
  await nameInput.press('Tab');
  await page.locator('[data-action="save-json"]').click();

  const result = await page.evaluate(
    () =>
      (
        window as unknown as {
          __planSaveTestState: { contents: string; savePickerCalls: number };
        }
      ).__planSaveTestState,
  );
  expect(JSON.parse(result.contents).name).toBe('Updated plan');
  expect(result.savePickerCalls).toBe(0);
});

test('blur saving, references, grouping and rollout status work together', async ({ page }) => {
  if (page.viewportSize()!.width <= 950)
    await page.locator('[data-action="toggle-inspector"]').click();
  await page.locator('property-panel [data-select="switch"]').click();
  const input = page.locator('property-panel input[name="name"]');
  await input.fill('Office switch');
  await page.locator('.workspace-bar').click({ position: { x: 4, y: 4 } });
  await expect(page.locator('.map-device[data-id="switch"]')).toHaveAttribute(
    'aria-label',
    'Office switch',
  );
  await page.locator('property-panel [data-action="duplicate"]').click();
  await expect(page.locator('.map-device')).toHaveCount(9);
  const component = await page.evaluate(() => {
    const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
    return document.devices.find((device) => device.id === 'switch')!.componentId!;
  });
  await page.locator('[data-action="build"]').click();
  await page.locator('[name="assembly-grouping"]').selectOption('deviceType');
  const row = page.locator(
    `.assembly-item[data-entry-kind="component"][data-entry-id="${component}"]`,
  );
  await expect(row.locator('.assembly-quantity')).toHaveText('2×');
  await row.locator('summary input[name="planning.unitPrice"]').fill('49.90');
  await row.locator('summary input[name="planning.unitPrice"]').press('Tab');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const document = JSON.parse(localStorage.getItem('netmap.document.v1')!) as MapDocument;
        return document.devices
          .filter(
            (device) =>
              device.componentId ===
              document.devices.find((item) => item.id === 'switch')!.componentId,
          )
          .map((device) => device.planning?.unitPrice);
      }),
    )
    .toEqual([49.9, 49.9]);
  await row.locator('summary input[name="planning.purchased"]').check();
  await page.locator('[data-plan-filter="shopping"]').click();
  await expect(row).toHaveCount(0);
  await expect(page.locator('[name="assembly-grouping"]')).toHaveValue('deviceType');
  await page.locator('[data-plan-filter="open"]').click();
  await row.locator('summary input[name="planning.installed"]').click();
  await expect(row).toHaveCount(0);
});

test('SVG export includes editable topology metadata', async ({ page }) => {
  await page.locator('.file-menu > summary').click();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('[data-action="export-svg"]').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const contents = Buffer.concat(chunks).toString('utf8');
  expect(contents).toContain('netmap-document');
  const topology = await page.evaluate((contents) => {
    const document = new DOMParser().parseFromString(contents, 'image/svg+xml');
    return JSON.parse(
      document.querySelector('metadata#netmap-document')!.textContent!,
    ) as MapDocument;
  }, contents);
  expect(topology.devices).toHaveLength(8);
  expect(topology.links).toHaveLength(7);
});

test('JSON and SVG imports round-trip and reject invalid SVG without replacing the plan', async ({
  page,
}) => {
  const importedDocument: MapDocument = {
    version: 1,
    name: 'Imported plan',
    devices: [],
    rooms: [],
    links: [],
  };
  const fileInput = page.locator('.file-input');
  const confirm = page.locator('.replace-plan-dialog [value="confirm"]');

  await fileInput.setInputFiles({
    name: 'plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedDocument)),
  });
  await expect(page.locator('.replace-plan-dialog')).toBeVisible();
  await confirm.click();
  await expect(page.locator('#document-name')).toHaveValue(importedDocument.name);

  const svg = await page.evaluate(() => {
    const application = document.querySelector('plan-your-net-app') as unknown as {
      canvas: { createSvg: () => string };
    };
    return application.canvas.createSvg();
  });
  await fileInput.setInputFiles({
    name: 'plan.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg),
  });
  await expect(page.locator('.replace-plan-dialog')).toBeVisible();
  await confirm.click();
  await expect(page.locator('#document-name')).toHaveValue(importedDocument.name);

  const savedDocument = await page.evaluate(() => localStorage.getItem('netmap.document.v1'));
  for (const contents of [
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><metadata id="netmap-document">{</metadata></svg>',
  ]) {
    await page.evaluate(() => {
      const toast = document.querySelector<HTMLElement>('.toast');
      if (toast) toast.hidden = true;
    });
    await fileInput.setInputFiles({
      name: 'invalid.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(contents),
    });
    await expect(page.locator('.toast')).toBeVisible();
    await expect(page.locator('.replace-plan-dialog')).not.toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('netmap.document.v1')))
      .toBe(savedDocument);
  }
});
