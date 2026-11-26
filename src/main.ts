import { DevicePalette } from './components/device-palette';
import { PlanYourNetApp } from './components/plan-your-net-app';
import { NetworkCanvas } from './components/network-canvas';
import { PropertyPanel } from './components/property-panel';
import { AssemblyView } from './components/assembly-view';
import { AppTour } from './components/app-tour';
import { AppSettings, t } from './i18n';
import './styles/index.css';

AppSettings.apply();
document.title = t('appTitle');

customElements.define('device-palette', DevicePalette);
customElements.define('property-panel', PropertyPanel);
customElements.define('network-canvas', NetworkCanvas);
customElements.define('assembly-view', AssemblyView);
customElements.define('app-tour', AppTour);
customElements.define('plan-your-net-app', PlanYourNetApp);

if (__DEV__ && location.protocol !== 'file:') {
  const updates = new EventSource('/esbuild');
  updates.addEventListener('change', () => location.reload());
}
