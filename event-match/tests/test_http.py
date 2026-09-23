import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog import load_catalog, load_facts
from examples import BASE
from server import make_handler


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        p = load_catalog()
        handler = make_handler(p, load_facts(p))
        handler.log_message = lambda *args: None
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:{}".format(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def post(self, value):
        return urlopen(Request(self.base + "/api/match", data=json.dumps(value).encode(), headers={"Content-Type": "application/json"}), timeout=3)

    def test_catalog_and_assets(self):
        with urlopen(self.base + "/api/catalog", timeout=3) as response:
            data = json.load(response)
            self.assertEqual(data["total"], 66)
        for route, marker in (("/", 'lang="kk"'), ("/app.js", "use strict"), ("/styles.css", ":root")):
            with urlopen(self.base + route, timeout=3) as response:
                self.assertIn(marker, response.read().decode())
                self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])

    def test_valid_match_without_api_key(self):
        with self.post(BASE) as response:
            result = json.load(response)
        self.assertEqual([c["id"] for c in result["cards"]], ["HK-44923", "HK-42352", "HK-27222"])

    def test_invalid_input_returns_kazakh_error(self):
        with self.assertRaises(HTTPError) as error:
            self.post(dict(BASE, date="2027-01-01"))
        self.assertEqual(error.exception.code, 400)
        self.assertIn("23.09.2026", json.load(error.exception)["error"])

    def test_private_files_are_not_served(self):
        for path in ("/.env", "/../catalog.py", "/server.py", "/profile_facts.json", "/tests/test_http.py"):
            with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                urlopen(self.base + path, timeout=3)
            self.assertEqual(error.exception.code, 404)

    def test_malformed_json(self):
        request = Request(self.base + "/api/match", data=b'{"city":', headers={"Content-Type": "application/json"})
        with self.assertRaises(HTTPError) as error:
            urlopen(request, timeout=3)
        self.assertEqual(error.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
