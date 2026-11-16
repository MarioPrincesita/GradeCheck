// Grade math. Pure functions, no DOM, so they can be tested with `npm test`.
//
// A subject looks like:
// {
//   exams: [{ name: 'Ex1', type: 'Exam' }, ...],          // rows, in order
//   evaluations: [{ name: 'Continua', passMark: 5,
//                   weights: { Ex1: 0.15, ... } }, ...],   // weights from 0 to 1
//   grades: { Ex1: 7.5 },                                  // only exams already done
//   selectedEvaluation: 0,
// }

import { ceil2, isNumber, round } from './util.js';

export const MAX_GRADE = 10;
export const DEFAULT_PASS_MARK = 5;

/** Exams that count in an evaluation (weight > 0), with their weight. */
export function evaluationItems(subject, evalIndex = subject.selectedEvaluation ?? 0) {
  const evaluation = subject.evaluations[evalIndex] ?? subject.evaluations[0];
  if (!evaluation) return [];
  return subject.exams
    .map((exam) => ({ ...exam, weight: Number(evaluation.weights[exam.name]) || 0 }))
    .filter((item) => item.weight > 0);
}

/**
 * Final mark so far, whether it is already passed, and the mark needed in each
 * pending exam (the same for all of them, like GradeCalc). `null` means it is
 * impossible to pass.
 */
export function computeEvaluation(subject, evalIndex = subject.selectedEvaluation ?? 0) {
  const evaluation = subject.evaluations[evalIndex] ?? subject.evaluations[0];
  const passMark = evaluation?.passMark ?? DEFAULT_PASS_MARK;
  const items = evaluationItems(subject, evalIndex);

  let current = 0;
  let pendingWeight = 0;
  for (const item of items) {
    const grade = subject.grades[item.name];
    if (isNumber(grade)) current += grade * item.weight;
    else pendingWeight += item.weight;
  }

  const needed = {};
  if (pendingWeight > 0) {
    const raw = (passMark - current) / pendingWeight;
    const value = raw > MAX_GRADE + 1e-9 ? null : Math.max(0, ceil2(raw));
    for (const item of items) {
      if (!isNumber(subject.grades[item.name])) needed[item.name] = value;
    }
  }

  return {
    items,
    passMark,
    finalMark: round(current) ?? 0,
    passed: items.length > 0 && current >= passMark - 1e-9,
    needed,
  };
}

/** Groups the items by category keeping the order in which they first appear. */
export function groupByType(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.type)) groups.set(item.type, { type: item.type, weight: 0, items: [] });
    const group = groups.get(item.type);
    group.weight += item.weight;
    group.items.push(item);
  }
  return [...groups.values()];
}

/** Sum of the weights of an evaluation, in % (100 = complete). */
export function totalPercent(evaluation) {
  const sum = Object.values(evaluation.weights).reduce((acc, w) => acc + (Number(w) || 0), 0);
  return round(sum * 100, 4);
}
