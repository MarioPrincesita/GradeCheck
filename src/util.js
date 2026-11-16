// Small helpers shared by every module.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text before putting it inside innerHTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Lowercase, no accents, trimmed: used to compare and search names. */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Rounds to `d` decimals. Returns undefined for empty or invalid numbers. */
export function round(n, d = 2) {
  if (n === '' || n === null || n === undefined || Number.isNaN(Number(n))) return undefined;
  const f = 10 ** d;
  return Math.round(Number(n) * f) / f;
}

/** Rounds up to 2 decimals, so the "needed" mark always reaches the pass mark. */
export function ceil2(n) {
  return Math.ceil(n * 100 - 1e-7) / 100;
}

export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Creates a DOM element from an HTML string. */
export function html(str) {
  const template = document.createElement('template');
  template.innerHTML = str.trim();
  return template.content.firstElementChild;
}

/** Formats a mark like the original app: 2 decimals max, no trailing zeros. */
export function fmt(n) {
  const r = round(n);
  return r === undefined ? '' : String(r);
}

/**
 * Academic year and term for a date. The academic year starts in August:
 * Aug–Jan is Q1, Feb–Jul is Q2.
 */
export function academicDefaults(date = new Date()) {
  const month = date.getMonth(); // 0 = January
  const year = date.getFullYear();
  const startYear = month >= 7 ? year : year - 1;
  const term = month >= 7 || month === 0 ? 'Q1' : 'Q2';
  return { term, year: yearLabel(startYear) };
}

/** 2025 -> "2025-26" */
export function yearLabel(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** List of academic years to choose from, newest first. */
export function yearOptions(date = new Date(), extra = []) {
  const current = Number(academicDefaults(date).year.slice(0, 4));
  const years = new Set(extra.filter(Boolean));
  for (let y = current + 1; y >= current - 6; y--) years.add(yearLabel(y));
  return [...years].sort().reverse();
}
