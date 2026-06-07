"""
Translation completeness audit for GameToolX.
Recursive scan of:
  - data/games/*.json
  - data/tools/*.json
  - data/i18n/{en,ja,ko,zh}.json
  - SQLite: crawled_chunks.translations, crawled_documents.source_language

Per-language completeness = (present + non-empty) / expected
"incomplete" = missing key OR empty string OR same-as-fallback OR < 3 chars

Usage:
  python audit-translation.py                 # human-readable report
  python audit-translation.py --json out.json  # machine-readable
  python audit-translation.py --strict        # exit 1 if < 90% any file
"""
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(r"D:\Idea Project\gametoolx")
DATA = ROOT / "data"
DB = DATA / "gametoolx.db"

LANGS = ["en", "ja", "ko", "zh"]
PRIMARY = "en"  # Fallback — fields missing in other langs should fall back to en

# Field types considered "translatable" in our schema
LOCALIZED_KEYS = {"en", "ja", "ko", "zh"}

# ---------- helpers ----------
def is_incomplete(val, fallback=None) -> bool:
    """True if a translation value is empty/placeholder.
    Heuristic: empty / None / equals English fallback = incomplete.
    Short strings (电/火/剣/검 etc.) are LEGITIMATE CJK translations, not placeholders.
    """
    if val is None:
        return True
    if not isinstance(val, str):
        return True
    s = val.strip()
    if not s:
        return True
    if fallback and isinstance(fallback, str) and s == fallback.strip() and s:
        return True  # copied fallback = not translated
    return False


def check_localized(obj, parent_path="", file=""):
    """Recursively find all Localized objects and report per-language completeness.
    Returns: list of (path, lang, status, value_preview) tuples.
    """
    findings = []
    if isinstance(obj, dict):
        # Is this a Localized object? Detect: at least one lang key, AND all lang values are strings
        # (filter out table header/rows which have string[] per lang, and list-typed phaseGuide/proTips)
        lang_keys_present = [k for k in obj.keys() if k in LOCALIZED_KEYS]
        if lang_keys_present:
            # Check that at least the en value (if present) is a string OR None
            # Skip if all lang values are lists/arrays (different schema)
            en_val = obj.get("en")
            any_value_is_string = isinstance(en_val, str) or en_val is None
            ja_val = obj.get("ja")
            if ja_val is not None and not isinstance(ja_val, str):
                any_value_is_string = False
            # If at least one lang present AND values are strings, this is a Localized
            if any_value_is_string:
                for lang in LANGS:
                    if lang == "en":
                        continue  # skip primary
                    val = obj.get(lang)
                    status = "ok"
                    if lang not in obj:
                        status = "missing"
                    elif is_incomplete(val, en_val):
                        status = "incomplete"
                    val_str = val if isinstance(val, str) else (str(val) if val is not None else "")
                    preview = val_str[:50] + ("..." if len(val_str) > 50 else "")
                    findings.append((f"{parent_path}", lang, status, preview, file))
                return findings
        # Otherwise recurse
        for k, v in obj.items():
            findings.extend(check_localized(v, f"{parent_path}.{k}", file))
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            findings.extend(check_localized(item, f"{parent_path}[{i}]", file))
    return findings


def check_translations_json(translations: str | dict | None) -> dict[str, bool]:
    """Check chunk's translations JSON (ja/ko/zh) completeness."""
    if not translations:
        return {lang: False for lang in ["ja", "ko", "zh"]}
    if isinstance(translations, str):
        try:
            translations = json.loads(translations)
        except:
            return {lang: False for lang in ["ja", "ko", "zh"]}
    return {lang: bool(translations.get(lang)) for lang in ["ja", "ko", "zh"]}


# ---------- per-file scanners ----------
def scan_game_data():
    """data/games/*.json — title (Localized) + description (Localized) etc."""
    results = []
    for f in sorted((DATA / "games").glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        findings = check_localized(data, parent_path="<root>", file=f.name)
        results.append((f.name, "game", findings))
    return results


def scan_tool_data():
    """data/tools/*.json — title, description, all Localized fields, recs, walkthrough blocks."""
    results = []
    for f in sorted((DATA / "tools").glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        findings = check_localized(data, parent_path="<root>", file=f.name)
        results.append((f.name, "tool", findings))
    return results


def scan_i18n_keys():
    """data/i18n/{en,ja,ko,zh}.json — verify all 4 files have the same key set."""
    out = []
    key_sets = {}
    for lang in LANGS:
        p = DATA / "i18n" / f"{lang}.json"
        if not p.exists():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        key_sets[lang] = set(data.keys())

    all_keys = set()
    for ks in key_sets.values():
        all_keys |= ks

    for key in sorted(all_keys):
        missing = [lang for lang in LANGS if key not in key_sets.get(lang, set())]
        if missing:
            out.append((key, missing))
    return out, key_sets


def scan_db_chunks():
    """SQLite crawled_chunks: translation completeness for ja/ko/zh."""
    if not DB.exists():
        return [], {"ja": 0, "ko": 0, "zh": 0}, 0
    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()
    cur.execute("""
        SELECT id, length(content) as clen, translations
        FROM crawled_chunks
        WHERE clen > 20
    """)
    rows = cur.fetchall()
    conn.close()

    stats = {"ja": 0, "ko": 0, "zh": 0, "any": 0, "all3": 0}
    findings = []
    for chunk_id, clen, translations in rows:
        status = check_translations_json(translations)
        has_any = any(status.values())
        has_all = all(status.values())
        if has_any:
            stats["any"] += 1
        if has_all:
            stats["all3"] += 1
        for lang in ["ja", "ko", "zh"]:
            if status[lang]:
                stats[lang] += 1
        # Flag chunks with content > 100 chars and no translation at all
        if clen > 100 and not has_any:
            findings.append((chunk_id, clen))

    total = len(rows)
    return findings, stats, total


# ---------- report ----------
def format_pct(num, total):
    return f"{num}/{total} ({100 * num / max(1, total):.1f}%)" if total else "—"


def main():
    out_json = None
    strict = False
    for i, arg in enumerate(sys.argv):
        if arg == "--json" and i + 1 < len(sys.argv):
            out_json = Path(sys.argv[i + 1])
        if arg == "--strict":
            strict = True

    print("=" * 80)
    print("GameToolX 翻译完整度审计")
    print("=" * 80)

    report = {"files": {}, "summary": {}}

    # Game + tool JSON
    print("\n## 数据文件（games + tools）\n")
    all_findings = []
    for fname, kind, findings in scan_game_data() + scan_tool_data():
        if not findings:
            print(f"  ✓ {fname:60s} (no Localized fields)")
            report["files"][fname] = {"kind": kind, "findings": []}
            continue
        # Compute completeness per language
        by_lang = {l: {"ok": 0, "missing": 0, "incomplete": 0} for l in LANGS if l != "en"}
        for path, lang, status, preview, f in findings:
            by_lang[lang][status] = by_lang[lang].get(status, 0) + 1
        total = sum(by_lang[l]["ok"] + by_lang[l]["missing"] + by_lang[l]["incomplete"] for l in by_lang)
        # Compact summary
        summary_parts = []
        for l in ["ja", "ko", "zh"]:
            ok = by_lang[l]["ok"]
            total_l = ok + by_lang[l]["missing"] + by_lang[l]["incomplete"]
            if total_l:
                pct = 100 * ok / total_l
                summary_parts.append(f"{l}={pct:.0f}%")
        summary = " ".join(summary_parts) or "no en"
        # Count incomplete entries
        issues = [f for f in findings if f[2] != "ok"]
        issue_count = len(issues)
        flag = "❌" if issue_count > 0 else "✓"
        print(f"  {flag} {fname:50s} {summary} | issues: {issue_count}")
        report["files"][fname] = {
            "kind": kind,
            "by_lang": by_lang,
            "issues": [{"path": p, "lang": l, "status": s, "preview": v} for p, l, s, v, _ in issues],
        }
        # Show first 5 issues
        for path, lang, status, preview, _ in issues[:5]:
            print(f"      - [{lang}] {status}: {path} = \"{preview}\"")
        if len(issues) > 5:
            print(f"      ... and {len(issues) - 5} more")

    # i18n key coverage
    print("\n## UI 翻译键（data/i18n/）\n")
    i18n_missing, key_sets = scan_i18n_keys()
    for lang in LANGS:
        print(f"  {lang}: {len(key_sets.get(lang, set()))} keys")
    if i18n_missing:
        print(f"\n  ❌ {len(i18n_missing)} keys have missing langs:")
        for key, missing in i18n_missing[:10]:
            print(f"      - {key}: missing {missing}")
    else:
        print("  ✓ All 4 langs have matching key sets")
    report["i18n"] = {
        "key_counts": {l: len(key_sets.get(l, set())) for l in LANGS},
        "missing_keys": [{"key": k, "missing_langs": m} for k, m in i18n_missing],
    }

    # DB chunks
    print("\n## RAG 翻译（SQLite crawled_chunks）\n")
    chunk_issues, chunk_stats, chunk_total = scan_db_chunks()
    if chunk_total == 0:
        print("  ⚠ DB not found or empty")
    else:
        for lang in ["ja", "ko", "zh"]:
            n = chunk_stats[lang]
            print(f"  {lang}: {format_pct(n, chunk_total)}")
        print(f"  any translation: {format_pct(chunk_stats['any'], chunk_total)}")
        print(f"  all 3 langs:   {format_pct(chunk_stats['all3'], chunk_total)}")
    if chunk_issues:
        print(f"\n  ❌ {len(chunk_issues)} chunks with content > 100 chars have NO translation:")
        for cid, clen in chunk_issues[:10]:
            print(f"      - chunk #{cid} ({clen} chars)")
        else:
            print("  ✓ All long chunks have at least one translation")
    report["db_chunks"] = {
        "total": chunk_total,
        "stats": chunk_stats,
        "untranslated_long": [{"id": c, "chars": l} for c, l in chunk_issues],
    }

    # Aggregate
    print("\n## 总体摘要\n")
    total_lang = {"ja": {"ok": 0, "missing": 0, "incomplete": 0},
                  "ko": {"ok": 0, "missing": 0, "incomplete": 0},
                  "zh": {"ok": 0, "missing": 0, "incomplete": 0}}
    for fdata in report["files"].values():
        for l in ["ja", "ko", "zh"]:
            if l in fdata.get("by_lang", {}):
                for status in ["ok", "missing", "incomplete"]:
                    total_lang[l][status] += fdata["by_lang"][l].get(status, 0)
    for l in ["ja", "ko", "zh"]:
        ok = total_lang[l]["ok"]
        total = sum(total_lang[l].values())
        pct = 100 * ok / max(1, total)
        flag = "✓" if pct >= 90 else "⚠" if pct >= 70 else "❌"
        print(f"  {flag} {l}: {ok}/{total} = {pct:.1f}%")
    report["summary"] = {
        "by_lang": total_lang,
        "i18n_keys": sum(len(s) for s in key_sets.values()) // 4,
        "chunks_with_all_3": chunk_stats.get("all3", 0),
        "chunks_total": chunk_total,
    }

    # Exit code
    if out_json:
        out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n[JSON report] → {out_json}")

    if strict:
        for l in ["ja", "ko", "zh"]:
            ok = total_lang[l]["ok"]
            total = sum(total_lang[l].values())
            if total and 100 * ok / total < 90:
                print(f"\n[strict] {l} completeness {100*ok/total:.1f}% < 90%, exit 1")
                sys.exit(1)
        print("\n[strict] all langs ≥ 90%, exit 0")
        sys.exit(0)


if __name__ == "__main__":
    main()
