import json, base64, urllib.request, os
from datetime import date

today = date.today().strftime("%Y-%m-%d")
token = os.environ["GH_TOKEN"]
repo = "mpbiolab/reta-site"

def api_get(path):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/contents/{path}",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def api_put(path, content_b64, message, sha=None):
    payload = {"message": message, "content": content_b64}
    if sha:
        payload["sha"] = sha
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/contents/{path}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"token {token}", "Content-Type": "application/json", "Accept": "application/vnd.github.v3+json"},
        method="PUT"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

# Lire le planning
planning_resp = api_get("planning.json")
planning = json.loads(base64.b64decode(planning_resp["content"]).decode())
planning_sha = planning_resp["sha"]

# Trouver l article du jour
article = next((a for a in planning if a["date"] == today and not a["published"]), None)
if not article:
    print(f"Aucun article a publier aujourd hui ({today})")
    exit(0)

print(f"Publication: {article["slug"]} ({today})")

# Lire depuis la queue
art_resp = api_get(f"articles_queue/{article["file"]}")

# Publier dans /blog/
# Verifier si existe deja
blog_sha = None
try:
    existing = api_get(f"blog/{article["file"]}")
    blog_sha = existing.get("sha")
except:
    pass

api_put(f"blog/{article["file"]}", art_resp["content"], f"Publish: {article["slug"]} ({today})", blog_sha)
print(f"Article publie: {article["url"]}")

# Marquer comme publie
article["published"] = True
new_content = base64.b64encode(json.dumps(planning, indent=2, ensure_ascii=False).encode()).decode()
api_put("planning.json", new_content, f"Mark published: {article["slug"]}", planning_sha)
print("Planning mis a jour")
