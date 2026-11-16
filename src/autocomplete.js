// Suggestions dropdown for text inputs with a `data-ac="<source>"` attribute.
//
// The dropdown is `position: fixed` and lives in <body>, so it is never cut
// by scrolling containers (like the evaluation grid).

import { esc, normalize } from './util.js';

const MAX_ITEMS = 8;

let dropdown = null;
let current = null; // { input, source, items, active }
let sources = {};

/**
 * sources: {
 *   [name]: {
 *     options(input) -> [{ value, removable }],   // most relevant first
 *     onPick?(input, value),
 *     onForget?(value),
 *   }
 * }
 */
export function setupAutocomplete(container, newSources) {
  sources = { ...sources, ...newSources };

  container.addEventListener('focusin', (event) => {
    if (event.target.dataset?.ac) open(event.target);
  });
  container.addEventListener('input', (event) => {
    if (event.target.dataset?.ac) open(event.target);
  });
  container.addEventListener('focusout', (event) => {
    if (current?.input === event.target) close();
  });
  container.addEventListener('keydown', onKeyDown);
  // Scroll events don't bubble, but a capturing listener sees all of them.
  document.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);
}

function getDropdown() {
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'ac-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.display = 'none';
    // Keep the focus in the input while tapping a suggestion.
    dropdown.addEventListener('pointerdown', (event) => event.preventDefault());
    dropdown.addEventListener('mousedown', (event) => event.preventDefault());
    dropdown.addEventListener('click', onDropdownClick);
    document.body.appendChild(dropdown);
  }
  return dropdown;
}

function filterOptions(input, source) {
  const query = normalize(input.value);
  const seen = new Set();
  const result = [];
  for (const option of source.options(input)) {
    const key = normalize(option.value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (key === query) continue; // already written
    if (query && !key.includes(query)) continue;
    result.push({ ...option, starts: key.startsWith(query) });
  }
  // Options that start with what you typed go first; otherwise keep the order.
  if (query) result.sort((a, b) => Number(b.starts) - Number(a.starts));
  return result.slice(0, MAX_ITEMS);
}

function open(input) {
  const source = sources[input.dataset.ac];
  if (!source) return;
  const items = filterOptions(input, source);
  current = { input, source, items, active: -1 };
  render();
}

function close() {
  current = null;
  if (dropdown) dropdown.style.display = 'none';
}

function highlight(value, query) {
  const q = normalize(query);
  if (!q) return esc(value);
  const index = normalize(value).indexOf(q);
  // normalize() keeps the length for Latin letters, so indexes match.
  if (index === -1 || normalize(value).length !== value.trim().length) return esc(value);
  const v = value.trim();
  return `${esc(v.slice(0, index))}<b>${esc(v.slice(index, index + q.length))}</b>${esc(
    v.slice(index + q.length)
  )}`;
}

function render() {
  const box = getDropdown();
  if (!current || current.items.length === 0) {
    box.style.display = 'none';
    return;
  }
  box.innerHTML = current.items
    .map(
      (item, i) => `<div class="ac-item${i === current.active ? ' active' : ''}" role="option" data-index="${i}">
        <span>${highlight(item.value, current.input.value)}</span>
        ${
          item.removable
            ? `<button type="button" class="ac-forget" data-forget="${i}" aria-label="Olvidar ${esc(
                item.value
              )}">×</button>`
            : ''
        }
      </div>`
    )
    .join('');
  box.style.display = 'block';
  reposition();
}

function reposition() {
  if (!current || !dropdown || dropdown.style.display === 'none') return;
  if (!document.body.contains(current.input)) return close();
  const rect = current.input.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const viewportTop = window.visualViewport?.offsetTop ?? 0;
  const width = Math.max(rect.width, 160);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  dropdown.style.width = `${width}px`;
  dropdown.style.left = `${left}px`;

  const spaceBelow = viewportTop + viewportHeight - rect.bottom - 8;
  const spaceAbove = rect.top - viewportTop - 8;
  const wanted = Math.min(dropdown.scrollHeight, 224);
  if (spaceBelow >= Math.min(wanted, 120) || spaceBelow >= spaceAbove) {
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.bottom = '';
    dropdown.style.maxHeight = `${Math.max(80, Math.min(224, spaceBelow))}px`;
  } else {
    dropdown.style.top = '';
    dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    dropdown.style.maxHeight = `${Math.max(80, Math.min(224, spaceAbove))}px`;
  }
}

function pick(index) {
  if (!current) return;
  const item = current.items[index];
  if (!item) return;
  const { input, source } = current;
  input.value = item.value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  source.onPick?.(input, item.value);
  close();
}

function onDropdownClick(event) {
  if (!current) return;
  const forget = event.target.closest('[data-forget]');
  if (forget) {
    const item = current.items[Number(forget.dataset.forget)];
    current.source.onForget?.(item.value);
    open(current.input);
    return;
  }
  const row = event.target.closest('[data-index]');
  if (row) pick(Number(row.dataset.index));
}

function onKeyDown(event) {
  if (!current || current.input !== event.target || current.items.length === 0) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const n = current.items.length;
    current.active = (current.active + (event.key === 'ArrowDown' ? 1 : -1) + n) % n;
    render();
  } else if (event.key === 'Enter' && current.active >= 0) {
    event.preventDefault();
    pick(current.active);
  } else if (event.key === 'Escape') {
    close();
  }
}

export function closeAutocomplete() {
  close();
}
