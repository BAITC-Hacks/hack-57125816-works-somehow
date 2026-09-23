/**
 * Точка входа: связывает форму, подбор и отрисовку.
 * Всё работает в браузере — без сервера, регистрации и ключей API.
 * Ответственный: Участник 2 (интерфейс).
 */
(function (Podbor, CATALOG) {
  'use strict';

  const { el, $, $$ } = Podbor.dom;
  const { shiftDay } = Podbor.format;
  const { isValidDate, MAX_DATE } = Podbor.validation;
  const { matchProfiles } = Podbor.matcher;
  const { renderResults, renderDirtyState } = Podbor.resultsView;
  const { renderComparison } = Podbor.compareView;
  const OPTIONS = CATALOG.options;
  const FORM_KEYS = ['city', 'date', 'event', 'category', 'budget', 'language', 'hours'];
  const SELECTS = [['city', 'cities'], ['category', 'categories'], ['event', 'events'], ['language', 'languages']];

  const ui = {
    form: $('#search-form'),
    fields: $('#fields'),
    results: $('#results'),
    errorBox: $('#form-error'),
    resultTools: $('#result-tools'),
    repeatStatus: $('#repeat-status'),
    compareToggle: $('#compare-toggle'),
    comparePanel: $('#compare-panel'),
    compareInput: $('#compare-date'),
    compareOutput: $('#comparison-output'),
    repeatButton: $('#repeat-check'),
    demoButtons: $$('[data-example]'),
  };

  const state = { lastResult: null, lastQuery: null };

  /* ---------- форма ---------- */

  function readForm() {
    const data = new FormData(ui.form);
    return {
      city: data.get('city'),
      date: data.get('date'),
      event: data.get('event'),
      category: data.get('category'),
      budget: Number(data.get('budget')),
      language: data.get('language') || null,
      hours: data.get('hours') === '' ? null : Number(data.get('hours')),
    };
  }

  function fillForm(query) {
    FORM_KEYS.forEach(key => { ui.form.elements.namedItem(key).value = query[key] ?? ''; });
  }

  function selectDemoButton(active) {
    ui.demoButtons.forEach(button => button.classList.toggle('selected', button === active));
  }

  function markDirty() {
    state.lastQuery = null;
    state.lastResult = null;
    ui.errorBox.hidden = true;
    ui.comparePanel.hidden = true;
    ui.compareOutput.replaceChildren();
    ui.repeatStatus.textContent = '';
    ui.resultTools.hidden = true;
    selectDemoButton(null);
    renderDirtyState(ui.results);
  }

  /* ---------- подбор ---------- */

  function syncCompareDate(queryDate) {
    if (isValidDate(ui.compareInput.value) && ui.compareInput.value !== queryDate) return;
    ui.compareInput.value = shiftDay(queryDate, queryDate === MAX_DATE ? -1 : 1);
  }

  function search(query = readForm()) {
    ui.errorBox.hidden = true;
    ui.results.setAttribute('aria-busy', 'true');
    try {
      const data = matchProfiles(CATALOG.profiles, CATALOG.facts, query);
      state.lastResult = data;
      state.lastQuery = { ...data.query };
      renderResults(ui.results, data);
      ui.resultTools.hidden = false;
      ui.repeatStatus.textContent = '';
      syncCompareDate(query.date);
      if (!ui.comparePanel.hidden) updateComparison();
      return data;
    } catch (error) {
      ui.errorBox.textContent = error.message;
      ui.errorBox.hidden = false;
      return null;
    } finally {
      ui.results.setAttribute('aria-busy', 'false');
    }
  }

  function updateComparison() {
    if (!state.lastQuery || !ui.compareInput.reportValidity()) return;
    renderComparison(ui.compareOutput, state.lastResult, ui.compareInput.value);
  }

  function toggleComparison() {
    ui.comparePanel.hidden = !ui.comparePanel.hidden;
    ui.compareToggle.setAttribute('aria-expanded', String(!ui.comparePanel.hidden));
    if (!ui.comparePanel.hidden) {
      updateComparison();
      ui.comparePanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /** Повторный запуск должен дать байт-в-байт тот же результат. */
  function checkRepeatability() {
    if (!state.lastQuery) return;
    const again = matchProfiles(CATALOG.profiles, CATALOG.facts, state.lastQuery);
    const identical = JSON.stringify(again) === JSON.stringify(state.lastResult);
    ui.repeatStatus.textContent = identical
      ? 'Проверено: профили, порядок и объяснения полностью совпадают.'
      : 'Результат изменился. Проверьте данные перед продолжением.';
  }

  /* ---------- инициализация ---------- */

  function assertCatalogIntegrity() {
    if (CATALOG.profiles.length !== OPTIONS.total) throw new Error('Встроенный каталог загружен не полностью.');
    for (const profile of CATALOG.profiles) {
      const fact = CATALOG.facts[profile.id];
      if (!fact?.source || !profile.description.includes(fact.source) || !CATALOG.russian[profile.id]?.fact_ru) {
        throw new Error('Для одного из профилей отсутствует подтверждение из исходных данных.');
      }
    }
  }

  function populateSelects() {
    for (const [id, key] of SELECTS) {
      const select = document.getElementById(id);
      OPTIONS[key].forEach(item => {
        const option = el('option', '', item.label);
        option.value = item.value;
        select.append(option);
      });
    }
  }

  function renderCatalogStats() {
    const { total, flags } = OPTIONS;
    $('#catalog-total').textContent = total;
    $('#category-total').textContent = OPTIONS.categories.length;
    $('#flag-summary').textContent = `Обезличенных профилей: ${total} · Искусственно созданных: ${flags.synthetic} · С заполненным городом: ${flags.city_imputed} · С заполненной ценой: ${flags.price_imputed}. Признаки могут пересекаться.`;
  }

  function bindEvents() {
    ui.form.addEventListener('input', markDirty);
    ui.form.addEventListener('change', markDirty);
    ui.form.addEventListener('submit', event => {
      event.preventDefault();
      if (ui.form.reportValidity()) search();
    });
    ui.compareToggle.addEventListener('click', toggleComparison);
    ui.compareInput.addEventListener('change', updateComparison);
    ui.repeatButton.addEventListener('click', checkRepeatability);
    ui.demoButtons.forEach(button => button.addEventListener('click', () => {
      fillForm(Podbor.demos[button.dataset.example]);
      selectDemoButton(button);
      search();
    }));
  }

  function init() {
    bindEvents();
    try {
      assertCatalogIntegrity();
      populateSelects();
      renderCatalogStats();
      ui.fields.disabled = false;
      ui.demoButtons.forEach(button => { button.disabled = false; });
      fillForm(Podbor.demos.dense);
      search();
    } catch (error) {
      ui.results.replaceChildren(el('div', 'empty-state', error.message));
      ui.results.setAttribute('aria-busy', 'false');
    }
  }

  init();
})(globalThis.Podbor = globalThis.Podbor || {}, globalThis.PODBOR_CATALOG);
