import json, base64, urllib.request, os
from datetime import date

today = date.today().strftime("%Y-%m-%d")
token = os.environ["GH_TOKEN"]
repo = "mpbiolab/reta-site"
headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
}

def api_get(path):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/contents/{path}", headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def api_put(path, content_b64, message, sha=None):
    payload = {"message": message, "content": content_b64}
    if sha: payload["sha"] = sha
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/contents/{path}",
        data=json.dumps(payload).encode(), headers=headers, method="PUT")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

# Lire planning
pd = api_get("planning.json")
planning = json.loads(base64.b64decode(pd["content"]).decode())

# Trouver tous les articles dus (date <= today, non publiés)
due = [a for a in planning if not a["published"] and a["date"] <= today]
if not due:
    print(f"Aucun article a publier ({today})")
    exit(0)

print(f"{len(due)} article(s) a publier...")
published = []
for article in due:
    try:
        qd = api_get(f"articles_queue/{article['file']}")
        blog_sha = None
        try:
            bd = api_get(f"blog/{article['file']}")
            blog_sha = bd.get("sha")
        except: pass
        api_put(f"blog/{article['file']}", qd["content"],
                f"Publish: {article['slug']} ({today})", blog_sha)
        article["published"] = True
        published.append(article["slug"])
        print(f"Publie: {article['url']}")
    except Exception as e:
        print(f"Erreur {article['slug']}: {e}")

# Mettre a jour planning
pd2 = api_get("planning.json")
new_plan = json.dumps(planning, indent=2, ensure_ascii=False).encode()
api_put("planning.json", base64.b64encode(new_plan).decode(),
        f"Mark published: {len(published)} articles", pd2["sha"])
print(f"Planning mis a jour ({len(published)} publie(s))")
