// Каркас страницы: <head>, шапка с навигацией и переключателем языка, подвал.

import { esc, rel, langPrefix } from './kit.mjs';
import { LANGS } from '../../content/i18n.mjs';

const NAV = [
  ['home', ''],
  ['decisions', 'decisions/'],
  ['competencies', 'competencies/'],
  ['trends', 'trends/'],
  ['collaboration', 'collaboration/'],
  ['method', 'method/'],
];

const LOGO = {
  ru: { src: 'assets/img/stankin-official-white.svg', w: 150, h: 45 },
  en: { src: 'assets/img/stankin-official-white-en.svg', w: 140, h: 45 },
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

export function layout(ctx, { title, description, body, routeKey, routePath, demo = false }) {
  const { t, lang } = ctx;
  const navCurrent = routeKey === 'competency' ? 'competencies' : routeKey;
  const fullTitle = routeKey === 'home' ? t.site.full : `${title} — ${t.site.full}`;
  const logo = LOGO[lang] ?? LOGO.ru;
  const nav = NAV.map(([key, path]) => {
    const current = key === navCurrent ? (routeKey === key ? ' aria-current="page"' : ' aria-current="true"') : '';
    return `<a href="${esc(ctx.page(path))}"${current}>${esc(t.nav[key])}</a>`;
  }).join('');
  const langLinks = routePath == null ? '' : LANGS.map((l) => {
    const href = rel(ctx.pageDir, langPrefix(l) + routePath);
    const current = l === lang ? ' aria-current="true"' : '';
    return `<a href="${esc(href)}" hreflang="${l}" lang="${l}"${current}>${l.toUpperCase()}</a>`;
  }).join('');
  const alternates = routePath == null ? '' : LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(rel(ctx.pageDir, langPrefix(l) + routePath))}">`).join('');
  const robots = ctx.site.noindex ? '<meta name="robots" content="noindex, nofollow">' : '';
  const asOf = ctx.model.meta.fetchedAt ? t.ui.dataAsOf(ctx.date(ctx.model.meta.fetchedAt)) : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description ?? t.site.description)}">
${robots}
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#252420">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description ?? t.site.description)}">
<link rel="icon" href="${esc(ctx.asset('assets/img/favicon.svg'))}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${esc(ctx.asset('assets/img/apple-touch-icon.png'))}">
${alternates}
<link rel="preload" href="${esc(ctx.asset(`assets/fonts/golos-text-variable-${lang === 'ru' ? 'cyrillic' : 'latin'}.woff2`))}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${esc(ctx.asset('assets/css/site.css'))}">
<script type="module" src="${esc(ctx.asset('assets/js/site.mjs'))}"></script>
</head>
<body class="page-${esc(routeKey)}">
<a class="skip" href="#main">${esc(t.ui.skip)}</a>
${demo ? `<div class="demo-banner" role="note"><span class="demo-icon" aria-hidden="true">!</span>${esc(t.ui.demo)}</div>` : ''}
<header class="header">
  <div class="header-in">
    <a class="brand" href="${esc(ctx.page(''))}">
      <img class="logo" src="${esc(ctx.asset(logo.src))}" alt="${esc(t.site.university)}" width="${logo.w}" height="${logo.h}">
      <span class="brand-sub">${esc(t.site.name)}</span>
    </a>
    <button class="menu-toggle" type="button" aria-controls="site-nav" aria-expanded="false" data-open-label="${esc(t.ui.menuOpen)}" data-close-label="${esc(t.ui.menuClose)}">
      <span class="menu-bars" aria-hidden="true"></span><span class="visually-hidden">${esc(t.ui.menuOpen)}</span>
    </button>
    <nav class="nav" id="site-nav" aria-label="${esc(t.site.name)}">
      ${nav}
      ${langLinks ? `<span class="lang-switch" role="group" aria-label="${esc(t.ui.language)}">${langLinks}</span>` : ''}
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="footer">
  <div class="footer-in">
    <div class="footer-about">
      <p class="footer-title">${esc(t.site.name)}<span>${esc(t.site.university)}</span></p>
      <p>${esc(t.footer.about)}</p>
      <p class="footer-meta">${esc([asOf, ctx.site.noindex ? t.ui.draft : ''].filter(Boolean).join(' · '))}</p>
    </div>
    <div>
      <p class="footer-label">${esc(t.footer.sections)}</p>
      ${NAV.map(([key, path]) => `<a href="${esc(ctx.page(path))}">${esc(t.nav[key])}</a>`).join('')}
    </div>
    <div>
      <p class="footer-label">${esc(t.footer.links)}</p>
      <a href="${esc(ctx.site.universityUrl[lang] ?? ctx.site.universityUrl.ru)}" rel="noopener">${esc(t.footer.university)}</a>
      <a href="${esc(ctx.site.campusUrl)}${lang === 'ru' ? '' : `${lang}/`}" rel="noopener">${esc(t.footer.campus)}</a>
      <a href="${esc(ctx.site.repoUrl)}" rel="noopener">${esc(t.footer.code)}</a>
    </div>
  </div>
</footer>
</body>
</html>
`;
}
