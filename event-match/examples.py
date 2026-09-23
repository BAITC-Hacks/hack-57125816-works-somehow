"""Нақты CSV бойынша қайталанатын демо: python3 event-match/examples.py."""

from catalog import load_catalog, load_facts
from matching import match_profiles

BASE = {"city": "Алматы", "date": "2026-09-23", "category": "Ведущий", "event": "свадьба", "budget": 2000000}
EXAMPLES = [
    ("Көп профильді санат", BASE, "matched", ["HK-44923", "HK-42352", "HK-27222"]),
    ("Сол сұраныс — келесі күн", dict(BASE, date="2026-09-24"), "matched", ["HK-35215", "HK-72938"]),
    ("Сирек санат, 12 сағат", dict(BASE, category="Флорист", hours=12), "matched", ["HK-39372", "HK-90001"]),
    ("Флористтер бос емес", dict(BASE, category="Флорист", hours=12, date="2026-09-25"), "no_match", []),
    ("Бюджет жеткіліксіз", dict(BASE, budget=10000), "no_match", []),
    ("Қалада санат жоқ", dict(BASE, city="Астана", category="Декоратор"), "no_category", []),
    ("Баға тең болса — id", dict(BASE, category="Лайв-бэнд"), "matched", ["HK-23752", "HK-83709", "HK-57480"]),
    ("Алғашқы сұранысты қайталау", BASE, "matched", ["HK-44923", "HK-42352", "HK-27222"]),
]


def main():
    profiles = load_catalog()
    facts = load_facts(profiles)
    for title, query, expected_status, expected_ids in EXAMPLES:
        result = match_profiles(profiles, facts, query)
        ids = [card["id"] for card in result["cards"]]
        if (result["status"], ids) != (expected_status, expected_ids):
            raise AssertionError("{}: күтілген нәтиже шықпады: {}".format(title, ids))
        print("✓ {}: {}".format(title, ", ".join(ids) or result["title"]))
        print("  " + result["message"])
        if result["reason_counts"]:
            print("  " + "; ".join("{}: {}".format(r["label"], r["count"]) for r in result["reason_counts"]))
    print("\nБарлық 8 мысал нақты CSV бойынша тексерілді.")


if __name__ == "__main__":
    main()
