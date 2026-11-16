// Dashboard: one card per subject, with the progress bar and the grade inputs.
// Same markup and classes as GradeCalc so it looks and animates the same.

import { computeEvaluation, groupByType } from './grades.js';
import { confetti } from './confetti.js';
import { removeSubject, restoreSubject, saveState, setGrade, state, getSubject } from './store.js';
import { showToast, t, navigate } from './ui.js';
import { esc, fmt, html, isNumber, round } from './util.js';

const dashboard = document.getElementById('dashboard');
const tutorial = document.getElementById('tutorial');
const addButton = document.getElementById('add-button-topbar');
const congratsButton = document.getElementById('congratulations-button');
const congratsGift = document.getElementById('congratulations-gift');

const IMPOSSIBLE = 'ಥ_ಥ';
// 0 to 10 with "." or "," as decimal separator. Anything else gets the red border.
const GRADE_PATTERN = '10([.,]0*)?|\\d?([.,]\\d*)?';
const PASS_COLOR = '#5a9764';
const FAIL_COLOR = '#b9574c';

// Remembers which subjects were passed, to throw confetti only when it changes.
const passedBefore = new Map();

/* ------------------------------ Render ------------------------------ */

export function renderDashboard() {
  dashboard.innerHTML = '';
  for (const subject of state.subjects) {
    dashboard.appendChild(createCard(subject));
    passedBefore.set(subject.id, computeEvaluation(subject).passed);
  }
  updateEmptyState();
  congratulate();
}

/** Re-renders a single card (after editing the subject). */
export function refreshCard(id) {
  const subject = getSubject(id);
  const old = getCard(id);
  if (!subject) return;
  const card = createCard(subject);
  if (old) old.replaceWith(card);
  else dashboard.appendChild(card);
  passedBefore.set(id, computeEvaluation(subject).passed);
  updateEmptyState();
  congratulate();
}

function getCard(id) {
  return dashboard.querySelector(`.subject-card[data-id="${CSS.escape(id)}"]`);
}

function createCard(subject) {
  const result = computeEvaluation(subject);
  const card = html(`<div class="subject-card" data-id="${esc(subject.id)}">
    <button type="button" class="subject-card-remove" data-action="remove" aria-label="Borrar asignatura">
      <img src="media/trash.svg" alt="">
    </button>
    <button type="button" class="subject-card-info" data-action="edit" aria-label="Editar asignatura">
      <img src="media/edit.svg" alt="">
    </button>
    <h2>${esc(subject.shortName)}</h2>
    <p class="subject-finalMark" style="color: ${result.passed ? PASS_COLOR : FAIL_COLOR};">${fmt(result.finalMark)}</p>
    <div class="subject-bar">${barHTML(subject, result)}</div>
    <div class="grades-input hidden" style="height: 0px;">${inputsHTML(subject, result)}${evaluationSelectHTML(subject)}</div>
  </div>`);
  return card;
}

function neededText(result, name) {
  const value = result.needed[name];
  return value === null ? IMPOSSIBLE : fmt(value);
}

function barHTML(subject, result) {
  return result.items
    .map((item) => {
      const grade = subject.grades[item.name];
      const done = isNumber(grade);
      return `<div class="scol${subject.color}${done ? '' : ' scolN'}" style="flex-grow: ${
        item.weight * 100
      }" title="${round(item.weight * 100, 4)}%" data-exam="${esc(item.name)}">${esc(
        item.name
      )}<div data-exam="${esc(item.name)}">${done ? fmt(grade) : neededText(result, item.name)}</div></div>`;
    })
    .join('');
}

function inputsHTML(subject, result) {
  return groupByType(result.items)
    .map((group) => {
      const inputs = group.items
        .map((item) => {
          const grade = subject.grades[item.name];
          const done = isNumber(grade);
          // type="text" + inputmode="decimal": iPhones with a Spanish keyboard type a
          // comma, which Safari rejects in type="number" inputs.
          return `<div><span>${esc(item.name)}:</span><input type="text" inputmode="decimal" pattern="${GRADE_PATTERN}" data-exam="${esc(
            item.name
          )}" placeholder="${esc(neededText(result, item.name))}" value="${
            done ? fmt(grade) : ''
          }" class="scol${subject.color}${done ? '' : ' scolN2'}" autocomplete="off" enterkeyhint="done"></div>`;
        })
        .join('');
      return `<h3>${esc(group.type)}</h3><span>${round(group.weight * 100, 0)}%</span><div>${inputs}</div>`;
    })
    .join('');
}

function evaluationSelectHTML(subject) {
  if (subject.evaluations.length <= 1) return '';
  const options = subject.evaluations
    .map(
      (ev, i) =>
        `<option value="${i}"${i === subject.selectedEvaluation ? ' selected' : ''}>${esc(
          ev.name
        )}</option>`
    )
    .join('');
  return `<div class="evaluation-select"><span>Evaluación:</span><select data-action="evaluation">${options}</select></div>`;
}

/* ------------------------------ Live updates ------------------------------ */

/** Updates final mark, bar and placeholders without rebuilding the card. */
function displayMarks(card, subject, withConfetti = true) {
  const result = computeEvaluation(subject);

  const finalMark = card.querySelector('.subject-finalMark');
  finalMark.textContent = fmt(result.finalMark);
  finalMark.style.color = result.passed ? PASS_COLOR : FAIL_COLOR;

  for (const segment of card.querySelectorAll('.subject-bar > div')) {
    const name = segment.dataset.exam;
    const grade = subject.grades[name];
    const done = isNumber(grade);
    segment.classList.toggle('scolN', !done);
    segment.lastElementChild.textContent = done ? fmt(grade) : neededText(result, name);
  }
  for (const input of card.querySelectorAll('.grades-input input')) {
    const name = input.dataset.exam;
    const done = isNumber(subject.grades[name]);
    input.classList.toggle('scolN2', !done);
    input.placeholder = neededText(result, name);
  }

  const wasPassed = passedBefore.get(subject.id);
  if (withConfetti && !wasPassed && result.passed) confetti(card);
  passedBefore.set(subject.id, result.passed);
  congratulate();
}

function onGradeInput(card, subject, input) {
  const name = input.dataset.exam;
  const value = input.value.trim().replace(',', '.');
  const number = value === '' || value === '.' ? undefined : Number(value);
  setGrade(subject, name, isNumber(number) ? number : undefined);
  displayMarks(card, subject);
}

/* ------------------------------ Expand / collapse ------------------------------ */

function toggleExpand(card, forceOpen = false) {
  const inputs = card.querySelector('.grades-input');
  if (forceOpen) inputs.classList.remove('hidden');
  else inputs.classList.toggle('hidden');
  updateHeight(inputs);
}

function updateHeight(elem) {
  elem.style.height = `${elem.classList.contains('hidden') ? 0 : elem.scrollHeight}px`;
}

/* ------------------------------ Delete with undo ------------------------------ */

function deleteSubject(id) {
  const card = getCard(id);
  const removed = removeSubject(id);
  if (!removed) return;
  passedBefore.delete(id);
  removeCardAnimated(card);
  showToast(`Has borrado <b>${t(removed.subject.shortName)}</b>`, {
    label: 'Deshacer',
    onClick: () => {
      restoreSubject(removed);
      renderDashboard();
    },
  });
  updateEmptyState();
  congratulate();
}

// FLIP animation: the other cards slide to their new place.
function removeCardAnimated(card) {
  const before = cardRects();
  card.remove();
  const after = cardRects();
  for (const other of dashboard.querySelectorAll('.subject-card')) {
    const a = before.get(other);
    const b = after.get(other);
    if (!a || !b) continue;
    other.animate(
      [
        {
          transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scaleX(${
            a.width / b.width
          })`,
        },
        { transform: 'none' },
      ],
      { duration: 250, easing: 'ease-out' }
    );
  }
}

function cardRects() {
  const rects = new Map();
  for (const card of dashboard.querySelectorAll('.subject-card')) {
    rects.set(card, card.getBoundingClientRect());
  }
  return rects;
}

/* ------------------------------ Tutorial & congratulations ------------------------------ */

function updateEmptyState() {
  const empty = state.subjects.length === 0;
  tutorial.style.display = empty ? 'block' : 'none';
  addButton.classList.toggle('focus-animation-loop', empty);
}

function congratulate() {
  const all =
    state.subjects.length > 0 && state.subjects.every((s) => computeEvaluation(s).passed);
  const visible = congratsButton.style.display !== 'none';
  if (all && !visible) {
    congratsGift.src = `media/gift_jump_once.gif?n=${Math.random()}`;
    congratsButton.style.display = 'block';
  } else if (!all && visible) {
    congratsButton.style.display = 'none';
  }
}

/* ------------------------------ Events ------------------------------ */

export function setupDashboard() {
  dashboard.addEventListener('click', (event) => {
    const card = event.target.closest('.subject-card');
    if (!card) return;
    const id = card.dataset.id;
    const actionElem = event.target.closest('[data-action]');
    const action = actionElem?.dataset.action;

    if (action === 'remove') return deleteSubject(id);
    if (action === 'edit') return navigate(`#/editar/${encodeURIComponent(id)}`);

    // Mark the card as touched so the delete button shows on phones.
    dashboard.querySelectorAll('.touched').forEach((c) => c !== card && c.classList.remove('touched'));
    card.classList.add('touched');

    if (['INPUT', 'SELECT', 'OPTION'].includes(event.target.tagName)) return;

    const segment = event.target.closest('.subject-bar > div');
    if (segment) {
      // Tapping a piece of the bar opens the card and selects that grade input.
      toggleExpand(card, true);
      const input = card.querySelector(
        `.grades-input input[data-exam="${CSS.escape(segment.dataset.exam)}"]`
      );
      input?.focus();
      input?.select();
      return;
    }
    toggleExpand(card);
  });

  dashboard.addEventListener('input', (event) => {
    const input = event.target;
    if (!input.matches('.grades-input input')) return;
    const card = input.closest('.subject-card');
    const subject = getSubject(card.dataset.id);
    if (subject) onGradeInput(card, subject, input);
  });

  dashboard.addEventListener('change', (event) => {
    const select = event.target;
    if (select.dataset.action !== 'evaluation') return;
    const card = select.closest('.subject-card');
    const subject = getSubject(card.dataset.id);
    if (!subject) return;
    subject.selectedEvaluation = Number(select.value);
    saveState();
    // Rebuild the bar and inputs for the new evaluation, keeping the card open.
    const result = computeEvaluation(subject);
    card.querySelector('.subject-bar').innerHTML = barHTML(subject, result);
    const inputs = card.querySelector('.grades-input');
    inputs.innerHTML = inputsHTML(subject, result) + evaluationSelectHTML(subject);
    updateHeight(inputs);
    displayMarks(card, subject);
  });

  // Tapping outside the cards hides the delete button again.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.subject-card')) {
      dashboard.querySelectorAll('.touched').forEach((c) => c.classList.remove('touched'));
    }
  });

  congratsButton.addEventListener('click', () => {
    for (let i = 0; i < 4; i++) {
      setTimeout(
        () => confetti(congratsButton, { angle: 90, spread: 70, startVelocity: 70 + i * 10, elementCount: 70 }),
        i * 180
      );
    }
  });
}
