import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeEvaluation, groupByType, totalPercent } from '../src/grades.js';
import { academicDefaults, yearLabel } from '../src/util.js';

// The subject from the screenshot: Virtual Reality.
const vr = () => ({
  exams: [
    { name: 'Ex1', type: 'Exam' },
    { name: 'Ex2', type: 'Exam' },
    { name: 'Pres', type: 'Presentation' },
    { name: 'Lab1', type: 'Labs' },
    { name: 'Lab2', type: 'Labs' },
    { name: 'Lab3', type: 'Labs' },
    { name: 'Att', type: 'Attitude' },
  ],
  evaluations: [
    {
      name: 'Continua',
      passMark: 5,
      weights: { Ex1: 0.15, Ex2: 0.2, Pres: 0.1, Lab1: 0.1, Lab2: 0.15, Lab3: 0.2, Att: 0.1 },
    },
  ],
  grades: {},
  selectedEvaluation: 0,
});

test('without grades you need a 5 everywhere', () => {
  const r = computeEvaluation(vr());
  assert.equal(r.finalMark, 0);
  assert.equal(r.passed, false);
  assert.deepEqual(new Set(Object.values(r.needed)), new Set([5]));
});

test('needed mark is spread over the pending exams and rounded up', () => {
  const s = vr();
  s.grades = { Ex1: 4, Lab1: 8 }; // 0.6 + 0.8 = 1.4
  const r = computeEvaluation(s);
  assert.equal(r.finalMark, 1.4);
  // (5 - 1.4) / 0.75 = 4.8
  assert.equal(r.needed.Ex2, 4.8);
  assert.equal(r.needed.Ex1, undefined);

  s.grades = { Ex1: 3 }; // 0.45 -> (5 - 0.45) / 0.85 = 5.3529... -> 5.36
  assert.equal(computeEvaluation(s).needed.Att, 5.36);
});

test('passed once the done exams already reach the pass mark', () => {
  const s = vr();
  s.grades = { Ex1: 10, Ex2: 10, Lab3: 5 }; // 1.5 + 2 + 1 = 4.5
  assert.equal(computeEvaluation(s).passed, false);
  s.grades.Pres = 5; // + 0.5 = 5
  const r = computeEvaluation(s);
  assert.equal(r.passed, true);
  assert.equal(r.needed.Att, 0);
});

test('impossible to pass gives null', () => {
  const s = vr();
  s.grades = { Ex1: 0, Ex2: 0, Lab1: 0, Lab2: 0, Lab3: 0 }; // 0.8 left
  assert.equal(computeEvaluation(s).needed.Att, null);
});

test('alternative evaluation only counts its own exams', () => {
  const s = vr();
  s.evaluations.push({ name: 'Final', passMark: 5, weights: { Ex2: 1 } });
  s.selectedEvaluation = 1;
  s.grades = { Ex1: 2, Ex2: 6 };
  const r = computeEvaluation(s);
  assert.equal(r.items.length, 1);
  assert.equal(r.finalMark, 6);
  assert.equal(r.passed, true);
});

test('groups by category in order of appearance', () => {
  const groups = groupByType(computeEvaluation(vr()).items);
  assert.deepEqual(
    groups.map((g) => g.type),
    ['Exam', 'Presentation', 'Labs', 'Attitude']
  );
  assert.equal(Math.round(groups[2].weight * 100), 45);
  assert.equal(totalPercent(vr().evaluations[0]), 100);
});

test('academic year and term from the date', () => {
  assert.deepEqual(academicDefaults(new Date(2026, 10, 16)), { term: 'Q1', year: '2026-27' });
  assert.deepEqual(academicDefaults(new Date(2027, 0, 20)), { term: 'Q1', year: '2026-27' });
  assert.deepEqual(academicDefaults(new Date(2027, 2, 3)), { term: 'Q2', year: '2026-27' });
  assert.deepEqual(academicDefaults(new Date(2026, 7, 30)), { term: 'Q1', year: '2026-27' });
  assert.equal(yearLabel(2099), '2099-00');
});
