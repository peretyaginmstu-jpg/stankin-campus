/* Подписи, которые создаются скриптами (меню, каталог, счётчики, версия для слабовидящих), на трёх языках.
   Язык берётся из <html lang>: его проставляет сборка (scripts/build.py). Модуль не трогает DOM-дерево
   и не строит адресов, поэтому словари можно проверить из node: scripts/validate.py сверяет наборы ключей. */
export const STRINGS = {
  ru: {
    menuOpen: 'Открыть меню', menuClose: 'Закрыть меню',
    zoom: 'Увеличить: ', objectAlt: 'Архитектурная визуализация: ',
    mapAltPlan: 'Схема размещения объектов с номерами и экспликацией из материалов проекта',
    mapAltAerial: 'Архитектурная визуализация кампуса с обозначениями объектов',
    mapCaptionPlan: 'Схема размещения объектов · Материалы проекта, август 2026 · Номера соответствуют экспликации на плане',
    mapCaptionAerial: 'Архитектурная визуализация, август 2026 · Расположение меток ориентировочное',
    loadError: 'Не удалось загрузить объекты. Обновите страницу.',
    filterAll: 'Все этапы: ', filterPlan: 'Плановые этапы: ', filterEvent: 'Подтверждённые события: ',
    days: {one: 'день с начала строительства', few: 'дня с начала строительства', many: 'дней с начала строительства', other: 'дня с начала строительства'},
    viOn: 'Версия для слабовидящих', viOff: 'Обычная версия', viPanel: 'Настройки версии для слабовидящих',
    viReset: 'Сбросить', viImage: 'Изображение: ',
    viGroups: {size: 'Шрифт', theme: 'Цвет', images: 'Изображения', spacing: 'Интервал'},
    viSize: ['Обычный шрифт', 'Крупный шрифт', 'Очень крупный шрифт'],
    viTheme: ['Чёрный на белом', 'Белый на чёрном', 'Синий на голубом'],
    viImages: ['Включены', 'Чёрно-белые', 'Выключены'],
    viSpacing: ['Обычный', 'Средний', 'Большой'],
  },
  en: {
    menuOpen: 'Open menu', menuClose: 'Close menu',
    zoom: 'Enlarge: ', objectAlt: 'Architectural rendering: ',
    mapAltPlan: 'Site layout scheme with object numbers and the legend from the project materials (labels in Russian)',
    mapAltAerial: 'Architectural rendering of the campus with object markers',
    mapCaptionPlan: 'Site layout scheme · Project materials, August 2026 · Labels on the sheet are in Russian; numbers match the legend',
    mapCaptionAerial: 'Architectural rendering, August 2026 · Marker positions are approximate',
    loadError: 'Could not load the objects. Please refresh the page.',
    filterAll: 'All milestones: ', filterPlan: 'Planned milestones: ', filterEvent: 'Confirmed events: ',
    days: {one: 'day since construction began', other: 'days since construction began'},
    viOn: 'Accessible version', viOff: 'Standard version', viPanel: 'Accessible version settings',
    viReset: 'Reset', viImage: 'Image: ',
    viGroups: {size: 'Font', theme: 'Colours', images: 'Images', spacing: 'Spacing'},
    viSize: ['Standard font size', 'Large font size', 'Extra large font size'],
    viTheme: ['Black on white', 'White on black', 'Dark blue on light blue'],
    viImages: ['On', 'Greyscale', 'Off'],
    viSpacing: ['Standard', 'Medium', 'Wide'],
  },
  zh: {
    menuOpen: '打开菜单', menuClose: '关闭菜单',
    zoom: '放大：', objectAlt: '建筑效果图：',
    mapAltPlan: '项目资料中的项目布局示意图，含编号和图例（图上文字为俄文）',
    mapAltAerial: '带项目标注的校区建筑效果图',
    mapCaptionPlan: '项目布局示意图 · 项目资料，2026年8月 · 图上文字为俄文，编号与图例一致',
    mapCaptionAerial: '建筑效果图，2026年8月 · 标注位置为示意',
    loadError: '项目数据加载失败，请刷新页面。',
    filterAll: '全部阶段：', filterPlan: '计划阶段：', filterEvent: '已确认事件：',
    days: {other: '天（自开工起）'},
    viOn: '无障碍版本', viOff: '标准版本', viPanel: '无障碍版本设置',
    viReset: '重置', viImage: '图片：',
    viGroups: {size: '字号', theme: '配色', images: '图片', spacing: '间距'},
    viSize: ['标准字号', '大字号', '特大字号'],
    viTheme: ['白底黑字', '黑底白字', '浅蓝底深蓝字'],
    viImages: ['显示', '黑白', '隐藏'],
    viSpacing: ['标准', '中等', '加宽'],
  },
};
const htmlLang = typeof document === 'undefined' ? 'ru' : (document.documentElement.lang || 'ru');
export const LANG = htmlLang.slice(0, 2) in STRINGS ? htmlLang.slice(0, 2) : 'ru';
export const T = STRINGS[LANG];
/* Запись числа по правилам языка страницы: 18 520 · 18,520. */
export const formatNumber = (n) => n.toLocaleString(htmlLang === 'ru' ? 'ru-RU' : htmlLang);
/* Форма слова по числу: в русском три формы, в английском две, в китайском одна. */
export const plural = (n, forms) => {
  let rule = 'other';
  try { rule = new Intl.PluralRules(htmlLang).select(n); } catch (e) {}
  return forms[rule] || forms.other;
};
