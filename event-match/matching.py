"""Іріктеу және қазақша түсіндірме: тек каталог, тұрақты ережелер."""

import math
from collections import Counter

from catalog import CATEGORIES, CITIES, EVENTS, LANGUAGES, valid_date

REASON_LABELS = {
    "busy": "Таңдалған күні бос емес", "budget": "Бастапқы бағасы бюджеттен жоғары",
    "event": "Іс-шара түрін қабылдамайды", "language": "Таңдалған тіл көрсетілмеген",
    "duration": "Ұзақтық шегінен асады",
}


class RequestError(ValueError):
    pass


def money(value):
    return format(value, ",").replace(",", " ")


def day_label(value):
    return ".".join(reversed(value.split("-")))


def validate_request(raw):
    if not isinstance(raw, dict):
        raise RequestError("Сұраныс нысан түрінде берілуі керек.")
    if set(raw) - {"city", "date", "category", "event", "budget", "language", "hours"}:
        raise RequestError("Сұраныста белгісіз өріс бар.")
    query = {}
    for key, labels, label in (("city", CITIES, "Қаланы"), ("category", CATEGORIES, "Санатты"), ("event", EVENTS, "Іс-шара түрін")):
        value = raw.get(key)
        if not isinstance(value, str) or value not in labels:
            raise RequestError(label + " тізімнен таңдаңыз.")
        query[key] = value
    if not valid_date(raw.get("date")):
        raise RequestError("Күнді 23.09.2026–31.12.2026 аралығынан таңдаңыз.")
    query["date"] = raw["date"]
    budget = raw.get("budget")
    if type(budget) is not int or not 0 <= budget <= 9_007_199_254_740_991:
        raise RequestError("Бюджетті 0 немесе одан үлкен бүтін теңгемен жазыңыз.")
    query["budget"] = budget
    language = raw.get("language")
    if language is not None and (not isinstance(language, str) or (language != "" and language not in LANGUAGES)):
        raise RequestError("Тілді тізімнен таңдаңыз немесе бос қалдырыңыз.")
    query["language"] = language or None
    hours = raw.get("hours")
    if hours is not None and (type(hours) not in (int, float) or not 0 < hours <= 9_007_199_254_740_991 or not math.isfinite(hours)):
        raise RequestError("Ұзақтық оң сан болуы керек; қажет болмаса, бос қалдырыңыз.")
    query["hours"] = hours
    return query


def rejection_reasons(profile, query):
    reasons = []
    if query["date"] in profile["busy_dates"]:
        reasons.append({"code": "busy", "detail": day_label(query["date"]) + " күні каталогта бос емес деп белгіленген."})
    if profile["price_from_kzt"] > query["budget"]:
        reasons.append({"code": "budget", "detail": "{} теңгеден бастап; бюджет — {} теңге.".format(money(profile["price_from_kzt"]), money(query["budget"]))})
    if query["event"] not in profile["event_formats"]:
        reasons.append({"code": "event", "detail": "«{}» түрі профильде көрсетілмеген.".format(EVENTS[query["event"]])})
    if query["language"] and query["language"] not in profile["languages"]:
        reasons.append({"code": "language", "detail": "{} жұмыс істеуі профильде көрсетілмеген.".format(LANGUAGES[query["language"]])})
    if query["hours"] is not None and profile["max_hours"] is not None and query["hours"] > profile["max_hours"]:
        reasons.append({"code": "duration", "detail": "Сұралғаны — {:g} сағат; профиль шегі — {} сағат.".format(query["hours"], profile["max_hours"])})
    return reasons


def explain(profile, query, fact):
    # Бірінші сөйлем — нақты сипаттаманың қазақша мазмұны; екіншісі — тексерілген шарттар.
    distinctive = "Профиль сипаттамасы бойынша, {}.".format(fact["kk"].rstrip(". "))
    checks = [
        "«{}» түрін қабылдайды".format(EVENTS[query["event"]]),
        "{} теңгеден басталатын бағасы {} теңге бюджетке сыяды".format(money(profile["price_from_kzt"]), money(query["budget"])),
        "{} күні бос емес деп белгіленбеген".format(day_label(query["date"])),
    ]
    if query["language"]:
        checks.append("{} жұмыс істейді".format(LANGUAGES[query["language"]].lower()))
    if profile["max_hours"] is None:
        checks.append("бұл қызметке алаңда болу ұзақтығы қолданылмайды")
    elif query["hours"] is not None:
        checks.append("{:g} сағат сұраныс {} сағаттық шегіне сыяды".format(query["hours"], profile["max_hours"]))
    return distinctive + " " + "; ".join(checks) + "."


def match_profiles(profiles, facts, raw):
    query = validate_request(raw)
    candidates = sorted((p for p in profiles if p["city"] == query["city"] and query["category"] in p["categories"]), key=lambda p: p["id"])
    accepted, rejected = [], []
    counts = Counter()
    for profile in candidates:
        reasons = rejection_reasons(profile, query)
        if reasons:
            rejected.append({"id": profile["id"], "name": profile["anon_name"], "reasons": reasons})
            counts.update(reason["code"] for reason in reasons)
        else:
            accepted.append(profile)
    # Екі ғана салыстыру кілті. CSV жолдарының орны, уақыт, random немесе AI әсер етпейді.
    accepted.sort(key=lambda profile: (profile["price_from_kzt"], profile["id"]))
    cards = []
    for profile in accepted[:3]:
        fact = facts[profile["id"]]
        cards.append({
            "id": profile["id"], "name": profile["anon_name"],
            "category": CATEGORIES[query["category"]],
            "categories": [CATEGORIES[c] for c in profile["categories"]],
            "city": CITIES[profile["city"]], "price_from_kzt": profile["price_from_kzt"],
            "price_label": money(profile["price_from_kzt"]) + " теңгеден бастап",
            "languages": [LANGUAGES[l] for l in profile["languages"]], "max_hours": profile["max_hours"],
            "explanation": explain(profile, query, fact), "evidence": fact["source"],
            "flags": {key: profile[key] for key in ("synthetic", "city_imputed", "price_imputed")},
        })
    status = "no_category" if not candidates else "matched" if cards else "no_match"
    if status == "no_category":
        title = "Бұл қалада мұндай санат жоқ"
        message = "{} қаласы / «{}»: каталогта бірде-бір профиль жоқ. Қаланы немесе санатты өзгертіңіз.".format(CITIES[query["city"]], CATEGORIES[query["category"]])
    elif status == "no_match":
        title = "Профильдер бар, бірақ шарттардан өтпеді"
        message = "Қала мен санатқа сәйкес {} профильдің ешқайсысы барлық шарттан өтпеді. Төмендегі себептерге қарай шарттарды өзгертіп көріңіз.".format(len(candidates))
    else:
        title = "Сәйкес профильдер табылды"
        if len(accepted) < 3:
            if rejected:
                message = "{} профильдің {}-і сәйкес келді, {}-і шарттардан өтпеді. Сондықтан {} карточка көрсетілді.".format(len(candidates), len(accepted), len(rejected), len(cards))
            else:
                message = "Бұл қалада осы санат бойынша бар болғаны {} профиль бар; барлығы шарттарға сай. Сондықтан {} карточка көрсетілді.".format(len(candidates), len(cards))
        else:
            message = "{} профильдің {}-і барлық шарттан өтті. Бастапқы бағасы төмен алғашқы 3 профиль көрсетілді.".format(len(candidates), len(accepted))
    return {
        "status": status, "title": title, "message": message, "query": query,
        "candidate_count": len(candidates), "eligible_count": len(accepted), "rejected_count": len(rejected),
        "cards": cards, "rejected": rejected,
        "reason_counts": [{"code": code, "label": label, "count": counts[code]} for code, label in REASON_LABELS.items() if counts[code]],
        "explanation_mode": "catalog_only",
    }
