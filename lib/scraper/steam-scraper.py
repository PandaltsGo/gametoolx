"""
steam-scraper.py
抓取 Steam 游戏的元数据和系统配置要求，输出 JSON。

用法:
    python steam-scraper.py --appid 1971650 --output data/games/octopath-traveler-2.json
    python steam-scraper.py --appid 1971650 --output -  # 打印到 stdout

输出格式:
    {
      "slug": "octopath-traveler-2",
      "title": { "en": "Octopath Traveler II" },
      "steamAppId": 1971650,
      "systemRequirements": {
        "minimum": { "os": "...", "cpu": "...", "gpu": "...", "ram": "...", "storage": "..." },
        "recommended": { ... }
      },
      "releaseDate": "2023-02-24",
      "genres": ["rpg", "jrpg"]
    }

数据源: Steam 官方 API (/api/appdetails)
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.error

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("需要 beautifulsoup4: pip install beautifulsoup4", file=sys.stderr)
    sys.exit(1)


STEAM_API = "https://store.steampowered.com/api/appdetails"
USER_AGENT = "GameToolX/1.0 (Steam scraper; +https://github.com/PandaltsGo/gametoolx)"


def fetch_app_details(appid: str) -> dict:
    """调 Steam API 拿应用详情"""
    url = f"{STEAM_API}?appids={appid}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def slugify(name: str) -> str:
    """'Octopath Traveler II' -> 'octopath-traveler-2'"""
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s


# Steam 配置项的常见 key（中英对照，用于解析 HTML <li>）
REQ_KEY_MAP = {
    "os": "os",
    "operating system": "os",
    "processor": "cpu",
    "memory": "ram",
    "graphics": "gpu",
    "directx": "directx",
    "network": "network",
    "storage": "storage",
    "sound card": "sound",
    "additional notes": "notes",
}


def parse_requirements(html_str: str | None) -> dict | None:
    """
    解析 Steam 配置要求 HTML，返回结构化 dict。
    Steam 的 pc_requirements.minimum/recommended 是 HTML 字符串，里面是 <ul><li>Key: Value</li></ul>。
    """
    if not html_str or not html_str.strip():
        return None
    soup = BeautifulSoup(html_str, "html.parser")
    items = {}
    for li in soup.find_all("li"):
        text = li.get_text(" ", strip=True)
        if ":" not in text:
            continue
        key, _, val = text.partition(":")
        key = key.strip().lower()
        val = val.strip()
        mapped = REQ_KEY_MAP.get(key)
        if mapped:
            items[mapped] = val
    return items or None


def fetch_steam_tags(appid: str) -> list[str]:
    """备用：从 Steam 商店页 HTML 拿 tags"""
    url = f"https://store.steampowered.com/app/{appid}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  warn: 拿 tags 失败: {e}", file=sys.stderr)
        return []
    soup = BeautifulSoup(html, "html.parser")
    tags = []
    for a in soup.select(".glance_tags a"):
        t = a.get_text(strip=True)
        if t and t not in tags:
            tags.append(t)
    return tags


def build_game(appid: str) -> dict:
    data = fetch_app_details(appid)
    payload = data.get(str(appid), {})
    if not payload.get("success"):
        raise RuntimeError(f"Steam API 失败: {payload}")

    app = payload["data"]
    pc_req = app.get("pc_requirements", {}) or {}

    game = {
        "slug": slugify(app.get("name", "")),
        "title": {"en": app.get("name", "")},
        "steamAppId": int(appid),
        "releaseDate": app.get("release_date", {}).get("date"),
        "genres": [g.get("description") for g in app.get("genres", []) if g.get("description")],
        "systemRequirements": {
            "minimum": parse_requirements(pc_req.get("minimum")),
            "recommended": parse_requirements(pc_req.get("recommended")),
        },
    }

    # 拿不到配置要求时，从商店页补
    if not (game["systemRequirements"]["minimum"] or game["systemRequirements"]["recommended"]):
        print("  warn: API 没返配置，尝试商店页...", file=sys.stderr)
        tags = fetch_steam_tags(appid)
        if tags:
            game["genres"] = tags[:5]

    return game


def main():
    p = argparse.ArgumentParser(description="Steam 游戏数据爬虫")
    p.add_argument("--appid", required=True, help="Steam App ID")
    p.add_argument("--output", required=True, help="输出 JSON 路径（用 - 表示 stdout）")
    args = p.parse_args()

    print(f"抓取 Steam AppID={args.appid} ...")
    game = build_game(args.appid)
    print(f"  name: {game['title']['en']}")
    print(f"  slug: {game['slug']}")
    print(f"  release: {game.get('releaseDate')}")

    js = json.dumps(game, ensure_ascii=False, indent=2)
    if args.output == "-":
        print(js)
    else:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(js)
            f.write("\n")
        print(f"✅ 写入 {args.output}")


if __name__ == "__main__":
    main()
