from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import base64


def fetch_github_file(token, repo, path):
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "KTU-Timetable-Data"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        file_data = json.loads(resp.read().decode())
    raw = base64.b64decode(file_data["content"]).decode("utf-8")
    return json.loads(raw)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        token = os.environ.get("GITHUB_TOKEN")
        repo = os.environ.get("GITHUB_REPO")
        if not token or not repo:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "GitHub not configured"}).encode())
            return

        try:
            data = fetch_github_file(token, repo, "data.json")
            try:
                events = fetch_github_file(token, repo, "events.json")
                data["EVENTS"] = events.get("EVENTS", [])
                data["HOLIDAYS"] = events.get("HOLIDAYS", [])
            except Exception:
                data["EVENTS"] = []
                data["HOLIDAYS"] = []

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=300")
            self.end_headers()
            self.wfile.write(json.dumps(data, indent=2, ensure_ascii=False).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()