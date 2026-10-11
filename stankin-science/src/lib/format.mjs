// Форматирование чисел, долей, дат и названий стран для русского и английского языков.
// Модуль без зависимостей от Node — его подключают и сборка, и браузер.

const LOCALES = { ru: 'ru-RU', en: 'en-GB' };
const cache = new Map();

function nf(lang, options) {
  const key = `${lang}|${JSON.stringify(options)}`;
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(LOCALES[lang] ?? lang, options));
  return cache.get(key);
}

export const DASH = '—';
const MINUS = '−';

const fixSign = (s) => s.replace(/^-/, MINUS);

export function int(lang, value) {
  if (value == null || !Number.isFinite(value)) return DASH;
  return fixSign(nf(lang, { maximumFractionDigits: 0 }).format(value));
}

export function dec(lang, value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return DASH;
  return fixSign(nf(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value));
}

// Компактная запись больших чисел: 12,9 тыс. / 12.9K.
export function compact(lang, value) {
  if (value == null || !Number.isFinite(value)) return DASH;
  if (Math.abs(value) < 10000) return int(lang, value);
  return fixSign(nf(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(value));
}

// Доля (0..1) в процентах: 0,239 → «23,9 %».
export function pct(lang, value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return DASH;
  return fixSign(nf(lang, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value));
}

// Маленькая доля (доля в мировом потоке): значащие цифры подбираются по величине.
export function share(lang, value) {
  if (value == null || !Number.isFinite(value)) return DASH;
  const p = value * 100;
  const digits = p >= 10 ? 1 : p >= 1 ? 2 : p >= 0.1 ? 2 : 3;
  return pct(lang, value, digits);
}

// Изменение: 1,56 → «+56 %», 0,8 → «−20 %».
export function change(lang, ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return DASH;
  const d = ratio - 1;
  const s = pct(lang, Math.abs(d), Math.abs(d) < 0.1 ? 1 : 0);
  return d >= 0 ? `+${s}` : `${MINUS}${s}`;
}

// «в 1,6 раза» / «1.6 times» — для текста.
export function times(lang, ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return DASH;
  return dec(lang, ratio, ratio >= 10 ? 0 : 1);
}

export function date(lang, iso) {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat(LOCALES[lang] ?? lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

const regionNames = new Map();
export function country(lang, code) {
  if (!code) return DASH;
  const c = String(code).toUpperCase();
  if (!regionNames.has(lang)) {
    try {
      regionNames.set(lang, new Intl.DisplayNames([LOCALES[lang] ?? lang], { type: 'region' }));
    } catch {
      regionNames.set(lang, null);
    }
  }
  const dn = regionNames.get(lang);
  try {
    const name = dn?.of(c);
    if (name && name !== c) return name;
  } catch {
    // неизвестный код — вернём как есть
  }
  return c;
}

// Склонение для русского: plural('ru', 5, ['публикация', 'публикации', 'публикаций']).
const rules = new Map();
export function plural(lang, n, forms) {
  if (lang !== 'ru') return Math.abs(n) === 1 ? forms[0] : forms[forms.length - 1];
  if (!rules.has(lang)) rules.set(lang, new Intl.PluralRules('ru-RU'));
  const r = rules.get(lang).select(Math.round(Math.abs(n)));
  return r === 'one' ? forms[0] : r === 'few' ? forms[1] : forms[2];
}
