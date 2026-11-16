// Settings popup: backup and the remembered suggestions.

import { applyBackup, exportBackup, readBackupFile } from './backup.js';
import { renderDashboard } from './dashboard.js';
import { forget, state } from './store.js';
import { popupShow, showToast, t } from './ui.js';
import { esc } from './util.js';

const content = document.getElementById('settings-content');
const importInput = document.getElementById('import-input');

const LISTS = [
  { key: 'categories', title: 'Categorías guardadas' },
  { key: 'faculties', title: 'Facultades' },
  { key: 'unis', title: 'Universidades' },
];

export function openSettings() {
  render();
  popupShow('settings-container');
}

function render() {
  const n = state.subjects.length;
  content.innerHTML = `
    <h2>Ajustes</h2>
    <p class="settings-note">Tus asignaturas y notas se guardan solas en este dispositivo${
      n ? ` (ahora tienes ${n} ${n === 1 ? 'asignatura' : 'asignaturas'})` : ''
    }.</p>

    <h3>Copia de seguridad</h3>
    <div class="settings-actions">
      <button type="button" class="btn-green" data-settings="export">Exportar</button>
      <button type="button" data-settings="import">Importar</button>
    </div>
    <p class="settings-note">Exporta un archivo .json y guárdalo en Drive o donde quieras. Al importarlo se reemplazan los datos actuales.</p>

    ${LISTS.map(
      ({ key, title }) => `<h3>${title}</h3>
      <div class="chips">${
        state.lists[key].length
          ? state.lists[key]
              .map(
                (value) =>
                  `<span class="chip">${esc(value)}<button type="button" data-forget-list="${key}" data-value="${esc(
                    value
                  )}" aria-label="Olvidar ${esc(value)}">×</button></span>`
              )
              .join('')
          : '<span class="chips-empty">Nada todavía. Se guardan al crear asignaturas.</span>'
      }</div>`
    ).join('')}

    <p class="settings-credits">GradeCheck v${__APP_VERSION__} · Basada en
      <a href="https://github.com/mauriciabad/GradeCalc" target="_blank" rel="noopener">GradeCalc</a>
      de Maurici Abad</p>`;
}

export function setupSettings() {
  content.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-settings]')?.dataset.settings;
    if (action === 'export') {
      try {
        await exportBackup();
      } catch (error) {
        console.error(error);
        showToast('No se ha podido exportar la copia');
      }
      return;
    }
    if (action === 'import') {
      importInput.value = '';
      importInput.click();
      return;
    }
    const forgetButton = event.target.closest('[data-forget-list]');
    if (forgetButton) {
      forget(forgetButton.dataset.forgetList, forgetButton.dataset.value);
      render();
    }
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      const incoming = data.subjects.length;
      const current = state.subjects.length;
      const ok =
        current === 0 ||
        window.confirm(
          `Vas a reemplazar ${
            current === 1 ? 'tu asignatura' : `tus ${current} asignaturas`
          } por ${incoming === 1 ? 'la de la copia' : `las ${incoming} de la copia`}. ¿Continuar?`
        );
      if (!ok) return;
      const count = applyBackup(data);
      renderDashboard();
      render();
      showToast(`Copia importada: <b>${t(count)}</b> asignaturas`);
    } catch (error) {
      console.error(error);
      showToast(t(error.message || 'No se ha podido importar'));
    }
  });
}
