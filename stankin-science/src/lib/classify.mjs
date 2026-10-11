// Отнесение тем OpenAlex к компетенциям по правилам из content/competencies.mjs.
// Модуль чистый (без ввода-вывода): его используют и выгрузка данных, и сборка сайта, и тесты.

const asSet = (list) => new Set((list ?? []).map(Number));

function compile(rule = {}) {
  return {
    wholeFields: asSet(rule.whole?.fields),
    wholeSubfields: asSet(rule.whole?.subfields),
    scopeFields: asSet(rule.scope?.fields),
    scopeSubfields: asSet(rule.scope?.subfields),
    name: rule.name ?? null,
    exclude: rule.exclude ?? null,
  };
}

// Подходит ли тема правилу компетенции.
export function topicMatches(rule, topic) {
  const r = rule.__compiled ?? compile(rule);
  const name = topic.name ?? '';
  if (r.exclude && r.exclude.test(name)) return false;
  const field = Number(topic.field);
  const subfield = Number(topic.subfield);
  if (r.wholeFields.has(field) || r.wholeSubfields.has(subfield)) return true;
  if (!r.name) return false;
  const anyScope = r.scopeFields.size === 0 && r.scopeSubfields.size === 0;
  const inScope = anyScope || r.scopeFields.has(field) || r.scopeSubfields.has(subfield);
  return inScope && r.name.test(name);
}

// Распределяет темы по компетенциям: каждая тема — в первую подходящую компетенцию списка.
// Возвращает { byTopic: Map<topicId, competencyId>, byCompetency: Map<competencyId, topicId[]> }.
export function assignTopics(topics, competencies) {
  const compiled = competencies.map((c) => ({ id: c.id, rule: { ...c.match, __compiled: compile(c.match) } }));
  const byTopic = new Map();
  const byCompetency = new Map(competencies.map((c) => [c.id, []]));
  for (const topic of topics) {
    for (const c of compiled) {
      if (topicMatches(c.rule, topic)) {
        byTopic.set(topic.id, c.id);
        byCompetency.get(c.id).push(topic.id);
        break;
      }
    }
  }
  for (const list of byCompetency.values()) list.sort();
  return { byTopic, byCompetency };
}

// Короткий отпечаток распределения: позволяет понять, построен ли мировой контекст
// компетенции (страны, организации) для того же набора тем, что и в текущих правилах.
export function topicSetKey(topicIds) {
  let h = 2166136261;
  for (const id of [...topicIds].sort()) {
    for (let i = 0; i < id.length; i += 1) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 44;
    h = Math.imul(h, 16777619);
  }
  return `${topicIds.length}:${(h >>> 0).toString(16)}`;
}
