// Отраслевые и национальные приоритеты, с которыми сопоставляются компетенции и темы.
//
// В список входят только формулировки, подтверждённые по первоисточнику; у каждого приоритета —
// документ, дата и ссылка. Компетенция считается соответствующей приоритету, если её id есть
// в `competencies`; тема — если она входит в такую компетенцию или её название совпадает с `topics`.
// Список правится вручную; после правки достаточно пересобрать сайт (новая выгрузка не нужна).

export const PRIORITIES = [
  {
    id: 'np-means-of-production',
    short: { ru: 'Нацпроект «Средства производства и автоматизации»', en: 'National project “Means of production and automation”' },
    name: {
      ru: 'Национальный проект «Средства производства и автоматизации»',
      en: 'National project “Means of production and automation”',
    },
    note: {
      ru: 'Станкоинструментальная отрасль, робототехника и автоматизация, литейное и термическое оборудование; головной центр компетенций — на базе СТАНКИН.',
      en: 'Machine tools and tooling, robotics and automation, foundry and heat-treatment equipment; the lead competence centre is based at STANKIN.',
    },
    source: { ru: 'Правительство России, национальный проект на 2025–2030 годы', en: 'Government of Russia, national project for 2025–2030' },
    url: 'http://government.ru/rugovclassifier/928/about/',
    competencies: ['machining', 'machine-tools-control', 'robotics', 'coatings-tribology', 'forming-welding', 'digital-manufacturing'],
    topics: /\b(machine tool|machining|cutting tool|robot|automation|casting|foundry|heat treatment)/i,
  },
  {
    id: 'cross-ai',
    short: { ru: 'сквозная технология «Искусственный интеллект»', en: 'cross-cutting technology “Artificial intelligence”' },
    name: { ru: 'Сквозная технология: искусственный интеллект', en: 'Cross-cutting technology: artificial intelligence' },
    note: {
      ru: 'Входит в перечень сквозных технологий Российской Федерации.',
      en: 'Listed among the cross-cutting technologies of the Russian Federation.',
    },
    source: { ru: 'Указ Президента РФ от 18.06.2024 № 529', en: 'Presidential Decree No. 529 of 18 June 2024' },
    url: 'http://www.kremlin.ru/acts/bank/50755',
    competencies: ['ai-data'],
    topics: /\b(machine learning|deep learning|neural network|artificial intelligence|computer vision)/i,
  },
  {
    id: 'cross-materials',
    short: { ru: 'сквозная технология «Новые материалы и вещества»', en: 'cross-cutting technology “New materials and substances”' },
    name: { ru: 'Сквозная технология: новые материалы и вещества', en: 'Cross-cutting technology: new materials and substances' },
    note: {
      ru: 'Входит в перечень сквозных технологий Российской Федерации.',
      en: 'Listed among the cross-cutting technologies of the Russian Federation.',
    },
    source: { ru: 'Указ Президента РФ от 18.06.2024 № 529', en: 'Presidential Decree No. 529 of 18 June 2024' },
    url: 'http://www.kremlin.ru/acts/bank/50755',
    competencies: ['ceramics-composites', 'metals-alloys', 'coatings-tribology', 'biomaterials', 'additive-manufacturing'],
    topics: null,
  },
  {
    id: 'cross-software',
    short: { ru: 'сквозная технология «Промышленное ПО»', en: 'cross-cutting technology “Industrial software”' },
    name: { ru: 'Сквозная технология: новое промышленное программное обеспечение', en: 'Cross-cutting technology: new industrial software' },
    note: {
      ru: 'Входит в перечень сквозных технологий Российской Федерации.',
      en: 'Listed among the cross-cutting technologies of the Russian Federation.',
    },
    source: { ru: 'Указ Президента РФ от 18.06.2024 № 529', en: 'Presidential Decree No. 529 of 18 June 2024' },
    url: 'http://www.kremlin.ru/acts/bank/50755',
    competencies: ['digital-manufacturing', 'software-it', 'machine-tools-control'],
    topics: /\b(digital twin|CAD|CAM|PLM|industrial software)\b/i,
  },
  {
    id: 'stnr-smart-manufacturing',
    short: { ru: 'Стратегия НТР', en: 'S&T Development Strategy' },
    name: { ru: 'Стратегия НТР: интеллектуальные производственные решения', en: 'S&T Development Strategy: smart manufacturing solutions' },
    note: {
      ru: 'Приоритет научно-технологического развития: переход к передовым технологиям проектирования и создания высокотехнологичной продукции на основе интеллектуальных производственных решений, роботизированных систем и новых материалов (пересказ).',
      en: 'A priority of scientific and technological development: transition to advanced design and manufacturing of high-tech products based on smart production solutions, robotic systems and new materials (paraphrase).',
    },
    source: { ru: 'Стратегия научно-технологического развития РФ, Указ Президента РФ от 28.02.2024 № 145', en: 'Strategy for Scientific and Technological Development, Presidential Decree No. 145 of 28 February 2024' },
    url: 'http://www.kremlin.ru/acts/bank/50358',
    competencies: ['digital-manufacturing', 'additive-manufacturing', 'robotics', 'ai-data', 'machine-tools-control'],
    topics: /\b(smart manufacturing|industry 4\.0|additive manufacturing|3D printing)/i,
  },
];

// Приоритеты компетенции: список id.
export function competencyPriorities(competencyId, priorities = PRIORITIES) {
  return priorities.filter((p) => p.competencies.includes(competencyId)).map((p) => p.id);
}

// Приоритеты темы: по компетенции, к которой она отнесена, и по названию.
export function topicPriorities(topic, priorities = PRIORITIES) {
  return priorities
    .filter((p) => (topic.competency && p.competencies.includes(topic.competency)) || (p.topics && p.topics.test(topic.name ?? '')))
    .map((p) => p.id);
}
