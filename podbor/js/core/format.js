/**
 * Форматирование чисел и дат для интерфейса и объяснений.
 * Ответственный: Участник 1 (логика).
 */
(function (Podbor) {
  'use strict';

  const DAY_MS = 86400000;

  /** 2000000 → "2 000 000" */
  function money(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /** "2026-09-23" → "23.09.2026" */
  function dayLabel(isoDay) {
    return isoDay.split('-').reverse().join('.');
  }

  /** "2026-09-23" → "23 сент. 2026 г." */
  function formatDate(isoDay) {
    return new Date(isoDay + 'T12:00:00Z').toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
  }

  /** Сдвигает ISO-дату на указанное число дней. */
  function shiftDay(isoDay, days) {
    return new Date(Date.parse(isoDay + 'T12:00:00Z') + days * DAY_MS).toISOString().slice(0, 10);
  }

  /** Аналог Python {:g}: шесть значащих цифр, при необходимости — экспонента. */
  function numberG(value) {
    const [mantissa, exponentText] = value.toExponential(5).split('e');
    const exponent = Number(exponentText);
    if (exponent < -4 || exponent >= 6) {
      const sign = exponent < 0 ? '-' : '+';
      return mantissa.replace(/\.?0+$/, '') + 'e' + sign + String(Math.abs(exponent)).padStart(2, '0');
    }
    return String(Number(mantissa + 'e' + exponent));
  }

  Podbor.format = { money, dayLabel, formatDate, shiftDay, numberG };
})(globalThis.Podbor = globalThis.Podbor || {});
