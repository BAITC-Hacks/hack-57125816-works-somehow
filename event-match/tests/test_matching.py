import copy
import csv
import json
import random
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog import CSV_PATH, FIELDS, load_catalog, load_facts
from examples import BASE, EXAMPLES
from matching import RequestError, match_profiles, rejection_reasons, validate_request


class MatchingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profiles = load_catalog()
        cls.facts = load_facts(cls.profiles)
        cls.by_id = {p["id"]: p for p in cls.profiles}

    def run_query(self, **changes):
        return match_profiles(self.profiles, self.facts, dict(BASE, **changes))

    def test_real_csv_structure_and_flags(self):
        self.assertEqual(len(self.profiles), 66)
        self.assertEqual(len({c for p in self.profiles for c in p["categories"]}), 17)
        self.assertEqual(sum(p["max_hours"] is None for p in self.profiles), 9)
        self.assertEqual([sum(p[key] for p in self.profiles) for key in ("synthetic", "city_imputed", "price_imputed")], [13, 8, 18])
        for p in self.profiles:
            self.assertIsInstance(p["synthetic"], bool)
            self.assertIsInstance(p["price_from_kzt"], int)

    def test_eight_real_examples(self):
        for name, query, status, ids in EXAMPLES:
            with self.subTest(name=name):
                result = match_profiles(self.profiles, self.facts, query)
                self.assertEqual(result["status"], status)
                self.assertEqual([c["id"] for c in result["cards"]], ids)

    def test_limit_three_and_eligible_count(self):
        r = self.run_query()
        self.assertEqual((r["candidate_count"], r["eligible_count"], len(r["cards"])), (10, 4, 3))

    def test_repeat_and_shuffled_catalog_are_identical(self):
        expected = self.run_query()
        shuffled = list(self.profiles)
        random.Random(79).shuffle(shuffled)
        for _ in range(4):
            self.assertEqual(match_profiles(shuffled, self.facts, BASE), expected)

    def test_same_price_uses_id(self):
        cards = self.run_query(category="Лайв-бэнд")["cards"]
        self.assertEqual(cards[0]["price_from_kzt"], cards[1]["price_from_kzt"])
        self.assertEqual([c["id"] for c in cards[:2]], ["HK-23752", "HK-83709"])

    def test_changed_date_explained_by_busy_calendar(self):
        before, after = self.run_query(), self.run_query(date="2026-09-24")
        self.assertEqual(after["eligible_count"], 2)
        rejected = {p["id"]: p for p in after["rejected"]}
        for card in before["cards"]:
            self.assertIn("2026-09-24", self.by_id[card["id"]]["busy_dates"])
            self.assertIn("busy", [r["code"] for r in rejected[card["id"]]["reasons"]])
        self.assertTrue(all("24.09.2026" in c["explanation"] for c in after["cards"]))

    def test_null_max_hours_not_zero_and_still_checks_busy(self):
        cards = self.run_query(category="Флорист", hours=100)["cards"]
        self.assertEqual(len(cards), 2)
        self.assertTrue(all(c["max_hours"] is None for c in cards))
        self.assertTrue(all("ұзақтығы қолданылмайды" in c["explanation"] for c in cards))
        r = self.run_query(category="Флорист", hours=100, date="2026-09-25")
        self.assertEqual(r["status"], "no_match")
        self.assertEqual(r["reason_counts"], [{"code": "busy", "label": "Таңдалған күні бос емес", "count": 2}])

    def test_rare_category_explains_small_catalog(self):
        r = self.run_query(category="Флорист", hours=12)
        self.assertEqual((r["candidate_count"], r["eligible_count"]), (2, 2))
        self.assertIn("бар болғаны 2", r["message"])

    def test_no_category_is_different_from_no_match(self):
        absent = self.run_query(city="Астана", category="Декоратор")
        failed = self.run_query(budget=10000)
        self.assertEqual((absent["status"], absent["candidate_count"]), ("no_category", 0))
        self.assertEqual((failed["status"], failed["candidate_count"]), ("no_match", 10))
        self.assertEqual({r["code"]: r["count"] for r in failed["reason_counts"]}, {"busy": 4, "budget": 10, "event": 4})

    def test_all_100_days_never_recommend_busy_profiles(self):
        for offset in range(100):
            day = (date(2026, 9, 23) + timedelta(days=offset)).isoformat()
            for category in ("Ведущий", "Банкетный зал", "Флорист"):
                result = self.run_query(date=day, category=category)
                for card in result["cards"]:
                    self.assertNotIn(day, self.by_id[card["id"]]["busy_dates"])

    def test_venue_uses_same_busy_rules(self):
        venues = [p for p in self.profiles if "Банкетный зал" in p["categories"]]
        for p in venues:
            query = dict(BASE, city=p["city"], category="Банкетный зал", date=p["busy_dates"][0], event=p["event_formats"][0], budget=10000000)
            result = match_profiles(self.profiles, self.facts, query)
            self.assertNotIn(p["id"], [c["id"] for c in result["cards"]])

    def test_language_duration_event_budget_boundaries(self):
        p = self.by_id["HK-44923"]
        query = validate_request(dict(BASE, budget=p["price_from_kzt"], hours=p["max_hours"], language=p["languages"][0]))
        self.assertEqual(rejection_reasons(p, query), [])
        for field, value, code in (("budget", p["price_from_kzt"] - 1, "budget"), ("hours", p["max_hours"] + .5, "duration")):
            reasons = rejection_reasons(p, dict(query, **{field: value}))
            self.assertIn(code, [reason["code"] for reason in reasons])
        for field, value, code in (("language", "английский", "language"), ("event", "конференция", "event")):
            # Осы профильде жоқ мәнді нақты деректен тексереміз.
            key = "languages" if field == "language" else "event_formats"
            if value not in p[key]:
                self.assertIn(code, [r["code"] for r in rejection_reasons(p, dict(query, **{field: value}))])

    def test_language_and_duration_are_applied_to_every_result(self):
        for language in (None, "казахский", "русский", "английский"):
            for hours in (None, 3, 8, 13):
                r = self.run_query(language=language, hours=hours)
                for c in r["cards"]:
                    p = self.by_id[c["id"]]
                    if language:
                        self.assertIn(language, p["languages"])
                    if hours is not None and p["max_hours"] is not None:
                        self.assertLessEqual(hours, p["max_hours"])
                    self.assertIn("свадьба", p["event_formats"])

    def test_description_does_not_expand_structured_formats(self):
        p = self.by_id["HK-35215"]
        self.assertNotIn("конференция", p["event_formats"])
        self.assertIn("event", [r["code"] for r in rejection_reasons(p, dict(BASE, date="2026-09-24", event="конференция", language=None, hours=None))])

    def test_valid_date_boundaries_and_invalid_dates(self):
        for day in ("2026-09-23", "2026-12-31"):
            self.run_query(date=day)
        for day in ("2026-09-22", "2027-01-01", "2026-09-31", "2026-9-23", "", None, 20260923):
            with self.subTest(day=day), self.assertRaises(RequestError):
                self.run_query(date=day)

    def test_invalid_request_values(self):
        for key, values in {
            "budget": [-1, True, 1.5, "1000", None, float("nan"), float("inf")],
            "hours": [0, -1, True, "6", float("nan"), float("inf"), 10**400],
            "language": ["қате", 4, []], "city": [None, [], "Шымкент"],
            "category": [None, "қате"], "event": [None, "қате"],
        }.items():
            for value in values:
                with self.subTest(key=key, value=value), self.assertRaises(RequestError):
                    self.run_query(**{key: value})
        for bad in ([], None, "text", dict(BASE, api_key="unused")):
            with self.assertRaises(RequestError):
                validate_request(bad)

    def test_evidence_flags_and_price_are_from_csv(self):
        for p in self.profiles:
            fact = self.facts[p["id"]]
            self.assertIn(fact["source"], p["description"])
            self.assertTrue(fact["kk"])
        for c in self.run_query(category="Флорист")["cards"]:
            p = self.by_id[c["id"]]
            self.assertEqual(c["price_from_kzt"], p["price_from_kzt"])
            self.assertTrue(c["price_label"].endswith("теңгеден бастап"))
            self.assertEqual(c["flags"], {k: p[k] for k in ("synthetic", "city_imputed", "price_imputed")})

    def test_explanations_have_distinct_source_facts(self):
        cards = self.run_query()["cards"]
        self.assertEqual(len({c["evidence"] for c in cards}), 3)
        self.assertEqual(len({self.facts[c["id"]]["kk"] for c in cards}), 3)
        self.assertTrue(all(c["explanation"].startswith("Профиль сипаттамасы бойынша,") for c in cards))

    def test_selection_does_not_depend_on_explanation_wording(self):
        other = copy.deepcopy(self.facts)
        for fact in other.values():
            fact["kk"] = "тексеру мәтіні"
        result = match_profiles(self.profiles, other, BASE)
        self.assertEqual([c["id"] for c in result["cards"]], [c["id"] for c in self.run_query()["cards"]])
        self.assertEqual(result["explanation_mode"], "catalog_only")

    def test_malformed_csv_fails_instead_of_inventing_values(self):
        with CSV_PATH.open(encoding="utf-8-sig", newline="") as file:
            original = list(csv.DictReader(file))[0]
        for key, value in (("price_from_kzt", ""), ("synthetic", "Maybe"), ("busy_dates", "2027-01-01"), ("max_hours", "0")):
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "bad.csv"
                with path.open("w", encoding="utf-8", newline="") as file:
                    writer = csv.DictWriter(file, fieldnames=FIELDS)
                    writer.writeheader()
                    writer.writerow(dict(original, **{key: value}))
                with self.subTest(field=key), self.assertRaises(ValueError):
                    load_catalog(path)


if __name__ == "__main__":
    unittest.main()
