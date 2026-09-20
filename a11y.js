/* Версия для слабовидящих: переключатель, панель настроек, сохранение выбора (localStorage «vi»).
   Класс html.vi и атрибуты data-vi-* выставляются также встроенным скриптом в <head>, чтобы страница
   сразу открывалась в выбранном режиме без мигания. */
import {T} from './i18n.js';
const KEY = 'vi';
const DEFAULTS = {on: false, size: '1', theme: 'bw', images: 'on', spacing: '0'};
/* Подписи — из dist/i18n.js по языку страницы; значения настроек от языка не зависят. */
const OPTIONS = {
  size: ['1', '2', '3'].map((value, i) => [value, 'A', T.viSize[i]]),
  theme: ['bw', 'wb', 'bb'].map((value, i) => [value, T.viTheme[i], '']),
  images: ['on', 'gray', 'off'].map((value, i) => [value, T.viImages[i], '']),
  spacing: ['0', '1', '2'].map((value, i) => [value, T.viSpacing[i], '']),
};
const LABELS = T.viGroups;
const root = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const load = () => { try { return {...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}')}; } catch (e) { return {...DEFAULTS}; } };
let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

function buildPanel() {
  const panel = document.createElement('section');
  panel.className = 'vi-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', T.viPanel);
  panel.innerHTML = Object.keys(OPTIONS).map((key) =>
    `<div class="vi-group" role="group" aria-label="${LABELS[key]}"><span class="vi-label">${LABELS[key]}</span>` +
    OPTIONS[key].map(([value, text, title]) => `<button type="button" data-vi="${key}" data-value="${value}" aria-pressed="false"${title ? ` aria-label="${title}"` : ''}>${text}</button>`).join('') +
    '</div>').join('') +
    `<div class="vi-group"><button type="button" data-vi="reset">${T.viReset}</button><button type="button" data-vi="off">${T.viOff}</button></div>`;
  panel.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-vi]');
    if (!button) return;
    const key = button.dataset.vi;
    if (key === 'reset') state = {...DEFAULTS, on: true};
    else if (key === 'off') state.on = false;
    else state[key] = button.dataset.value;
    save(); apply();
    if (key === 'off') $('.vi-toggle')?.focus();
  });
  return panel;
}

function ensurePanel() {
  if ($('.vi-panel')) return;
  const header = $('.header');
  header ? header.before(buildPanel()) : document.body.prepend(buildPanel());
}

function addAltTexts() {
  $$('main img:not(.icon):not([data-vi-alt])').forEach((img) => {
    img.dataset.viAlt = '1';
    const figure = img.closest('figure');
    if (!img.alt || (figure && figure.querySelector('figcaption'))) return;
    const note = document.createElement('span');
    note.className = 'vi-alt';
    note.textContent = T.viImage + img.alt;
    img.insertAdjacentElement('afterend', note);
  });
}

function apply() {
  root.classList.toggle('vi', state.on);
  Object.keys(OPTIONS).forEach((key) => root.setAttribute('data-vi-' + key, state[key]));
  $$('.vi-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(state.on));
    const text = button.querySelector('span');
    if (text) text.textContent = state.on ? T.viOff : T.viOn;
  });
  if (!state.on) { $('.vi-panel')?.remove(); return; }
  ensurePanel();
  $$('.vi-panel button[data-value]').forEach((button) => button.setAttribute('aria-pressed', String(state[button.dataset.vi] === button.dataset.value)));
  if (state.images === 'off') addAltTexts();
}

$$('.vi-toggle').forEach((button) => button.addEventListener('click', () => {
  state.on = !state.on;
  save(); apply();
  if (state.on) { window.scrollTo({top: 0, behavior: 'auto'}); $('.vi-panel button')?.focus(); }
}));
apply();
