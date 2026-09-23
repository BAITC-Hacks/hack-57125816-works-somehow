#!/usr/bin/env python3
"""Іске қосу: python3 event-match/server.py. Python 3.9+, pip қажет емес."""

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from catalog import ROOT, catalog_options, load_catalog, load_facts
from matching import RequestError, match_profiles

STATIC = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"), "/styles.css": ("styles.css", "text/css")}


def make_handler(profiles, facts):
    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, content, content_type="application/json"):
            payload = json.dumps(content, ensure_ascii=False, allow_nan=False).encode("utf-8") if content_type == "application/json" else content
            self.send_response(status)
            self.send_header("Content-Type", content_type + "; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            path = urlsplit(self.path).path
            if path == "/api/catalog":
                self.respond(200, catalog_options(profiles))
            elif path in STATIC:
                filename, content_type = STATIC[path]
                self.respond(200, (ROOT / "dist" / filename).read_bytes(), content_type)
            else:
                self.respond(404, {"error": "Бұл бет табылмады."})

        def do_POST(self):
            if urlsplit(self.path).path != "/api/match":
                self.respond(404, {"error": "Бұл мекенжай табылмады."})
                return
            if self.headers.get_content_type() != "application/json":
                self.respond(415, {"error": "Сұранысты JSON пішімінде жіберіңіз."})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if not 0 < length <= 8192:
                self.respond(400, {"error": "Сұраныс бос немесе көлемі тым үлкен."})
                return
            try:
                raw = json.loads(self.rfile.read(length).decode("utf-8"))
                result = match_profiles(profiles, facts, raw)
            except (UnicodeError, ValueError, RequestError) as error:
                message = str(error) if isinstance(error, RequestError) else "JSON сұранысын оқу мүмкін болмады. Өрістерді тексеріңіз."
                self.respond(400, {"error": message})
                return
            self.respond(200, result)

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Іс-шараға маман немесе орын таңдау")
    parser.add_argument("--port", type=int, default=8000, help="Жергілікті порт (әдепкі: 8000)")
    args = parser.parse_args()
    try:
        profiles = load_catalog()
        facts = load_facts(profiles)
        server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(profiles, facts))
    except (OSError, ValueError) as error:
        print("Іске қосылмады: {}\nПорт бос болмаса: python3 event-match/server.py --port 8001".format(error), file=sys.stderr)
        return 1
    print("Дайын: http://127.0.0.1:{} — {} профиль. Тоқтату: Control + C.".format(args.port, len(profiles)), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nҚосымша тоқтатылды.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
