// Create / edit subject popup.
//
// Changes from GradeCalc:
//  - Cuatrimestre (Q1/Q2/Anual) + año académico preselected from today's date.
//  - Facultad and Universidad prefilled with the last ones used, with suggestions.
//  - Categories are remembered and suggested (also the ones typed above).
//  - Writing an exam name like "Lab3" fills its category from "Lab1"/"Lab2".
//  - Only one unnamed weight column by default; alternative evaluations
//    (each with its own name) are optional.

import { setupAutocomplete, closeAutocomplete } from './autocomplete.js';
import { refreshCard } from './dashboard.js';
import { totalPercent } from './grades.js';
import { forget, getSubject, remember, state, upsertSubject } from './store.js';
import { goBack, popupHide, popupShow, setLeaveGuard, showToast, t } from './ui.js';
import {
  academicDefaults,
  esc,
  fmt,
  html,
  isNumber,
  newId,
  normalize,
  randomInt,
  round,
  yearOptions,
} from './util.js';

const content = document.getElementById('editor-content');
const saveButton = document.getElementById('editor-save');
const titleElem = document.getElementById('editor-title');

const TERMS = ['Q1', 'Q2', 'Anual'];
const COLORS = [1, 8, 3, 4, 6, 5, 2, 7]; // same order as GradeCalc
const DEFAULT_EVAL_NAME = 'Continua';

let editing = null; // subject being edited, or null when creating
let dirty = false;
let grid = null;
let isOpen = false;

/* ------------------------------ Open / close ------------------------------ */

export function openEditor(id) {
  if (id) {
    editing = getSubject(id);
    if (!editing) {
      showToast('Esa asignatura ya no existe');
      goBack();
      return;
    }
  } else {
    editing = null;
  }
  titleElem.textContent = editing ? 'Editar asignatura' : 'Nueva asignatura';
  saveButton.textContent = editing ? 'Guardar' : 'Crear';
  buildForm(editing ?? newSubjectDefaults());
  dirty = false;
  isOpen = true;
  popupShow('editor-container');
  content.scrollTop = 0;
}

export function closeEditor() {
  if (!isOpen) return;
  isOpen = false;
  dirty = false;
  closeAutocomplete();
  popupHide('editor-container');
}

function newSubjectDefaults() {
  const { term, year } = academicDefaults();
  return {
    shortName: '',
    fullName: '',
    term,
    year,
    faculty: state.prefs.faculty,
    uni: state.prefs.uni,
    color: randomInt(1, 8),
    createdAt: Date.now(),
    exams: [],
    evaluations: [{ name: DEFAULT_EVAL_NAME, passMark: 5, weights: {} }],
    grades: {},
  };
}

/* ------------------------------ Form ------------------------------ */

function buildForm(subject) {
  const term = TERMS.includes(subject.term) ? subject.term : academicDefaults().term;
  const years = yearOptions(new Date(), [subject.year]);
  const year = subject.year || academicDefaults().year;

  content.innerHTML = `
  <form id="editor-form" novalidate autocomplete="off">
    <h2>Información</h2>
    <div class="edit-popup-info">
      <div>
        <label for="ed-shortName">Nombre</label>
        <input type="text" name="shortName" id="ed-shortName" placeholder="M2" maxlength="8" autocapitalize="characters" required enterkeyhint="next">
      </div>
      <div class="edit-fullName">
        <label for="ed-fullName">Nombre Largo</label>
        <input type="text" name="fullName" id="ed-fullName" placeholder="Matemáticas 2" autocapitalize="sentences" required enterkeyhint="next">
      </div>
    </div>
    <div class="edit-popup-info">
      <div class="edit-term">
        <span class="label" id="ed-term-label">Cuatrimestre</span>
        <div class="segmented" role="radiogroup" aria-labelledby="ed-term-label">
          ${TERMS.map(
            (tm) =>
              `<button type="button" role="radio" data-term="${tm}" class="${
                tm === term ? 'selected' : ''
              }" aria-checked="${tm === term}">${tm}</button>`
          ).join('')}
        </div>
      </div>
      <div>
        <label for="ed-year">Año académico</label>
        <select name="year" id="ed-year">
          ${years
            .map((y) => `<option value="${esc(y)}"${y === year ? ' selected' : ''}>${esc(y)}</option>`)
            .join('')}
        </select>
      </div>
    </div>
    <div class="edit-popup-info">
      <div>
        <label for="ed-faculty">Facultad</label>
        <input type="text" name="faculty" id="ed-faculty" placeholder="FIB" data-ac="faculties" autocapitalize="characters" enterkeyhint="next">
      </div>
      <div>
        <label for="ed-uni">Universidad</label>
        <input type="text" name="uni" id="ed-uni" placeholder="UPC" data-ac="unis" autocapitalize="characters" enterkeyhint="next">
      </div>
    </div>
    <div class="color-bar">
      ${COLORS.map(
        (c) => `<label class="scol${c}" for="ed-color-${c}">
          <input type="radio" name="color" value="${c}" id="ed-color-${c}"${
          c === Number(subject.color) ? ' checked' : ''
        }>
          <span class="edit-color-checkmark"></span>
        </label>`
      ).join('')}
    </div>
    <div class="edit-popup-info">
      <div><span>Fecha de creación: <span>${new Date(
        subject.createdAt || Date.now()
      ).toLocaleDateString('es-ES')}</span></span></div>
    </div>

    <h2>Evaluación</h2>
    <div class="edit-popup-grid"></div>
    <p class="edit-hint" hidden>Cada columna es una forma de evaluar la asignatura (p. ej. continua o única). En la tarjeta podrás elegir cuál usar.</p>
    <button type="button" class="edit-add-evaluation" data-action="add-eval">+ Evaluación alternativa</button>
  </form>`;

  const form = content.querySelector('form');
  // Set values with .value so any character is safe.
  form.shortName.value = subject.shortName ?? '';
  form.fullName.value = subject.fullName ?? '';
  form.faculty.value = subject.faculty ?? '';
  form.uni.value = subject.uni ?? '';

  grid = new EvalGrid(content.querySelector('.edit-popup-grid'), subject);
  updateEvalHint();
}

function updateEvalHint() {
  content.querySelector('.edit-hint').hidden = grid.evals.length < 2;
}

/* ------------------------------ Evaluation grid ------------------------------ */

class EvalGrid {
  constructor(root, subject) {
    this.root = root;
    this.subject = subject;
    this.evals = subject.evaluations.map((ev) => ({ name: ev.name, passMark: ev.passMark ?? 5 }));
    this.rows = [];

    this.header = html('<div class="edit-row"></div>');
    this.separator = html('<div class="grid-separator-evaluation"></div>');
    this.footer = html('<div class="edit-row"></div>');
    root.append(this.header, this.separator, this.footer);

    for (const exam of subject.exams) {
      const weights = subject.evaluations.map((ev) => ev.weights[exam.name]);
      this.addRow(exam, weights, false);
    }
    this.addRow(undefined, undefined, true);
    this.renderHeader();
    this.renderFooter();
    this.layout();
    this.updateTotals();
  }

  /* --- rows --- */

  addRow(exam = { name: '', type: '' }, weights = [], ghost = false) {
    const wrap = html(`<div class="edit-row">
      <input type="text" name="exam" placeholder="NEW" maxlength="6" autocapitalize="sentences" enterkeyhint="next">
      <input type="text" name="examType" placeholder="Parciales" data-ac="categories" autocapitalize="sentences" enterkeyhint="next">
      <input type="number" name="mark" placeholder="-" disabled tabindex="-1">
    </div>`);
    const row = {
      wrap,
      name: wrap.children[0],
      type: wrap.children[1],
      mark: wrap.children[2],
      weights: [],
      orig: exam.name || null,
      ghost: false,
    };
    row.name.value = exam.name;
    row.type.value = exam.type;
    const grade = this.subject.grades?.[exam.name];
    if (exam.name && isNumber(grade)) row.mark.placeholder = fmt(grade);

    this.evals.forEach((_, k) => this.addWeightCell(row, weights[k]));
    this.rows.push(row);
    this.root.insertBefore(wrap, this.footer);
    this.setGhost(row, ghost);
    return row;
  }

  addWeightCell(row, weight) {
    const cell = html(
      // Text + decimal keyboard, so the comma of Spanish iPhone keyboards works.
      '<div class="edit-weight"><input type="text" name="weight" inputmode="decimal" pattern="\\d*([.,]\\d*)?" placeholder="0" autocomplete="off" enterkeyhint="next"></div>'
    );
    if (weight) cell.firstElementChild.value = round(weight * 100, 4);
    row.weights.push(cell.firstElementChild);
    row.wrap.appendChild(cell);
  }

  setGhost(row, ghost) {
    row.ghost = ghost;
    for (const cell of row.wrap.children) cell.classList.toggle('edit-new-exam', ghost);
    row.name.required = !ghost;
    row.type.required = !ghost;
  }

  rowOf(elem) {
    return this.rows.find((r) => r.wrap.contains(elem));
  }

  rowHasValue(row) {
    return Boolean(
      row.name.value.trim() || row.type.value.trim() || row.weights.some((w) => w.value !== '')
    );
  }

  removeRow(row) {
    row.wrap.remove();
    this.rows = this.rows.filter((r) => r !== row);
    this.layout();
    this.updateTotals();
  }

  /** Called on every input: the faded "NEW" row becomes real and a new one appears. */
  onInput(target) {
    const row = this.rowOf(target);
    if (row?.ghost && this.rowHasValue(row)) {
      this.setGhost(row, false);
      this.addRow(undefined, undefined, true);
      this.layout();
    }
    if (target.name === 'weight') this.updateTotals();
  }

  /** Removes rows left completely empty once the focus leaves them. */
  onFocusOut(target, next) {
    const row = this.rowOf(target);
    if (!row || row.ghost || (next && row.wrap.contains(next))) return;
    if (!this.rowHasValue(row)) this.removeRow(row);
  }

  /** "Lab3" -> category of "Lab1"/"Lab2" (in this form or in other subjects). */
  inferCategory(row) {
    const stem = (s) => normalize(s).replace(/[\s\-_.]*\d+$/, '');
    const target = stem(row.name.value);
    if (!target) return '';
    for (const other of this.rows) {
      if (other !== row && !other.ghost && other.type.value.trim() && stem(other.name.value) === target) {
        return other.type.value.trim();
      }
    }
    for (const subject of state.subjects) {
      for (const exam of subject.exams) {
        if (exam.type && stem(exam.name) === target) return exam.type;
      }
    }
    return '';
  }

  /** Categories typed in this form, for the suggestions. */
  formCategories(exceptRow) {
    return this.rows
      .filter((r) => r !== exceptRow)
      .map((r) => r.type.value.trim())
      .filter(Boolean);
  }

  /* --- evaluations (columns) --- */

  addEvaluation() {
    this.evals.push({ name: '', passMark: 5 });
    for (const row of this.rows) {
      this.addWeightCell(row);
      if (row.ghost) this.setGhost(row, true);
    }
    this.renderHeader();
    this.renderFooter();
    this.layout();
    this.updateTotals();
    const input = this.header.querySelector(`[data-eval="${this.evals.length - 1}"] input`);
    input?.focus();
    this.root.scrollLeft = this.root.scrollWidth;
  }

  removeEvaluation(k) {
    this.syncEvalNames();
    this.evals.splice(k, 1);
    for (const row of this.rows) {
      row.weights[k].parentElement.remove();
      row.weights.splice(k, 1);
    }
    this.renderHeader();
    this.renderFooter();
    this.layout();
    this.updateTotals();
  }

  /** Copies the names typed in the header inputs into this.evals. */
  syncEvalNames() {
    if (this.evals.length < 2) return;
    this.header.querySelectorAll('[data-eval] input').forEach((input, k) => {
      this.evals[k].name = input.value;
    });
  }

  renderHeader() {
    this.syncEvalNames();
    const multi = this.evals.length > 1;
    if (multi && !this.evals[0].name) this.evals[0].name = DEFAULT_EVAL_NAME;
    this.header.innerHTML = `<span>Nombre</span><span>Categoría</span><span>Nota</span>${this.evals
      .map((ev, k) =>
        multi
          ? `<div class="eval-head" data-eval="${k}"><input type="text" name="evalName" placeholder="${
              k === 0 ? DEFAULT_EVAL_NAME : 'Final'
            }" required autocapitalize="sentences"><button type="button" class="eval-remove" data-remove-eval="${k}" aria-label="Quitar esta evaluación">×</button></div>`
          : `<span data-eval="${k}">Peso</span>`
      )
      .join('')}`;
    if (multi) {
      this.header.querySelectorAll('[data-eval] input').forEach((input, k) => {
        input.value = this.evals[k].name;
      });
    }
  }

  renderFooter() {
    this.footer.innerHTML = this.evals
      .map((_, k) => `<span class="edit-total" data-eval="${k}">0%</span>`)
      .join('');
  }

  /** Places every cell in the CSS grid (like GradeCalc's explicit layout). */
  layout() {
    const place = (elem, row, col) => {
      elem.style.gridRow = String(row);
      elem.style.gridColumn = String(col);
    };
    [...this.header.children].forEach((cell, i) => place(cell, 1, i < 3 ? i + 1 : i + 2));
    this.rows.forEach((row, r) => {
      place(row.name, r + 2, 1);
      place(row.type, r + 2, 2);
      place(row.mark, r + 2, 3);
      row.weights.forEach((input, k) => place(input.parentElement, r + 2, k + 5));
    });
    this.separator.style.gridColumn = '4';
    this.separator.style.gridRow = `2 / ${this.rows.length + 2}`;
    [...this.footer.children].forEach((cell, k) => place(cell, this.rows.length + 2, k + 5));
  }

  updateTotals() {
    const realRows = this.rows.filter((r) => !r.ghost || this.rowHasValue(r));
    this.evals.forEach((_, k) => {
      const total = realRows.reduce((acc, r) => acc + parseWeight(r.weights[k].value), 0);
      const cell = this.footer.querySelector(`[data-eval="${k}"]`);
      const percent = round(total * 100, 4) ?? 0;
      cell.textContent = `${percent}%`;
      cell.classList.toggle('warn', percent !== 100 && realRows.length > 0);
    });
  }

  /** Reads the grid. Returns { exams, evaluations } or { error, focus }. */
  read() {
    this.syncEvalNames();
    const rows = this.rows.filter((r) => !r.ghost);
    if (rows.length === 0) {
      return { error: 'Añade al menos un examen en Evaluación', focus: this.rows[0]?.name };
    }

    const exams = [];
    const seen = new Map();
    for (const row of rows) {
      const name = row.name.value.trim();
      const type = row.type.value.trim();
      if (!name) return { error: 'A un examen le falta el nombre', focus: row.name };
      if (!type) return { error: `Pon una categoría a <b>${t(name)}</b>`, focus: row.type };
      const key = normalize(name);
      if (seen.has(key)) {
        return { error: `Hay dos exámenes llamados <b>${t(name)}</b>`, focus: row.name };
      }
      seen.set(key, true);
      exams.push({ name, type, orig: row.orig, row });
    }

    const multi = this.evals.length > 1;
    const evalNames = new Set();
    const evaluations = this.evals.map((ev, k) => {
      const name = multi ? ev.name.trim() : ev.name.trim() || DEFAULT_EVAL_NAME;
      const weights = {};
      for (const exam of exams) {
        const w = parseWeight(exam.row.weights[k].value);
        if (w > 0) weights[exam.name] = w;
      }
      return { name, passMark: ev.passMark ?? 5, weights };
    });

    for (const [k, ev] of evaluations.entries()) {
      const nameInput = this.header.querySelector(`[data-eval="${k}"] input`);
      if (multi && !ev.name) return { error: 'Ponle nombre a cada evaluación', focus: nameInput };
      if (multi && evalNames.has(normalize(ev.name))) {
        return { error: 'Las evaluaciones deben tener nombres distintos', focus: nameInput };
      }
      evalNames.add(normalize(ev.name));
      if (Object.keys(ev.weights).length === 0) {
        return {
          error: multi
            ? `Pon los porcentajes de <b>${t(ev.name)}</b>`
            : 'Pon el porcentaje de cada examen',
          focus: exams[0].row.weights[k],
        };
      }
    }
    for (const exam of exams) {
      if (!evaluations.some((ev) => ev.weights[exam.name] > 0)) {
        return { error: `Pon el porcentaje de <b>${t(exam.name)}</b>`, focus: exam.row.weights[0] };
      }
    }

    return {
      exams: exams.map(({ name, type, orig }) => ({ name, type, orig })),
      evaluations,
    };
  }
}

function parseWeight(value) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n / 100 : 0;
}

/* ------------------------------ Save ------------------------------ */

function save() {
  const form = content.querySelector('form');
  const shortName = form.shortName.value.trim();
  const fullName = form.fullName.value.trim();
  if (!shortName) return fail('Rellena el Nombre', form.shortName);
  if (!fullName) return fail('Rellena el Nombre Largo', form.fullName);

  const result = grid.read();
  if (result.error) return fail(result.error, result.focus);

  // Keep the grades, following exams that were renamed.
  const grades = {};
  if (editing) {
    for (const exam of result.exams) {
      const old = editing.grades[exam.orig ?? exam.name];
      if (isNumber(old)) grades[exam.name] = old;
    }
  }

  const faculty = form.faculty.value.trim();
  const uni = form.uni.value.trim();
  const subject = {
    id: editing?.id ?? newId(),
    shortName,
    fullName,
    term: content.querySelector('.segmented .selected')?.dataset.term ?? academicDefaults().term,
    year: form.year.value,
    faculty,
    uni,
    color: Number(form.querySelector('input[name="color"]:checked')?.value) || randomInt(1, 8),
    createdAt: editing?.createdAt ?? Date.now(),
    exams: result.exams.map(({ name, type }) => ({ name, type })),
    evaluations: result.evaluations,
    grades,
    selectedEvaluation: Math.min(editing?.selectedEvaluation ?? 0, result.evaluations.length - 1),
  };

  remember('categories', subject.exams.map((e) => e.type));
  if (faculty) remember('faculties', faculty);
  if (uni) remember('unis', uni);
  state.prefs.faculty = faculty;
  state.prefs.uni = uni;
  upsertSubject(subject); // also saves to storage

  refreshCard(subject.id);
  dirty = false;
  goBack();

  const incomplete = subject.evaluations.filter((ev) => totalPercent(ev) !== 100);
  if (incomplete.length) {
    const names = incomplete.map((ev) => `${totalPercent(ev)}%`).join(' y ');
    showToast(`Guardada. Ojo: los porcentajes suman <b>${names}</b>, no 100%`);
  }
}

function fail(message, focusElem) {
  showToast(message, undefined, 5000);
  if (focusElem) {
    focusElem.focus();
    focusElem.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/* ------------------------------ Events ------------------------------ */

export function setupEditor() {
  saveButton.addEventListener('click', save);

  content.addEventListener('input', (event) => {
    dirty = true;
    if (grid && event.target.closest('.edit-popup-grid')) grid.onInput(event.target);
  });

  content.addEventListener('change', (event) => {
    dirty = true;
    const target = event.target;
    if (grid && target.name === 'exam') {
      const row = grid.rowOf(target);
      if (row && !row.type.value.trim()) {
        const category = grid.inferCategory(row);
        if (category) {
          row.type.value = category;
          grid.onInput(row.type);
        }
      }
    }
  });

  content.addEventListener('focusout', (event) => {
    if (grid && event.target.closest('.edit-popup-grid')) {
      grid.onFocusOut(event.target, event.relatedTarget);
    }
  });

  content.addEventListener('click', (event) => {
    const termButton = event.target.closest('[data-term]');
    if (termButton) {
      content.querySelectorAll('[data-term]').forEach((b) => {
        b.classList.toggle('selected', b === termButton);
        b.setAttribute('aria-checked', String(b === termButton));
      });
      dirty = true;
      return;
    }
    if (event.target.closest('[data-action="add-eval"]')) {
      grid.addEvaluation();
      updateEvalHint();
      dirty = true;
      return;
    }
    const remove = event.target.closest('[data-remove-eval]');
    if (remove) {
      grid.removeEvaluation(Number(remove.dataset.removeEval));
      updateEvalHint();
      dirty = true;
    }
  });

  content.addEventListener('submit', (event) => event.preventDefault());

  setupAutocomplete(content, {
    categories: {
      options: (input) => {
        const row = grid?.rowOf(input);
        const inForm = grid ? grid.formCategories(row) : [];
        const formKeys = new Set(inForm.map(normalize));
        return [
          ...inForm.map((value) => ({ value, removable: false })),
          ...state.lists.categories.map((value) => ({
            value,
            removable: !formKeys.has(normalize(value)),
          })),
        ];
      },
      onForget: (value) => forget('categories', value),
    },
    faculties: {
      options: () => state.lists.faculties.map((value) => ({ value, removable: true })),
      onForget: (value) => forget('faculties', value),
    },
    unis: {
      options: () => state.lists.unis.map((value) => ({ value, removable: true })),
      onForget: (value) => forget('unis', value),
    },
  });

  // Ask before losing a half-written subject with the back button.
  setLeaveGuard(
    () => !isOpen || !dirty || window.confirm('¿Salir sin guardar? Se perderán los cambios.')
  );
}

export function isEditorOpen() {
  return isOpen;
}
