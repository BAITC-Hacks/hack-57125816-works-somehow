/**
 * Отрисовка результатов подбора: воронка, сводка, карточки, причины отказа.
 * Ответственный: Участник 2 (интерфейс).
 */
(function (Podbor, CATALOG) {
  'use strict';

  const { el } = Podbor.dom;
  const { formatDate } = Podbor.format;
  const OPTIONS = CATALOG.options;

  const FLAG_MEANINGS = {
    synthetic: 'Искусственно созданный профиль',
    city_imputed: 'Город заполнен при подготовке набора данных',
    price_imputed: 'Цена заполнена при подготовке набора данных',
  };

  function labelFor(key, value) {
    return OPTIONS[key].find(item => item.value === value)?.label || value;
  }

  function badgeText(data) {
    if (data.status === 'matched') return `НАЙДЕНО: ${data.cards.length}`;
    return data.status === 'no_category' ? 'КАТЕГОРИЯ ОТСУТСТВУЕТ' : 'НЕТ ПОДХОДЯЩИХ';
  }

  function pipelineView(data) {
    const pipeline = el('div', 'pipeline');
    [
      ['В выбранном городе и категории', data.candidate_count],
      ['Прошли все условия', data.eligible_count],
      ['Профилей в подборке', data.cards.length],
    ].forEach(([label, count]) => {
      const step = el('div', 'pipeline-step');
      step.append(el('strong', '', String(count)), el('span', '', label));
      pipeline.append(step);
    });
    return pipeline;
  }

  function summaryView(data) {
    const summary = el('div', 'result-summary');
    const title = el('div', 'status-line');
    title.append(
      el('span', `status-badge ${data.status === 'matched' ? '' : 'warning'}`, badgeText(data)),
      el('h3', '', data.title),
    );

    const q = data.query;
    const tags = el('div', 'query-tags');
    [
      labelFor('cities', q.city),
      formatDate(q.date),
      labelFor('events', q.event),
      ...(q.language ? [labelFor('languages', q.language)] : []),
      ...(q.hours !== null ? [`${q.hours} ч`] : []),
    ].forEach(text => tags.append(el('span', 'query-tag', text)));

    summary.append(title, el('p', 'summary-text', data.message), tags);
    return summary;
  }

  function cardView(card, index) {
    const article = el('article', 'profile-card');
    article.dataset.profileId = card.id;

    const names = el('div');
    names.append(el('h3', '', card.name), el('p', 'profile-meta', `${card.category} · ${card.city}`));
    const identity = el('div', 'profile-identity');
    identity.append(el('span', 'rank', String(index + 1).padStart(2, '0')), names);
    const price = el('p', 'price', card.price_label);
    price.append(el('small', '', 'Начальная цена · итоговая стоимость уточняется'));
    const top = el('div', 'card-top');
    top.append(identity, price);

    const why = el('div', 'why-block');
    why.append(el('span', 'why-label', 'ПОЧЕМУ ПОДХОДИТ'), el('p', 'explanation', card.explanation));

    const hoursText = card.max_hours === null
      ? 'Продолжительность на площадке: не применяется'
      : `На площадке до ${card.max_hours} ч`;
    const attributes = el('div', 'card-attributes');
    attributes.append(
      el('span', '', card.languages.join(' / ')),
      el('span', '', hoursText),
      el('span', 'profile-id', card.id),
    );

    const flags = el('div', 'flag-row');
    for (const [key, enabled] of Object.entries(card.flags)) {
      const flag = el('span', `flag${enabled ? ' active' : ''}`, `${key}: ${enabled ? 'да' : 'нет'}`);
      flag.title = FLAG_MEANINGS[key];
      flags.append(flag);
    }

    const evidence = el('details', 'evidence');
    evidence.append(
      el('summary', '', 'Посмотреть подтверждение из каталога'),
      el('p', 'evidence-caption', 'Точная цитата из исходного каталога. Это сведения, указанные в самом профиле.'),
      el('blockquote', '', card.evidence),
    );

    article.append(top, why, attributes, flags, evidence);
    return article;
  }

  function emptyView(status) {
    const noCategory = status === 'no_category';
    const empty = el('div', 'empty-state');
    empty.append(
      el('span', 'empty-icon', noCategory ? '∅' : '—'),
      el('h3', '', noCategory
        ? 'Попробуйте другой город или категорию.'
        : 'Подходящих профилей нет — причины указаны ниже.'),
      el('p', '', noCategory
        ? 'В каталоге нет профилей с таким сочетанием города и категории. Изменение даты или бюджета не добавит отсутствующие профили.'
        : 'Каждый кандидат не прошёл хотя бы одно условие. Посмотрите точные причины ниже и при необходимости измените параметры мероприятия.'),
    );
    return empty;
  }

  function diagnosticsView(data) {
    const diagnostics = el('section', 'diagnostics');
    diagnostics.append(el('h4', '', `Почему не прошли отбор — кандидатов: ${data.rejected_count}`));

    const reasons = el('ul', 'reason-list');
    data.reason_counts.forEach(reason => {
      const li = el('li', '', reason.label);
      li.append(el('strong', '', String(reason.count)));
      reasons.append(li);
    });

    const list = el('ul');
    data.rejected.forEach(profile => {
      const li = el('li');
      li.append(
        el('strong', '', profile.name),
        el('span', 'rejection-id', ` (${profile.id})`),
        document.createTextNode(` — ${profile.reasons.map(reason => reason.detail).join(' ')}`),
      );
      list.append(li);
    });
    const details = el('details', 'rejections');
    details.append(el('summary', '', 'Посмотреть все исключённые профили'), list);

    diagnostics.append(
      reasons,
      el('p', 'diagnostic-note', 'Числа могут пересекаться: один профиль может не пройти несколько условий. Все заданные ограничения соблюдаются.'),
      details,
    );
    return diagnostics;
  }

  /** Полностью перерисовывает контейнер результатов. */
  function renderResults(container, data) {
    container.replaceChildren();
    container.dataset.status = data.status;
    container.append(pipelineView(data), summaryView(data));

    if (data.cards.length) {
      const cards = el('div', 'cards');
      data.cards.forEach((card, i) => cards.append(cardView(card, i)));
      container.append(cards);
    } else {
      container.append(emptyView(data.status));
    }
    if (data.rejected_count) container.append(diagnosticsView(data));
  }

  /** Состояние «параметры изменились, нажмите поиск». */
  function renderDirtyState(container) {
    const state = el('div', 'empty-state dirty-state');
    state.append(
      el('span', 'eyebrow', 'ГОТОВО К ПОИСКУ'),
      el('h3', '', 'Параметры мероприятия изменились.'),
      el('p', '', 'Нажмите «Подобрать варианты», чтобы получить подборку с этими параметрами.'),
    );
    container.replaceChildren(state);
  }

  Podbor.resultsView = { renderResults, renderDirtyState };
})(globalThis.Podbor = globalThis.Podbor || {}, globalThis.PODBOR_CATALOG);
