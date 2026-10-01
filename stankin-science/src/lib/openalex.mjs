// Небольшой клиент OpenAlex API без зависимостей: ключ, повторы с паузой, ограничение
// параллельности, учёт запросов, курсорная выдача списков и group_by.
//
// С февраля 2026 года OpenAlex требует API-ключ (бесплатный, openalex.org/settings/api).
// Без ключа доступно около 10 запросов-списков в сутки, чего для выгрузки не хватает.

const DEFAULT_BASE = 'https://api.openalex.org';
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
// Стоимость запросов в кредитах OpenAlex (по документации 2026 года): одиночная запись — 1,
// список и group_by — 10. Используется только для оценки расхода в журнале.
const COST = { single: 1, list: 10 };

export class OpenAlexError extends Error {
  constructor(message, { status, url } = {}) {
    super(message);
    this.name = 'OpenAlexError';
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Короткий идентификатор из полного адреса: https://openalex.org/T10001 → T10001,
// https://openalex.org/subfields/2209 → 2209, https://openalex.org/countries/RU → RU.
export function shortId(value) {
  if (value == null) return null;
  const s = String(value);
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export class OpenAlex {
  constructor({
    apiKey = '',
    base = DEFAULT_BASE,
    concurrency = 4,
    maxRequests = 5000,
    retries = 6,
    timeoutMs = 90_000,
    userAgent = 'stankin-science (+https://github.com/peretyaginmstu-jpg/stankin-science)',
    log = () => {},
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.apiKey = apiKey;
    this.base = base.replace(/\/$/, '');
    this.concurrency = Math.max(1, concurrency);
    this.maxRequests = maxRequests;
    this.retries = retries;
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
    this.log = log;
    this.fetch = fetchImpl;
    this.stats = { requests: 0, retries: 0, credits: 0 };
    this.active = 0;
    this.queue = [];
  }

  // Семафор: не больше `concurrency` запросов одновременно.
  async slot() {
    if (this.active < this.concurrency) {
      this.active += 1;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
    this.active += 1;
  }

  release() {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  url(path, params = {}) {
    const u = new URL(this.base + path);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      u.searchParams.set(k, String(v));
    }
    if (this.apiKey) u.searchParams.set('api_key', this.apiKey);
    return u;
  }

  // Адрес для журнала: без ключа.
  static redact(u) {
    const copy = new URL(u);
    if (copy.searchParams.has('api_key')) copy.searchParams.set('api_key', '***');
    return decodeURIComponent(copy.toString());
  }

  async get(path, params = {}, { kind = 'list' } = {}) {
    if (this.stats.requests >= this.maxRequests) {
      throw new OpenAlexError(`Превышен лимит запросов (${this.maxRequests}) — проверьте настройки выгрузки`);
    }
    const u = this.url(path, params);
    const shown = OpenAlex.redact(u);
    await this.slot();
    try {
      for (let attempt = 0; ; attempt += 1) {
        this.stats.requests += 1;
        let res;
        try {
          res = await this.fetch(u, {
            headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
            signal: AbortSignal.timeout(this.timeoutMs),
          });
        } catch (err) {
          if (attempt >= this.retries) {
            throw new OpenAlexError(`Сеть: ${err.message} (${shown})`, { url: shown });
          }
          await this.backoff(attempt, null, shown, err.message);
          continue;
        }
        if (res.ok) {
          this.stats.credits += COST[kind] ?? COST.list;
          try {
            return await res.json();
          } catch (err) {
            if (attempt >= this.retries) {
              throw new OpenAlexError(`Ответ не JSON: ${err.message} (${shown})`, { url: shown, status: res.status });
            }
            await this.backoff(attempt, null, shown, 'invalid JSON');
            continue;
          }
        }
        const body = await res.text().catch(() => '');
        const brief = body.replace(/\s+/g, ' ').slice(0, 300);
        if (res.status === 401 || res.status === 403 || res.status === 409) {
          throw new OpenAlexError(
            `OpenAlex отказал в доступе (HTTP ${res.status}). Нужен действующий API-ключ с запасом кредитов: ` +
              `переменная OPENALEX_API_KEY (в GitHub — секрет репозитория). Ответ: ${brief}`,
            { status: res.status, url: shown },
          );
        }
        if (RETRY_STATUS.has(res.status) && attempt < this.retries) {
          await this.backoff(attempt, res.headers.get('retry-after'), shown, `HTTP ${res.status}`);
          continue;
        }
        throw new OpenAlexError(`HTTP ${res.status}: ${brief} (${shown})`, { status: res.status, url: shown });
      }
    } finally {
      this.release();
    }
  }

  async backoff(attempt, retryAfter, shown, reason) {
    this.stats.retries += 1;
    const fromHeader = Number(retryAfter);
    const ms = Number.isFinite(fromHeader) && fromHeader > 0
      ? Math.min(fromHeader * 1000, 120_000)
      : Math.min(1000 * 2 ** attempt, 60_000) + Math.floor(Math.random() * 400);
    this.log(`  повтор через ${(ms / 1000).toFixed(1)} с (${reason}): ${shown}`);
    await sleep(ms);
  }

  // Все записи списка с курсорной выдачей (по 200 на страницу).
  async all(path, params = {}, { limit = Infinity, onPage } = {}) {
    const out = [];
    let cursor = '*';
    while (cursor && out.length < limit) {
      const page = await this.get(path, { ...params, per_page: 200, cursor });
      const results = page.results ?? [];
      out.push(...results);
      if (onPage) onPage(out.length, page.meta?.count);
      cursor = results.length ? page.meta?.next_cursor : null;
    }
    return out.slice(0, limit === Infinity ? undefined : limit);
  }

  // group_by: первые 200 групп по убыванию числа работ.
  // Возвращает { groups, total }, где total — число работ, подходящих под фильтр.
  async groupBy(path, params = {}) {
    const page = await this.get(path, { ...params, per_page: 200 });
    return { groups: normalizeGroups(page.group_by), total: Number(page.meta?.count) || 0 };
  }

  // group_by: все группы (курсорная выдача; группы приходят по ключу, а не по числу работ).
  async groupByAll(path, params = {}) {
    const groups = [];
    let total = 0;
    let cursor = '*';
    while (cursor) {
      const page = await this.get(path, { ...params, per_page: 200, cursor });
      if (cursor === '*') total = Number(page.meta?.count) || 0;
      const part = page.group_by ?? [];
      groups.push(...normalizeGroups(part));
      cursor = part.length ? page.meta?.next_cursor : null;
    }
    return { groups, total };
  }
}

function normalizeGroups(groups = []) {
  return groups
    .filter((g) => g && g.key != null && g.key !== '' && String(g.key).toLowerCase() !== 'unknown')
    .map((g) => ({ key: shortId(g.key), name: g.key_display_name ?? null, count: Number(g.count) || 0 }));
}

// Объединяет результаты group_by по нескольким частям одного запроса (например, когда список
// тем разбит на порции по 50): суммирует счётчики по ключу и сортирует по убыванию.
// Принимает массивы групп или ответы groupBy ({ groups, total }).
export function mergeGroups(parts) {
  const map = new Map();
  for (const part of parts) {
    const groups = Array.isArray(part) ? part : part.groups;
    for (const g of groups) {
      const prev = map.get(g.key);
      if (prev) prev.count += g.count;
      else map.set(g.key, { ...g });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}
