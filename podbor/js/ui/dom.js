/**
 * Мелкие помощники для работы с DOM.
 * Ответственный: Участник 2 (интерфейс).
 */
(function (Podbor) {
  'use strict';

  /** Создаёт элемент с классом и текстом (текст всегда через textContent — безопасно). */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  Podbor.dom = { el, $, $$ };
})(globalThis.Podbor = globalThis.Podbor || {});
