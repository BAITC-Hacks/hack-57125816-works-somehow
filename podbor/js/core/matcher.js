/**
 * Детерминированный подбор профилей: фильтрация, сортировка, объяснения.
 * Без ИИ, случайности и сетевых запросов.
 * Ответственный: Участник 1 (логика).
 */
(function (Podbor, CATALOG) {
  'use strict';

  const { money, dayLabel, numberG } = Podbor.format;
  const { validateRequest } = Podbor.validation;
  const LABELS = CATALOG.labels;
  const REASON_LABELS = CATALOG.reason_labels;
  const MAX_CARDS = 3;

  function compareId(a, b) {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  /** Список причин, по которым профиль не подходит под запрос. */
  function rejectionReasons(profile, query) {
    const reasons = [];
    const add = (code, detail) => reasons.push({ code, detail });

    if (profile.busy_dates.includes(query.date)) {
      add('busy', 'В каталоге отмечена занятость на ' + dayLabel(query.date) + '.');
    }
    if (profile.price_from_kzt > query.budget) {
      add('budget', `От ${money(profile.price_from_kzt)} тенге; ваш бюджет — ${money(query.budget)} тенге.`);
    }
    if (!profile.event_formats.includes(query.event)) {
      add('event', `В профиле не указан тип мероприятия «${LABELS.events[query.event]}».`);
    }
    if (query.language && !profile.languages.includes(query.language)) {
      add('language', `В профиле не указан рабочий язык «${LABELS.languages[query.language]}».`);
    }
    if (query.hours !== null && profile.max_hours !== null && query.hours > profile.max_hours) {
      add('duration', `Запрошенная продолжительность — ${numberG(query.hours)} ч.; ограничение профиля — ${profile.max_hours} ч.`);
    }
    return reasons;
  }

  /** Текст «Почему подходит»: факт из профиля + пройденные проверки. */
  function explain(profile, query) {
    const fact = CATALOG.russian[profile.id].fact_ru.replace(/[. ]+$/, '');
    const checks = [
      `Подходит для мероприятия «${LABELS.events[query.event]}»`,
      `начальная цена ${money(profile.price_from_kzt)} тенге укладывается в бюджет ${money(query.budget)} тенге`,
      `на ${dayLabel(query.date)} занятость не отмечена`,
    ];
    if (query.language) checks.push(`указан рабочий язык «${LABELS.languages[query.language]}»`);
    if (profile.max_hours === null) {
      checks.push('для этой услуги продолжительность присутствия на площадке не применяется');
    } else if (query.hours !== null) {
      checks.push(`запрошенная продолжительность ${numberG(query.hours)} ч. не превышает ограничение ${profile.max_hours} ч.`);
    }
    return `В описании профиля указано: ${fact}. ` + checks.join('; ') + '.';
  }

  function toCard(profile, query, facts) {
    return {
      id: profile.id,
      name: profile.anon_name,
      category: LABELS.categories[query.category],
      categories: profile.categories.map(category => LABELS.categories[category]),
      city: LABELS.cities[profile.city],
      price_from_kzt: profile.price_from_kzt,
      price_label: 'От ' + money(profile.price_from_kzt) + ' тенге',
      languages: profile.languages.map(language => LABELS.languages[language]),
      max_hours: profile.max_hours,
      explanation: explain(profile, query),
      evidence: facts[profile.id].source,
      flags: {
        synthetic: profile.synthetic,
        city_imputed: profile.city_imputed,
        price_imputed: profile.price_imputed,
      },
    };
  }

  function summarize(status, query, stats) {
    const { candidates, accepted, rejected, shown } = stats;
    if (status === 'no_category') {
      return {
        title: 'В этом городе нет такой категории',
        message: `В каталоге нет профилей для сочетания: ${LABELS.cities[query.city]} / «${LABELS.categories[query.category]}». Выберите другой город или категорию.`,
      };
    }
    if (status === 'no_match') {
      return {
        title: 'Профили есть, но не прошли все условия',
        message: `В этом городе и категории найдено профилей: ${candidates}. Ни один не прошёл все фильтры. Изучите причины ниже и измените условия.`,
      };
    }
    let message;
    if (accepted >= MAX_CARDS) {
      message = `Прошли все фильтры: ${accepted} из ${candidates}. Показаны первые 3 профиля по возрастанию начальной цены.`;
    } else if (rejected) {
      message = `Прошли все условия: ${accepted} из ${candidates}; не прошли: ${rejected}. Поэтому показано карточек: ${shown}.`;
    } else {
      message = `Всего профилей в этом городе и категории: ${candidates}. Все соответствуют условиям. Поэтому показано карточек: ${shown}.`;
    }
    return { title: 'Подходящие профили найдены', message };
  }

  /**
   * Главная функция подбора.
   * @returns {object} результат с карточками, отказами и счётчиками причин
   */
  function matchProfiles(profiles, facts, rawQuery) {
    const query = validateRequest(rawQuery);
    const candidates = profiles
      .filter(profile => profile.city === query.city && profile.categories.includes(query.category))
      .sort(compareId);

    const accepted = [];
    const rejected = [];
    const counts = Object.create(null);
    for (const profile of candidates) {
      const reasons = rejectionReasons(profile, query);
      if (reasons.length) {
        rejected.push({ id: profile.id, name: profile.anon_name, reasons });
        for (const reason of reasons) counts[reason.code] = (counts[reason.code] || 0) + 1;
      } else {
        accepted.push(profile);
      }
    }
    accepted.sort((a, b) => a.price_from_kzt - b.price_from_kzt || compareId(a, b));

    const cards = accepted.slice(0, MAX_CARDS).map(profile => toCard(profile, query, facts));
    const status = !candidates.length ? 'no_category' : cards.length ? 'matched' : 'no_match';
    const { title, message } = summarize(status, query, {
      candidates: candidates.length, accepted: accepted.length, rejected: rejected.length, shown: cards.length,
    });

    return {
      status, title, message, query,
      candidate_count: candidates.length,
      eligible_count: accepted.length,
      rejected_count: rejected.length,
      cards, rejected,
      reason_counts: Object.entries(REASON_LABELS)
        .filter(([code]) => counts[code])
        .map(([code, label]) => ({ code, label, count: counts[code] })),
      explanation_mode: 'catalog_only',
    };
  }

  Podbor.matcher = { matchProfiles, rejectionReasons, explain };
})(globalThis.Podbor = globalThis.Podbor || {}, globalThis.PODBOR_CATALOG);
