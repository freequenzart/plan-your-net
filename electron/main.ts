import { app, BrowserWindow, dialog, Menu, session } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const development = process.env.PLAN_YOUR_NET_ELECTRON_DEV === '1' && !app.isPackaged;
const smokeTest = process.argv.includes('--smoke-test') && !app.isPackaged;
const entryFile = join(__dirname, 'web', 'index.html');
const entryUrl = pathToFileURL(entryFile).href;
let mainWindow: BrowserWindow | null = null;

app.setName('Plan Your Net');
if (process.platform === 'win32') app.setAppUserModelId('app.planyournet.desktop');
if (smokeTest) app.setPath('userData', join(app.getPath('temp'), 'plan-your-net-electron-smoke'));
else if (development) app.setPath('userData', join(app.getPath('appData'), 'Netmap Development'));
else app.setPath('userData', join(app.getPath('appData'), 'Netmap'));

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 360,
    minHeight: 480,
    title: 'Plan Your Net',
    icon: join(__dirname, 'icon.png'),
    backgroundColor: '#191e1b',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });
  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== entryUrl) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.once('ready-to-show', () => {
    if (!smokeTest) window.show();
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  void window
    .loadFile(entryFile)
    .then(async () => {
      if (!smokeTest) return;
      const result: unknown = await window.webContents.executeJavaScript(`(() => {
      const application = document.querySelector('plan-your-net-app');
      document.querySelector('[data-tour-action="skip"]')?.click();
      application.action('build');
      const listedDevices = [...document.querySelectorAll('.assembly-item[data-entry-kind="component"]')].reduce((count, row) => count + JSON.parse(row.dataset.deviceIds).length, 0);
      const buildReady = application.state.mode === 'build' && listedDevices === application.state.document.devices.length && document.querySelectorAll('.assembly-item[data-entry-kind="link"]').length === application.state.document.links.length;
      return {
        ready: !!application && document.querySelectorAll('.map-device').length > 0,
        nodeDisabled: typeof require === 'undefined' && typeof process === 'undefined',
        svgAvailable: !!application && !!application.canvas.createSvg().includes('netmap-document'),
        registered: ['plan-your-net-app', 'network-canvas', 'property-panel', 'device-palette', 'assembly-view', 'app-tour'].every(tag => !!customElements.get(tag)),
        buildModeAvailable: buildReady
      };
    })()`);
      console.log('[plan-your-net-electron] Smoke test:', JSON.stringify(result));
      const success =
        result &&
        typeof result === 'object' &&
        Object.values(result).every((value) => value === true);
      app.exit(success ? 0 : 1);
    })
    .catch((error) => {
      if (smokeTest) console.error(error);
      else
        dialog.showErrorBox(
          'Plan Your Net could not start',
          error instanceof Error ? error.message : String(error),
        );
      app.exit(1);
    });
  return window;
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (event, item, contents) => {
      if (contents !== mainWindow?.webContents || !item.getURL().startsWith('blob:')) {
        event.preventDefault();
        return;
      }
      item.setSaveDialogOptions({
        defaultPath: join(app.getPath('downloads'), item.getFilename()),
      });
    });
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
