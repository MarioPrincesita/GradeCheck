import 'normalize.css';
import '@fontsource/nunito/latin-300.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import './styles/main.css';

import { App } from '@capacitor/app';
import { SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { renderDashboard, setupDashboard } from './dashboard.js';
import { closeEditor, openEditor, setupEditor } from './editor.js';
import { openSettings, setupSettings } from './settings.js';
import { isNative, loadState } from './store.js';
import { goBack, hasOpenPopup, navigate, popupHide, route, startRouter } from './ui.js';

async function start() {
  await loadState();

  setupDashboard();
  setupEditor();
  setupSettings();
  renderDashboard();

  route(/^\/nueva$/, () => openEditor());
  route(/^\/editar\/(.+)$/, (id) => openEditor(id));
  route(/^\/ajustes$/, () => {
    closeEditor();
    openSettings();
  });
  route(/^$/, () => {
    closeEditor();
    popupHide('settings-container');
  });
  startRouter();

  document.getElementById('add-button-topbar').addEventListener('click', () => navigate('#/nueva'));
  document.getElementById('settings-button').addEventListener('click', () => navigate('#/ajustes'));
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="back"]')) goBack();
  });

  if (isNative) {
    // Android back button: close the popup, or leave the app on the dashboard.
    App.addListener('backButton', () => {
      if (hasOpenPopup()) goBack();
      else App.exitApp();
    });
    // White icons on the green status bar, dark icons on the grey navigation bar.
    SystemBars.setStyle({ style: SystemBarsStyle.Dark, bar: SystemBarType.StatusBar }).catch(() => {});
    SystemBars.setStyle({ style: SystemBarsStyle.Light, bar: SystemBarType.NavigationBar }).catch(
      () => {}
    );
  } else if ('serviceWorker' in navigator && import.meta.env.PROD) {
    // Web version: works offline and can be installed from the browser.
    navigator.serviceWorker.register('sw.js').catch((error) => console.warn('SW error', error));
  }
}

start();
