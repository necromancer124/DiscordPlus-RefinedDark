import http.server, os
ROOT = os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def translate_path(self, p):
        if p.startswith("/avatars/"):
            return os.path.join(ROOT, "..", "..", "preview", "assets", "avatars", os.path.basename(p.split("?")[0]))
        return super().translate_path(p)
    def send_head(self):
        # SPA fallback: Discord-style routes serve index.html
        if self.path.startswith("/channels") or self.path in ("/store", "/shop", "/quest-home", "/family-center", "/message-requests"):
            self.path = "/index.html"
        return super().send_head()
    def guess_type(self, p):
        return "text/javascript" if p.endswith(".js") else super().guess_type(p)
print("Discord+ harness: http://127.0.0.1:8766/channels/@me")
http.server.ThreadingHTTPServer(("127.0.0.1", 8766), H).serve_forever()
