/**
 * Тесты логики подбора. Запуск: node tests/matcher.test.js
 * Ответственный: Участник 1 (логика).
 */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');

require('../data/catalog.js');
require('../js/core/format.js');
require('../js/core/validation.js');
require('../js/core/matcher.js');

const { PODBOR_CATALOG: CATALOG, Podbor } = globalThis;
const { matchProfiles } = Podbor.matcher;
const base = { city: 'Алматы', date: '2026-09-23', event: 'свадьба', category: 'Ведущий', budget: 2000000, language: null, hours: null };
const run = query => matchProfiles(CATALOG.profiles, CATALOG.facts, query);

test('форматирование денег и дат', () => {
  assert.equal(Podbor.format.money(2000000), '2 000 000');
  assert.equal(Podbor.format.dayLabel('2026-09-23'), '23.09.2026');
  assert.equal(Podbor.format.numberG(0.5), '0.5');
});

test('популярная категория: не больше 3 карточек, сортировка по цене', () => {
  const result = run(base);
  assert.equal(result.status, 'matched');
  assert.ok(result.cards.length <= 3);
  const prices = result.cards.map(card => card.price_from_kzt);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('одинаковый запрос — одинаковый результат', () => {
  assert.equal(JSON.stringify(run(base)), JSON.stringify(run(base)));
});

test('нет категории в городе', () => {
  assert.equal(run({ ...base, city: 'Астана', category: 'Декоратор' }).status, 'no_category');
});

test('маленький бюджет отсекает всех', () => {
  const result = run({ ...base, budget: 10000 });
  assert.equal(result.status, 'no_match');
  assert.ok(result.reason_counts.some(reason => reason.code === 'budget'));
});

test('некорректные запросы отклоняются', () => {
  assert.throws(() => run({ ...base, budget: -1 }), /бюджет/);
  assert.throws(() => run({ ...base, date: '2027-01-01' }), /дату/);
  assert.throws(() => run({ ...base, extra: 1 }), /неизвестное поле/);
});
