// Настройки анализа и сайта. Всё, что может понадобиться поменять без правки кода, собрано здесь.

export const SITE = {
  title: {
    ru: 'Научные компетенции МГТУ «СТАНКИН»',
    en: 'Research competencies of MSTU STANKIN',
  },
  repoUrl: 'https://github.com/peretyaginmstu-jpg/stankin-science',
  campusUrl: 'https://peretyaginmstu-jpg.github.io/stankin-campus/',
  universityUrl: { ru: 'https://stankin.ru/', en: 'https://stankin.ru/' },
  // Предварительная версия: страницы закрыты от поисковых систем (noindex + robots.txt).
  // Когда сайт согласован, поставьте false и пересоберите.
  noindex: true,
};

// Организация, для которой строится профиль. OpenAlex находит её по ROR; если в OpenAlex
// есть дубли записи университета, их идентификаторы добавляются в extraIds — публикации
// всех записей объединяются.
export const INSTITUTION = {
  ror: '05jv2yg47',
  openalexId: 'I2801681975',
  extraIds: [],
  country: 'RU',
  name: { ru: 'МГТУ «СТАНКИН»', en: 'MSTU STANKIN' },
  shortName: { ru: 'СТАНКИН', en: 'STANKIN' },
};

// Окно анализа: десять последних полных лет. Можно задать явно переменными
// YEARS_FROM и YEARS_TO при выгрузке данных.
export function analysisPeriod(now = new Date()) {
  const envTo = Number(process.env.YEARS_TO);
  const envFrom = Number(process.env.YEARS_FROM);
  const to = Number.isInteger(envTo) && envTo > 1990 ? envTo : now.getUTCFullYear() - 1;
  const from = Number.isInteger(envFrom) && envFrom > 1990 && envFrom < to ? envFrom : to - 9;
  const mid = Math.floor((from + to) / 2);
  return { from, to, p1: [from, mid], p2: [mid + 1, to] };
}

// Типы документов OpenAlex, которые входят в расчёт (и для университета, и для мира).
// Доклады конференций в OpenAlex относятся к article; сборники Springer и подобные — к book-chapter.
export const WORK_TYPES = ['article', 'review', 'book-chapter'];

export const THRESHOLDS = {
  // Компетенция показывается на карте и в карточках, если у университета не меньше стольких работ.
  competencyMinWorks: 15,
  // Тема попадает в таблицы, если у университета не меньше стольких работ.
  topicMinWorks: 3,
  // Подобласть попадает в «Карту направлений», если у университета не меньше стольких работ.
  subfieldMinWorks: 5,
  // «Мировые тренды»: тема считается заметной, если в мире за второй период не меньше стольких работ.
  trendMinWorldWorks: 3000,
  // Рост, начиная с которого тема считается быстрорастущей (отношение второго периода к первому).
  trendFastGrowth: 1.5,
  // Сколько первых организаций мира и России запрашивать по каждой компетенции.
  topInstitutions: 200,
};
