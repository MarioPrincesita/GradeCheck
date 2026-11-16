// Confetti, adapted from dom-confetti by Daniel Lundin (MIT)
// https://github.com/daniel-lundin/dom-confetti, as bundled in GradeCalc.

import { randomInt } from './util.js';

const COLORS = [
  '#E68F17',
  '#FAB005',
  '#FA5252',
  '#E64980',
  '#BE4BDB',
  '#0B7285',
  '#15AABF',
  '#EE1233',
  '#40C057',
];

function shape(element) {
  const size = Math.round((Math.random() + 0.5) * 10);
  const kind = Math.floor(Math.random() * 3);
  if (kind === 2) {
    const color = element.style.backgroundColor;
    element.style.backgroundColor = 'transparent';
    element.style.borderBottom = `${size}px solid ${color}`;
    element.style.borderLeft = `${size / 2}px solid transparent`;
    element.style.borderRight = `${size / 2}px solid transparent`;
    element.style.height = '0';
    element.style.width = '0';
  } else {
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    if (kind === 1) element.style.borderRadius = '50%';
  }
  return element;
}

function randomPhysics(angle, spread, startVelocity) {
  const radAngle = angle * (Math.PI / 180);
  const radSpread = spread * (Math.PI / 180);
  return {
    x: 0,
    y: 0,
    wobble: Math.random() * 10,
    velocity: startVelocity * 0.5 + Math.random() * startVelocity,
    angle2D: -radAngle + (0.5 * radSpread - Math.random() * radSpread),
    tiltAngle: Math.random() * Math.PI,
  };
}

function update(fetti, progress, decay) {
  const p = fetti.physics;
  p.x += Math.cos(p.angle2D) * p.velocity;
  p.y += Math.sin(p.angle2D) * p.velocity;
  p.wobble += 0.1;
  p.velocity *= decay;
  p.y += 3;
  p.tiltAngle += 0.1;
  const wobbleX = p.x + 10 * Math.cos(p.wobble);
  const wobbleY = p.y + 10 * Math.sin(p.wobble);
  fetti.element.style.transform = `translate3d(${wobbleX}px, ${wobbleY}px, 0) rotate3d(1, 1, 1, ${p.tiltAngle}rad)`;
  fetti.element.style.opacity = String(1 - progress);
}

/** Shoots confetti from the bottom-left corner of `root` (like GradeCalc). */
export function confetti(root, options = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const {
    angle = randomInt(60, 70),
    spread = randomInt(40, 50),
    startVelocity = randomInt(60, 90),
    elementCount = randomInt(30, 60),
    decay = 0.8,
  } = options;

  const fettis = Array.from({ length: elementCount }, (_, i) => {
    const element = document.createElement('div');
    element.style.backgroundColor = COLORS[i % COLORS.length];
    element.style.position = 'absolute';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '4';
    root.appendChild(shape(element));
    return { element, physics: randomPhysics(angle, spread, startVelocity) };
  });

  const totalTicks = 200;
  let tick = 0;
  function frame() {
    fettis.forEach((f) => update(f, tick / totalTicks, decay));
    tick += 1;
    if (tick < totalTicks) requestAnimationFrame(frame);
    else fettis.forEach((f) => f.element.remove());
  }
  requestAnimationFrame(frame);
}
