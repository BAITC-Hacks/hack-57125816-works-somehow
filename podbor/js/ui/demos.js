/**
 * Готовые демо-запросы для кнопок «Проверьте на примере».
 * Ответственный: Участник 2 (интерфейс).
 */
(function (Podbor) {
  'use strict';

  const base = { city: 'Алматы', date: '2026-09-23', event: 'свадьба', budget: 2000000, language: null, hours: null };

  Podbor.demos = Object.freeze({
    dense:  { ...base, category: 'Ведущий' },
    rare:   { ...base, category: 'Флорист', hours: 12 },
    busy:   { ...base, category: 'Флорист', hours: 12, date: '2026-09-25' },
    absent: { ...base, category: 'Декоратор', city: 'Астана' },
    budget: { ...base, category: 'Ведущий', budget: 10000 },
  });
})(globalThis.Podbor = globalThis.Podbor || {});
