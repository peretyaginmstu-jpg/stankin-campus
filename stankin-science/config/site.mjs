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

// Исключения по итогам аудита аффилиаций. Работы, ошибочно приписанные университету в OpenAlex,
// и темы, которые не относятся к его профилю, отбрасываются до любых расчётов; число исключённых
// работ показано на странице «Методика». Идентификаторы — короткие OpenAlex ID:
//   works: ['W4390000000', ...], topics: ['T10000', ...].
export const EXCLUDE = {
  works: [],
  topics: [],
};

// Слой решений «Что развивать». Все составляющие нормированы в 0..1, итоговый балл — 0..100.
export const STRATEGY = {
  // Веса составляющих балла компетенции (сумма — 1).
  weights: { position: 0.3, impact: 0.3, market: 0.25, momentum: 0.15 },
  // Надбавка к баллу (в долях единицы), если компетенция соответствует отраслевому приоритету.
  priorityBonus: 0.08,
  // Мировой рынок направления считается растущим, если его рост не ниже роста мировой науки
  // в целом, умноженного на это число.
  marketGrowing: 1,
  // Влияние на мировом уровне: FWCI не ниже fwci или доля топ-10 % не ниже top10.
  impact: { fwci: 1, top10: 0.1 },
  // Оценка помечается неустойчивой, если работ меньше minWorks или работ с FWCI меньше minFwciWorks.
  minWorks: 30,
  minFwciWorks: 30,
  // «Открыть с нуля»: быстрорастущие темы мира, где у университета не больше maxOwnWorks работ.
  open: {
    maxOwnWorks: 2,
    top: 10,
    // Для скольких первых кандидатов выгрузка запрашивает партнёров, страны и обзоры.
    fetch: 15,
    // Ниже этого задела тема попадает в список «Нужен новый коллектив».
    minFoundation: 0.25,
    newTeam: 8,
    // Множитель балла для тем, соответствующих отраслевому приоритету.
    priorityMultiplier: 1.4,
    // Подобласть с таким числом работ университета даёт полный задел по этой составляющей.
    subfieldFull: 100,
  },
};
