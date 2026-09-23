/**
 * Проверка входящего запроса подбора.
 * Ответственный: Участник 1 (логика).
 */
(function (Podbor, CATALOG) {
  'use strict';

  const LABELS = CATALOG.labels;
  const MIN_DATE = CATALOG.options.min_date;
  const MAX_DATE = CATALOG.options.max_date;
  const ALLOWED_FIELDS = new Set(['city', 'date', 'category', 'event', 'budget', 'language', 'hours']);
  const REQUIRED_CHOICES = [
    ['city', LABELS.cities, 'город'],
    ['category', LABELS.categories, 'категорию'],
    ['event', LABELS.events, 'тип мероприятия'],
  ];

  function hasLabel(labels, key) {
    return typeof key === 'string' && Object.prototype.hasOwnProperty.call(labels, key);
  }

  /** Дата в формате YYYY-MM-DD, существует и входит в рабочий календарь. */
  function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime())
      && date.toISOString().slice(0, 10) === value
      && value >= MIN_DATE && value <= MAX_DATE;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Возвращает нормализованный запрос или бросает Error с понятным сообщением.
   * @param {object} raw — данные формы
   */
  function validateRequest(raw) {
    if (!isPlainObject(raw)) throw new Error('Запрос должен быть объектом.');
    if (Object.keys(raw).some(key => !ALLOWED_FIELDS.has(key))) {
      throw new Error('Запрос содержит неизвестное поле.');
    }

    const query = {};
    for (const [key, labels, label] of REQUIRED_CHOICES) {
      if (!hasLabel(labels, raw[key])) throw new Error('Выберите ' + label + ' из списка.');
      query[key] = raw[key];
    }

    if (!isValidDate(raw.date)) throw new Error('Выберите дату с 23 сентября по 31 декабря 2026 года.');
    query.date = raw.date;

    if (!Number.isSafeInteger(raw.budget) || raw.budget < 0) {
      throw new Error('Укажите бюджет целым числом в тенге, не меньше нуля.');
    }
    query.budget = raw.budget;

    const language = raw.language ?? null;
    const badLanguage = language !== null
      && (typeof language !== 'string' || (language !== '' && !hasLabel(LABELS.languages, language)));
    if (badLanguage) throw new Error('Выберите язык из списка или оставьте поле пустым.');
    query.language = language || null;

    const hours = raw.hours ?? null;
    const badHours = hours !== null
      && (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 || hours > Number.MAX_SAFE_INTEGER);
    if (badHours) {
      throw new Error('Продолжительность должна быть положительным числом; если она не важна, оставьте поле пустым.');
    }
    query.hours = hours;

    return query;
  }

  Podbor.validation = { validateRequest, isValidDate, MIN_DATE, MAX_DATE };
})(globalThis.Podbor = globalThis.Podbor || {}, globalThis.PODBOR_CATALOG);
