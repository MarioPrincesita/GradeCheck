// App state and persistence.
//
// On Android the data is saved with Capacitor Preferences (native
// SharedPreferences), which survives closing the app and app updates.
// A copy also goes to localStorage, which is what the web version uses.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { normalize, randomInt } from './util.js';

const STORAGE_KEY = 'gradecheck:data';
const DATA_VERSION = 1;
const MAX_LIST = 60;

export const isNative = Capacitor.isNativePlatform();

export const state = {
  subjects: [],
  // Values remembered for the autocomplete, most recently used first.
  lists: { categories: [], faculties: [], unis: [] },
  // Last faculty / university used, to prefill new subjects.
  prefs: { faculty: '', uni: '' },
};

/* ------------------------------ Load / save ------------------------------ */

export async function loadState() {
  let raw = null;
  if (isNative) {
    try {
      raw = (await Preferences.get({ key: STORAGE_KEY })).value;
    } catch (error) {
      console.error('Could not read Preferences', error);
    }
  }
  if (!raw) {
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
  }
  if (raw) {
    try {
      replaceState(JSON.parse(raw));
    } catch (error) {
      console.error('Saved data is corrupted', error);
    }
  }

  // Ask the browser not to delete our data when space is low (web only).
  if (!isNative) navigator.storage?.persist?.().catch(() => {});
}

let nativeWrite = Promise.resolve();

export function saveState() {
  const json = JSON.stringify(serialize());
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    console.error('Could not write localStorage', error);
  }
  if (isNative) {
    // Chain the writes so they always land in order.
    nativeWrite = nativeWrite
      .then(() => Preferences.set({ key: STORAGE_KEY, value: json }))
      .catch((error) => console.error('Could not write Preferences', error));
  }
}

export function serialize() {
  return {
    app: 'GradeCheck',
    version: DATA_VERSION,
    subjects: state.subjects,
    lists: state.lists,
    prefs: state.prefs,
  };
}

/** Replaces the whole state with data from storage or from a backup file. */
export function replaceState(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.subjects)) {
    throw new Error('Formato de datos no válido');
  }
  state.subjects = data.subjects.map(sanitizeSubject).filter(Boolean);
  state.lists = {
    categories: cleanList(data.lists?.categories),
    faculties: cleanList(data.lists?.faculties),
    unis: cleanList(data.lists?.unis),
  };
  state.prefs = {
    faculty: String(data.prefs?.faculty ?? ''),
    uni: String(data.prefs?.uni ?? ''),
  };
}

function cleanList(list) {
  return Array.isArray(list) ? list.map(String).filter(Boolean).slice(0, MAX_LIST) : [];
}

function sanitizeSubject(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.exams) || !Array.isArray(s.evaluations)) {
    return null;
  }
  const evaluations = s.evaluations
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      name: String(e.name ?? ''),
      passMark: Number(e.passMark) || 5,
      weights: Object.fromEntries(
        Object.entries(e.weights ?? {}).map(([k, v]) => [k, Number(v) || 0])
      ),
    }));
  if (!evaluations.length) return null;
  const grades = {};
  for (const [k, v] of Object.entries(s.grades ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) grades[k] = v;
  }
  const selected = Number(s.selectedEvaluation) || 0;
  return {
    id: String(s.id ?? Math.random().toString(36).slice(2)),
    shortName: String(s.shortName ?? ''),
    fullName: String(s.fullName ?? ''),
    term: String(s.term ?? ''),
    year: String(s.year ?? ''),
    faculty: String(s.faculty ?? ''),
    uni: String(s.uni ?? ''),
    color: Number(s.color) >= 1 && Number(s.color) <= 8 ? Number(s.color) : randomInt(1, 8),
    createdAt: Number(s.createdAt) || Date.now(),
    exams: s.exams
      .filter((x) => x && x.name)
      .map((x) => ({ name: String(x.name), type: String(x.type ?? '') })),
    evaluations,
    grades,
    selectedEvaluation: selected < evaluations.length ? selected : 0,
  };
}

/* ------------------------------ Subjects ------------------------------ */

export function getSubject(id) {
  return state.subjects.find((s) => s.id === id);
}

export function upsertSubject(subject) {
  const index = state.subjects.findIndex((s) => s.id === subject.id);
  if (index === -1) state.subjects.push(subject);
  else state.subjects[index] = subject;
  saveState();
}

export function removeSubject(id) {
  const index = state.subjects.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const [removed] = state.subjects.splice(index, 1);
  saveState();
  return { subject: removed, index };
}

export function restoreSubject({ subject, index }) {
  state.subjects.splice(Math.min(index, state.subjects.length), 0, subject);
  saveState();
}

export function setGrade(subject, examName, grade) {
  if (grade === undefined) delete subject.grades[examName];
  else subject.grades[examName] = grade;
  saveState();
}

/* ------------------------------ Remembered values ------------------------------ */

/** Moves (or adds) values to the front of a remembered list. Call saveState() after. */
export function remember(listName, values) {
  const list = state.lists[listName];
  for (const value of [].concat(values).reverse()) {
    const clean = String(value ?? '').trim();
    if (!clean) continue;
    const key = normalize(clean);
    const existing = list.findIndex((v) => normalize(v) === key);
    if (existing !== -1) list.splice(existing, 1);
    list.unshift(clean);
  }
  list.length = Math.min(list.length, MAX_LIST);
}

export function forget(listName, value) {
  const key = normalize(value);
  state.lists[listName] = state.lists[listName].filter((v) => normalize(v) !== key);
  saveState();
}
