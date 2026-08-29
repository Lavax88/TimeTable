from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import base64


def fetch_github_file(token, repo, path, ref=None):
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    if ref:
        url += f"?ref={ref}"
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
        # 1. Try reading local data.json packaged with deployment
        try:
            local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data.json")
            if os.path.exists(local_path):
                with open(local_path, "r", encoding="utf-8") as f:
                    local_data = json.load(f)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.end_headers()
                self.wfile.write(json.dumps(local_data, indent=2, ensure_ascii=False).encode())
                return
        except Exception:
            pass

        token = os.environ.get("GITHUB_TOKEN")
        repo = os.environ.get("GITHUB_REPO")
        ref = os.environ.get("VERCEL_GIT_COMMIT_REF") or os.environ.get("GITHUB_BRANCH") or "Dev"
        if not token or not repo:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "GitHub not configured"}).encode())
            return

        try:
            data = fetch_github_file(token, repo, "data.json", ref=ref)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
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