"""验证 tools JSON 合法性和统计"""
import json
import sys

path = r"D:\Idea Project\gametoolx\data\tools\octopath-traveler-2-job-recommender.json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"✅ JSON 合法")
print(f"slug: {data['slug']}")
print(f"type: {data['type']}")
print(f"jobs: {len(data['data']['jobs'])}")
print(f"recommendations: {len(data['data']['recommendations'])}")
print(f"playstyles: {sorted(set(r['playstyle'] for r in data['data']['recommendations']))}")

# 统计待翻译字段
empty_ja = empty_ko = 0
for job in data['data']['jobs']:
    empty_ja += 1 if job['name'].get('ja') == '' else 0
    empty_ko += 1 if job['name'].get('ko') == '' else 0
    empty_ja += 1 if job.get('description', {}).get('ja') == '' else 0
    empty_ko += 1 if job.get('description', {}).get('ko') == '' else 0
for r in data['data']['recommendations']:
    empty_ja += 1 if r['name'].get('ja') == '' else 0
    empty_ko += 1 if r['name'].get('ko') == '' else 0
    empty_ja += 1 if r['reason'].get('ja') == '' else 0
    empty_ko += 1 if r['reason'].get('ko') == '' else 0
empty_ja += 1 if data['title'].get('ja') == '' else 0
empty_ko += 1 if data['title'].get('ko') == '' else 0
empty_ja += 1 if data['description'].get('ja') == '' else 0
empty_ko += 1 if data['description'].get('ko') == '' else 0

print(f"\n待翻译字段:")
print(f"  ja: {empty_ja}")
print(f"  ko: {empty_ko}")
