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
import { goBack, hasOpenPopup, navigate, popupHide, route, showToast, startRouter } from './ui.js';
import { isIOS, isStandalone } from './util.js';

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
  } else {
    // Web version: works offline and can be installed from the browser.
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('sw.js').catch((error) => console.warn('SW error', error));
    }
    setupInstallHints();
  }
}

const HINT_KEY = 'gradecheck:installHint';
const HINT_EVERY = 3 * 24 * 60 * 60 * 1000; // at most every 3 days

function hintRecentlyShown() {
  try {
    return Date.now() - (Number(localStorage.getItem(HINT_KEY)) || 0) < HINT_EVERY;
  } catch {
    return false;
  }
}

function markHintShown() {
  try {
    localStorage.setItem(HINT_KEY, String(Date.now()));
  } catch {
    // private mode: just show it again next time
  }
}

/** Explains how to install the web app (Safari has no install button). */
function setupInstallHints() {
  if (isStandalone()) return;

  if (isIOS()) {
    document.documentElement.classList.add('ios-browser');
    if (!hintRecentlyShown()) {
      setTimeout(() => {
        markHintShown();
        showToast(
          '📲 Instálala: pulsa <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>',
          { label: 'Vale', onClick: () => {} },
          15000
        );
      }, 2500);
    }
    return;
  }

  // Chrome / Edge (Android, PC): they have their own install prompt.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    if (hintRecentlyShown()) return;
    setTimeout(() => {
      markHintShown();
      showToast('Usa GradeCheck sin internet', { label: 'Instalar', onClick: () => event.prompt() }, 12000);
    }, 3000);
  });
}

start();
