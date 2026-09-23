/**
 * Сравнение подборки на двух датах.
 * Ответственный: Участник 2 (интерфейс).
 */
(function (Podbor, CATALOG) {
  'use strict';

  const { el } = Podbor.dom;
  const { formatDate } = Podbor.format;
  const { matchProfiles } = Podbor.matcher;

  function rowStatus(card, otherResult) {
    const otherDay = otherResult.query.date;
    const profile = CATALOG.profiles.find(p => p.id === card.id);
    if (profile.busy_dates.includes(otherDay)) {
      return { className: 'calendar-change', text: `Занят: ${formatDate(otherDay)}` };
    }
    const alsoShown = otherResult.cards.some(c => c.id === card.id);
    return {
      className: 'comparison-muted',
      text: alsoShown ? 'В подборке на обе даты' : 'Подходит и на другую дату, но не входит в её первые 3 результата',
    };
  }

  function columnView(result, otherResult, isOther) {
    const column = el('div', 'comparison-column');
    column.append(
      el('p', 'eyebrow', isOther ? 'ДРУГАЯ ДАТА' : 'ВЫБРАННАЯ ДАТА'),
      el('h4', '', formatDate(result.query.date)),
      el('p', 'comparison-count', `Подходят: ${result.eligible_count} · Показано: ${result.cards.length}`),
    );
    if (!result.cards.length) column.append(el('p', 'comparison-note', result.title));

    result.cards.forEach(card => {
      const status = rowStatus(card, otherResult);
      const row = el('div', 'comparison-row');
      row.append(el('strong', '', card.name), el('span', '', card.price_label), el('small', status.className, status.text));
      column.append(row);
    });
    return column;
  }

  /**
   * @param {HTMLElement} output — куда выводить
   * @param {object} baseResult — последний результат подбора
   * @param {string} otherDate — дата для сравнения
   */
  function renderComparison(output, baseResult, otherDate) {
    output.replaceChildren();
    if (otherDate === baseResult.query.date) {
      output.append(el('p', 'comparison-note', 'Выберите другую дату, чтобы увидеть, как занятость влияет на подборку.'));
      return;
    }
    const other = matchProfiles(CATALOG.profiles, CATALOG.facts, { ...baseResult.query, date: otherDate });
    const columns = el('div', 'comparison-grid');
    columns.append(columnView(baseResult, other, false), columnView(other, baseResult, true));
    output.append(
      columns,
      el('p', 'comparison-note', 'Меняется только дата. Бюджет, город, категория, тип мероприятия, язык, продолжительность и правила сортировки остаются прежними. Занятость взята из календаря в каталоге.'),
    );
  }

  Podbor.compareView = { renderComparison };
})(globalThis.Podbor = globalThis.Podbor || {}, globalThis.PODBOR_CATALOG);
