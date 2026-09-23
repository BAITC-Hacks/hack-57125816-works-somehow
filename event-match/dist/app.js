"use strict";

const form = document.querySelector("#search-form");
const fields = document.querySelector("#fields");
const results = document.querySelector("#results");
const errorBox = document.querySelector("#form-error");
const submit = document.querySelector("#submit-button");
let catalog;
let requestVersion = 0;
let activeRequest;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function labelFor(key, value) {
  return catalog[key].find(option => option.value === value)?.label || value;
}
function readForm() {
  const data = new FormData(form);
  return {
    city: data.get("city"), date: data.get("date"), event: data.get("event"), category: data.get("category"),
    budget: Number(data.get("budget")), language: data.get("language") || null,
    hours: data.get("hours") === "" ? null : Number(data.get("hours")),
  };
}
function formatDate(value) { return value.split("-").reverse().join("."); }
function resetRequest() {
  requestVersion++;
  activeRequest?.abort();
  submit.disabled = false;
  submit.replaceChildren(document.createTextNode("Сәйкес профильдерді табу "), el("span", "", "→"));
  results.setAttribute("aria-busy", "false");
}
function markDirty() {
  if (!catalog) return;
  resetRequest();
  errorBox.hidden = true;
  const state = el("div", "empty-state dirty-state");
  state.append(el("h3", "", "Шарттар өзгерді"), el("p", "", "Жаңа шарттарға сәйкес нәтижені көру үшін «Сәйкес профильдерді табу» батырмасын басыңыз."));
  results.replaceChildren(state);
}
form.addEventListener("input", markDirty);
form.addEventListener("change", markDirty);

function cardView(card, index) {
  const article = el("article", "profile-card");
  article.dataset.profileId = card.id;
  const top = el("div", "card-top");
  const identity = el("div", "profile-identity");
  const names = el("div");
  names.append(el("h3", "", card.name), el("p", "profile-meta", `${card.category} · ${card.city}`));
  identity.append(el("span", "rank", String(index + 1).padStart(2, "0")), names);
  const price = el("p", "price", card.price_label);
  price.append(el("small", "", "Соңғы баға емес"));
  top.append(identity, price);
  const attributes = el("div", "card-attributes");
  attributes.append(el("span", "", card.languages.join(" · ")), el("span", "", card.max_hours === null ? "Алаңда болу ұзақтығы қолданылмайды" : `Алаңда ${card.max_hours} сағатқа дейін`), el("span", "", card.id));
  const flags = el("div", "flag-row");
  const meanings = {synthetic: "Жасанды профиль", city_imputed: "Қала дайындау кезінде толтырылған", price_imputed: "Баға дайындау кезінде толтырылған"};
  for (const [key, enabled] of Object.entries(card.flags)) {
    const flag = el("span", `flag${enabled ? " active" : ""}`, `${key}: ${enabled ? "иә" : "жоқ"}`);
    flag.title = `${meanings[key]}: ${enabled ? "иә" : "жоқ"}`;
    flags.append(flag);
  }
  const evidence = el("details", "evidence");
  const quote = el("blockquote", "", card.evidence);
  quote.lang = "ru";
  evidence.append(el("summary", "", "Ерекшеліктің түпнұсқа дерегі (орысша)"), quote);
  article.append(top, el("p", "explanation", card.explanation), attributes, flags, evidence);
  return article;
}
function render(data) {
  results.replaceChildren();
  results.dataset.status = data.status;
  if (data.status === "matched") {
    const summary = el("div", "result-summary");
    const title = el("div", "status-line");
    title.append(el("span", "status-badge", `${data.cards.length} профиль`), el("h3", "", data.title));
    summary.append(title, el("p", "summary-text", data.message));
    const tags = el("div", "query-tags");
    const q = data.query;
    [labelFor("cities", q.city), formatDate(q.date), labelFor("events", q.event), ...(q.language ? [labelFor("languages", q.language)] : []), ...(q.hours !== null ? [`${q.hours} сағат`] : [])].forEach(text => tags.append(el("span", "query-tag", text)));
    summary.append(tags);
    const cards = el("div", "cards");
    data.cards.forEach((card, i) => cards.append(cardView(card, i)));
    results.append(summary, cards);
  } else {
    const empty = el("div", "empty-state");
    empty.append(el("span", "empty-icon", data.status === "no_category" ? "∅" : "—"), el("h3", "", data.title), el("p", "", data.message));
    results.append(empty);
  }
  if (data.rejected_count) {
    const diagnostics = el("section", "diagnostics");
    diagnostics.append(el("h4", "", `Неліктен ${data.rejected_count} профиль өтпеді?`));
    const reasons = el("ul", "reason-list");
    data.reason_counts.forEach(reason => {
      const li = el("li", "", reason.label);
      li.append(el("strong", "", String(reason.count)));
      reasons.append(li);
    });
    diagnostics.append(reasons, el("p", "diagnostic-note", "Сандар қабаттасуы мүмкін: бір профиль бірнеше шарттан өтпеуі мүмкін. Бос емес күндер каталог күнтізбесінен алынды."));
    const details = el("details", "rejections");
    details.append(el("summary", "", "Әр профильдің нақты себебін көру"));
    const list = el("ul");
    data.rejected.forEach(profile => {
      const li = el("li");
      li.append(el("strong", "", profile.name), el("span", "rejection-id", ` (${profile.id})`), document.createTextNode(` — ${profile.reasons.map(reason => reason.detail).join(" ")}`));
      list.append(li);
    });
    details.append(list);
    diagnostics.append(details);
    results.append(diagnostics);
  }
}

async function search(query = readForm()) {
  resetRequest();
  const version = requestVersion;
  const controller = new AbortController();
  activeRequest = controller;
  submit.disabled = true;
  submit.textContent = "Іріктеліп жатыр…";
  errorBox.hidden = true;
  results.setAttribute("aria-busy", "true");
  results.replaceChildren(el("div", "empty-state", "Каталогтан сәйкес профильдер ізделіп жатыр…"));
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("/api/match", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(query), signal: controller.signal});
    const data = await response.json();
    if (version !== requestVersion) return;
    if (!response.ok) throw new Error(data.error || "Сұранысты орындау мүмкін болмады.");
    render(data);
    return data;
  } catch (error) {
    if (version !== requestVersion) return;
    const message = error.name === "AbortError" ? "Жауап кешікті. Сервердің қосулы екенін тексеріп, қайта көріңіз." : error instanceof TypeError ? "Серверге қосылмады. Терминалдағы серверді тексеріп, қайта көріңіз." : error.message;
    errorBox.textContent = message;
    errorBox.hidden = false;
    const empty = el("div", "empty-state");
    empty.append(el("h3", "", "Іріктеу орындалмады"), el("p", "", message));
    results.replaceChildren(empty);
  } finally {
    clearTimeout(timeout);
    if (version === requestVersion) resetRequest();
  }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  if (form.reportValidity()) void search();
});

function fillForm(query) {
  for (const key of ["city", "date", "event", "category", "budget", "language", "hours"]) {
    form.elements.namedItem(key).value = query[key] ?? "";
  }
}
document.querySelectorAll("[data-example]").forEach(button => button.addEventListener("click", () => {
  const base = {city: "Алматы", date: "2026-09-23", event: "свадьба", category: "Ведущий", budget: 2000000, language: null, hours: null};
  if (button.dataset.example === "rare") { base.category = "Флорист"; base.hours = 12; }
  if (button.dataset.example === "empty") base.budget = 10000;
  fillForm(base);
  void search();
}));

async function init() {
  try {
    const response = await fetch("/api/catalog");
    if (!response.ok) throw new Error("Каталогты жүктеу мүмкін болмады.");
    catalog = await response.json();
    for (const [id, key] of [["city", "cities"], ["category", "categories"], ["event", "events"], ["language", "languages"]]) {
      const select = document.getElementById(id);
      catalog[key].forEach(item => {
        const option = el("option", "", item.label);
        option.value = item.value;
        select.append(option);
      });
    }
    document.querySelector("#catalog-total").textContent = catalog.total;
    document.querySelector("#date").min = catalog.min_date;
    document.querySelector("#date").max = catalog.max_date;
    document.querySelector("#flag-summary").textContent = `Каталогта ${catalog.total} профиль: ${catalog.flags.synthetic} жасанды; ${catalog.flags.city_imputed} профильде қала, ${catalog.flags.price_imputed} профильде баға дайындау кезінде толтырылған. Белгілер бір профильде қатар кездесуі мүмкін.`;
    fields.disabled = false;
    document.querySelectorAll("[data-example]").forEach(button => { button.disabled = false; });
    await search();
  } catch {
    results.setAttribute("aria-busy", "false");
    const state = el("div", "empty-state");
    state.append(el("h3", "", "Каталог жүктелмеді"), el("p", "", "Қосымшаны сервер арқылы ашыңыз: python3 event-match/server.py. Терминалдағы қате хабарын тексеріңіз."));
    const retry = el("button", "retry-button", "Қайта жүктеу");
    retry.type = "button";
    retry.addEventListener("click", () => window.location.reload());
    state.append(retry);
    results.replaceChildren(state);
  }
}
void init();
