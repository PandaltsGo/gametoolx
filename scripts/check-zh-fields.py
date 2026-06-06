"""List all fields in tool JSON missing zh"""
import json
from pathlib import Path

p = Path(r"D:\Idea Project\gametoolx\data\tools\octopath-traveler-2-job-recommender.json")
data = json.loads(p.read_text(encoding="utf-8"))

missing = []
for j in data["data"]["jobs"]:
    for field in ["name", "description"]:
        if "zh" not in j.get(field, {}):
            missing.append(("job", j["id"], field, j.get(field, {}).get("en", "")[:60]))

for r in data["data"]["recommendations"]:
    for field in ["name", "reason"]:
        if "zh" not in r.get(field, {}):
            missing.append(("rec", r["playstyle"], field, r.get(field, {}).get("en", "")[:60]))

print(f"missing zh fields: {len(missing)}")
for kind, key, field, en in missing:
    print(f"  {kind}.{key}.{field}: {en}")
