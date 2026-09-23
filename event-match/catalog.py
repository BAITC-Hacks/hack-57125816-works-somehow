"""Нақты CSV-ді тексеріп оқу. Сыртқы кітапхана қажет емес."""

import csv
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT.parent / "hackathon dataset anonymized .csv"
MIN_DATE = "2026-09-23"
MAX_DATE = "2026-12-31"
FIELDS = (
    "id", "anon_name", "categories", "city", "city_imputed", "synthetic",
    "price_from_kzt", "price_imputed", "event_formats", "languages",
    "max_hours", "busy_dates", "description",
)
CATEGORIES = {
    "Ведущий": "Іс-шара жүргізушісі", "Ведущий церемонии": "Рәсім жүргізушісі",
    "Фотограф": "Фотограф", "Видеограф": "Бейнеоператор", "Флорист": "Флорист",
    "Декоратор": "Безендіруші", "Подарки и сувениры": "Сыйлықтар мен кәдесыйлар",
    "Инструменталист": "Аспапта орындаушы", "Лайв-бэнд": "Жанды музыка тобы",
    "Национальный ансамбль": "Ұлттық ансамбль", "Танцевальный коллектив": "Би ұжымы",
    "Шоу-программа": "Шоу-бағдарлама", "Фото и видеобудки": "Фото және бейнебудкалар",
    "Банкетный зал": "Банкет залы", "Загородная площадка": "Қала сыртындағы алаң",
    "Ресторан": "Мейрамхана", "Отель": "Қонақүй",
}
CITIES = {"Алматы": "Алматы", "Астана": "Астана", "Зарубежье": "Шетел"}
EVENTS = {
    "свадьба": "Үйлену тойы", "той": "Той", "корпоратив": "Корпоратив",
    "конференция": "Конференция", "юбилей": "Мерейтой", "день рождения": "Туған күн",
}
LANGUAGES = {"казахский": "Қазақша", "русский": "Орысша", "английский": "Ағылшынша"}


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return MIN_DATE <= value <= MAX_DATE


def load_catalog(path=CSV_PATH):
    profiles, seen = [], set()
    with Path(path).open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if tuple(reader.fieldnames or ()) != FIELDS:
            raise ValueError("CSV бағандары күтілген құрылымға сәйкес емес.")
        for line, row in enumerate(reader, start=2):
            prefix = "CSV, {}-жол: ".format(line)
            if None in row or any(value is None for value in row.values()):
                raise ValueError(prefix + "баған саны дұрыс емес.")
            profile = {key: value.strip() for key, value in row.items()}
            if not re.fullmatch(r"HK-\d+", profile["id"]) or profile["id"] in seen:
                raise ValueError(prefix + "id қате немесе қайталанған.")
            seen.add(profile["id"])
            if not profile["anon_name"] or not profile["description"]:
                raise ValueError(prefix + "аты немесе сипаттамасы бос.")
            for key in ("synthetic", "city_imputed", "price_imputed"):
                if profile[key] not in ("True", "False"):
                    raise ValueError(prefix + key + " True/False болуы керек.")
                profile[key] = profile[key] == "True"
            for key in ("categories", "event_formats", "languages", "busy_dates"):
                profile[key] = tuple(part.strip() for part in profile[key].split("|") if part.strip())
            for key, labels in (("categories", CATEGORIES), ("event_formats", EVENTS), ("languages", LANGUAGES)):
                if not profile[key] or any(value not in labels for value in profile[key]):
                    raise ValueError(prefix + key + " ішінде белгісіз мән бар.")
            if profile["city"] not in CITIES:
                raise ValueError(prefix + "қала белгісіз.")
            if not profile["price_from_kzt"].isdigit():
                raise ValueError(prefix + "бастапқы баға бүтін сан болуы керек.")
            profile["price_from_kzt"] = int(profile["price_from_kzt"])
            hours = profile["max_hours"]
            if hours and (not hours.isdigit() or int(hours) <= 0):
                raise ValueError(prefix + "max_hours оң бүтін сан немесе бос болуы керек.")
            # Бос мән — 0 емес, бұл қызметке алаңда болу ұзақтығы қолданылмайды.
            profile["max_hours"] = int(hours) if hours else None
            if any(not valid_date(day) for day in profile["busy_dates"]):
                raise ValueError(prefix + "busy_dates ішінде қате күн бар.")
            profiles.append(profile)
    if not profiles:
        raise ValueError("Каталог бос.")
    return tuple(profiles)


def load_facts(profiles, path=ROOT / "profile_facts.json"):
    with Path(path).open(encoding="utf-8") as source:
        facts = json.load(source)
    if set(facts) != {profile["id"] for profile in profiles}:
        raise ValueError("Қазақша ерекшеліктер тізімі CSV профильдеріне сәйкес емес.")
    for profile in profiles:
        fact = facts[profile["id"]]
        if not fact.get("kk") or not fact.get("source") or fact["source"] not in profile["description"]:
            raise ValueError(profile["id"] + ": ерекшеліктің түпнұсқа дәлелі табылмады.")
    return facts


def catalog_options(profiles):
    def options(labels, key, multiple=False):
        actual = {item for p in profiles for item in (p[key] if multiple else (p[key],))}
        return [{"value": value, "label": label} for value, label in labels.items() if value in actual]

    return {
        "cities": options(CITIES, "city"), "categories": options(CATEGORIES, "categories", True),
        "events": options(EVENTS, "event_formats", True), "languages": options(LANGUAGES, "languages", True),
        "min_date": MIN_DATE, "max_date": MAX_DATE, "total": len(profiles),
        "flags": {key: sum(p[key] for p in profiles) for key in ("synthetic", "city_imputed", "price_imputed")},
    }
