// Toast, popups and the tiny hash router (the browser/Android back button
// closes popups, like in GradeCalc).

import { esc } from './util.js';

/* ------------------------------ Toast ------------------------------ */

const toast = document.getElementById('toast');
let toastTimer = 0;

/**
 * Shows a message at the bottom. `action` is an optional
 * { label, onClick } button (for example "Deshacer").
 */
export function showToast(message, action, time = 8000) {
  toast.style.display = 'none';
  toast.style.animation = `goUp 500ms cubic-bezier(0.215, 0.61, 0.355, 1), fadeOut ${Math.max(
    0,
    time - 3000
  )}ms 2.5s cubic-bezier(1, 0, 1, 1), opaque 2.5s`;
  void toast.offsetHeight; // restart the animation
  toast.style.display = 'flex';

  const box = toast.firstElementChild;
  box.innerHTML = `<p>${message}</p>`;
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      hideToast();
      action.onClick();
    });
    box.appendChild(button);
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, time);
}

export function hideToast() {
  clearTimeout(toastTimer);
  toast.style.display = 'none';
}

/** Escapes text for a toast message (toasts accept <b> tags). */
export const t = esc;

/* ------------------------------ Popups ------------------------------ */

const topbar = document.getElementById('top-bar');
const screen = document.querySelector('.screen');
const POPUPS = ['editor-container', 'settings-container'];
let savedScroll = 0;

const fades = new Map(); // popup element -> its current fade animation

/**
 * Fades a popup and runs `done` at the end. Starting a new fade cancels the
 * previous one, so closing and reopening quickly can't leave a stale callback.
 * The timeout covers the case where animations are paused (app in background).
 */
function fade(elem, from, to, done) {
  fades.get(elem)?.cancel();
  const animation = elem.animate({ opacity: [from, to] }, { duration: 125, easing: 'ease-in' });
  fades.set(elem, animation);
  const finish = () => {
    if (fades.get(elem) !== animation) return;
    fades.delete(elem);
    done();
  };
  animation.onfinish = finish;
  setTimeout(finish, 300);
}

export function popupShow(id) {
  const elem = document.getElementById(id);
  const isSmall = elem.classList.contains('popup-small');
  POPUPS.filter((p) => p !== id).forEach((p) => popupHide(p));
  if (elem.dataset.state === 'open') return;
  elem.dataset.state = 'open';

  if (screen.style.display !== 'none') savedScroll = window.scrollY;
  elem.style.display = 'flex';
  fade(elem, 0, 1, () => {
    // On phones, big popups are full screen: hide what is behind.
    if (!isSmall && window.matchMedia('(max-width: 600px)').matches) {
      screen.style.display = 'none';
      topbar.style.display = 'none';
      window.scrollTo(0, 0);
    }
  });
}

export function popupHide(id) {
  const elem = document.getElementById(id);
  if (elem.dataset.state !== 'open') return;
  elem.dataset.state = 'closed';
  const wasHidingScreen = screen.style.display === 'none';
  screen.style.display = '';
  topbar.style.display = '';
  if (wasHidingScreen) window.scrollTo(0, savedScroll);
  fade(elem, 1, 0, () => {
    elem.style.display = 'none';
  });
}

/* ------------------------------ Router ------------------------------ */
// #/nueva           -> new subject
// #/editar/<id>     -> edit subject
// #/ajustes         -> settings
// (empty)           -> dashboard

const routes = [];
let leaveGuard = null;
let currentHash = '';

export function route(pattern, handler) {
  routes.push({ pattern, handler });
}

/** A function that returns false to cancel leaving the current popup. */
export function setLeaveGuard(fn) {
  leaveGuard = fn;
}

export function navigate(hash) {
  if (location.hash === hash) resolve();
  else location.hash = hash;
}

/** Closes the current popup going back in history. */
export function goBack() {
  if (location.hash && location.hash !== '#') history.back();
  else resolve();
}

function resolve() {
  const hash = location.hash.replace(/^#/, '');
  if (leaveGuard && hash !== currentHash && !leaveGuard()) {
    // Stay: put the popup back in the history without re-rendering it.
    history.pushState(null, '', `#${currentHash}`);
    return;
  }
  currentHash = hash;
  for (const { pattern, handler } of routes) {
    const match = hash.match(pattern);
    if (match) {
      handler(...match.slice(1).map(decodeURIComponent));
      return;
    }
  }
}

export function startRouter() {
  // Always start on the dashboard.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.addEventListener('hashchange', resolve);
  resolve();
}

export function hasOpenPopup() {
  return Boolean(location.hash && location.hash !== '#');
}
