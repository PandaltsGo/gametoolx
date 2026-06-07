# GameToolX — AGENTS.md

> **Audience**: any AI agent session that gets handed this project.
> **Goal**: zero-cost onboarding. By the time you finish reading this, you know the state, what to do next, and what to never do.
> **Read this first. Then read `HANDOVER.md` for the current snapshot. Then read `task planning` files in `D:\Idea Project\dream\` if relevant.**

---

## What is this

A multi-game tools platform for JP / KR / CN small-language markets. Each game has tools like system requirement checker, build advisor, endings tracker, walkthrough, route chooser, fusion calculator. Content is real Wiki / community data, never AI-fabricated. Currently 2 games live, 6 tools total, 4 languages (ja / ko / zh / en), with a RAG data layer (crawled content + FTS5 + LLM-translated chunks) ready for future AI Q&A.

**Not a content site. Not a content generator. It's a tools site that needs accurate game data.**

See `D:\Idea Project\dream\GameToolX-MVP-任务清单.md` for the MVP task plan and Go/No-Go criteria.

---

## Project root

```
D:\Idea Project\gametoolx
```

GitHub: `https://github.com/PandaltsGo/gametoolx` (master branch).

---

## Tech stack (locked)

| Component | Version | Why |
|-----------|---------|-----|
| Node.js | **v24.16.0** | 24 LTS latest patch. **Never use v26 (Current state, 2026-10 才转 LTS).** |
| Next.js | 16.2.7 | App Router + Turbopack |
| React | 19.2.4 | |
| Tailwind | v4 | |
| TypeScript | 5 | |
| DB | SQLite via `better-sqlite3` ^12 | Single instance, 100 concurrent / 10k DAU. WAL mode. |
| Search | SQLite FTS5 + `unicode61 remove_diacritics 2` | For RAG; avoids vector dep for now. |
| LLM | MiniMax-Text-01 (via `https://api.minimaxi.com/v1`) | OpenAI-compatible. Token Plan key in `D:\Idea Project\daily_on_work\_check_api.py`. |
| Image source | Steam CDN (`akamai.steamstatic.com`) | Never AI-generate game art. |
| i18n | Custom middleware (not `next-intl`) | Next 16 removed built-in i18n. We do Accept-Language → 307 redirect + cookie override. |

---

## File layout (current)

```
gametoolx/
├── app/[lang]/                        Routes (i18n dynamic segment)
│   ├── page.tsx                       Home
│   ├── games/[slug]/page.tsx          Game detail
│   ├── tools/[slug]/page.tsx          Tool dispatcher (6 tool types)
│   ├── tools/system-checker/page.tsx  Universal system checker
│   ├── search/page.tsx                FTS5 search (4-lang, source_lang badge)
│   └── api/
│       ├── progress/[tool]/[key]/route.ts   GET/POST/DELETE
│       └── system-checks/route.ts           GET/POST
├── components/
│   ├── LanguageSwitcher.tsx           JA/KO/ZH/EN pill switcher
│   └── tools/                         6 tool components
│       ├── SystemCheckerClient.tsx
│       ├── BuildRecommender.tsx
│       ├── EndingsTracker.tsx         uses DB (useProgress hook)
│       ├── Walkthrough.tsx            block renderer: heading/paragraph/callout/step/boss/table/tip
│       ├── RouteChooser.tsx           5-question quiz
│       └── FusionCalculator.tsx       60+ demon search + reverse recipe lookup
├── data/
│   ├── games/                         Game config JSON (2 files: OT2, SMT5V)
│   ├── tools/                         Tool config JSON (5 files)
│   ├── i18n/{en,ja,ko,zh}.json        4-lang, 59 keys aligned
│   ├── system-tiers.json              GPU/CPU/RAM/Storage tier definitions
│   └── gametoolx.db                   ⚠️ SQLite (gitignored, preserved locally)
├── lib/
│   ├── data.ts                        JSON loaders (getGame/getTool/listGames/...)
│   ├── db.ts                          SQLite layer + 3 migrations + FTS5 + translation API
│   └── session.ts                     Cookie-based anonymous session
├── hooks/useProgress.ts               Client-side DB progress sync
├── scripts/
│   ├── crawl-megaten.ts               Fandom MediaWiki API crawler (15 pages, 833 chunks)
│   ├── translate.ts                   LLM batch translator (ja/ko/zh, OpenAI-compatible)
│   └── apply-v3-migration.cjs         Idempotent v3 migration
├── middleware.ts                      Accept-Language → 307 to /<lang>/
├── HANDOVER.md                        Current state snapshot (transient)
├── AGENTS.md                          THIS FILE (canonical onboarding)
├── README.md                          Human-facing release doc
├── .nvmrc                             24.16.0
└── package.json                       See Tech stack
```

---

## State snapshot

**Latest commit**: `585bce2 feat(translate): LLM batch translator + ja/ko/zh full coverage (828/828/828)`

**Last completed**:
- 2 games × 6 tools = fully functional UI
- i18n: 4 langs, 59 keys aligned, middleware + cookie persistence
- SQLite persistence v1+v2+v3 (sessions, progress, system_checks, RAG, translations)
- RAG crawler: MegaTen Wiki → 833 chunks
- Translation: 828/828 ja/ko/zh
- FTS5 search with source_language badge
- Universal system checker with browser auto-detect

**Not yet done (priority-ordered)**:
1. AI Q&A (`/api/qa`): searchChunks → LLM prompt → stream answer. Need `/api/qa` route + `qa_interactions` logging.
2. More crawlers: NGA (zh), 3DM (zh), GameWith (ja), Steam News.
3. Vector search: `sqlite-vss` or migrate to pgvector. FTS5 is first iteration.
4. Cloud deploy: 腾讯云首尔 2C4G + aaPanel + domain. **WAIT for user Go decision.**
5. Third game: validates multi-game architecture.
6. i18n cleanup: `SystemCheckerClient.tsx` has residual English ("Auto-detected from your browser", "hide").

---

## How to run / verify

### Start dev server
```bash
cd "D:\Idea Project\gametoolx"
npm run dev
# http://localhost:3000 → auto-redirects to /<browser-lang>/
# Dev server hot-reloads on file changes (don't restart)
```

### Verify state without dev server
```bash
cd "D:\Idea Project\gametoolx"

# DB stats
node -e "const db=require('better-sqlite3')('data/gametoolx.db',{readonly:true});console.log('docs:',db.prepare('SELECT COUNT(*) as c FROM crawled_documents').get().c);console.log('chunks:',db.prepare('SELECT COUNT(*) as c FROM crawled_chunks').get().c);console.log('translations:',db.prepare(\"SELECT COUNT(*) as c FROM crawled_chunks WHERE translations != '{}'\").get().c);"

# Re-crawl (idempotent, SHA-256 content_hash)
npx tsx scripts/crawl-megaten.ts

# Re-translate (idempotent, skips chunks already having target lang)
LLM_BASE_URL=https://api.minimaxi.com/v1 LLM_API_KEY=... npx tsx scripts/translate.ts --lang ja
```

### Manual test paths
- `/zh/search?q=Metatron` → should return translated chunks in zh
- `/en/search?q=Press%20Turn` → returns original en content
- `/ja/search?q=ルシファー` → returns translated ja content
- `/tools/system-checker?game=shin-megami-tensei-5-vengeance&auto=true` → browser API auto-detect

---

## Operational quirks (READ BEFORE EDITING)

### User does NOT write code or run git
All code + git push is done by agent. The user only types natural-language requests.

### GitHub push (3 things to know)
1. **`GIT_TERMINAL_PROMPT=0`** is set as user env var (Windows) — GCM falls back to `store` helper, no dialog.
2. **`git config --global http.proxy=http://127.0.0.1:7890`** is set — agent's bash sandbox doesn't route through user's VPN, needs to go through local Clash.
3. **Token is in `~/.git-credentials`** (plaintext, store helper reads it). DO NOT add `.git-credentials` to gitignore (it's already ignored by default).

If push fails with `Failed to connect to github.com port 443`: user may have turned off VPN. Tell them to turn on VPN and retry. Don't add random git config workarounds.

### File size limits
- `Write` tool blocks files > ~22KB. Use Python `json.dump` with `encoding='utf-8'` or split into multiple `Edit` calls.
- For DB writes, use a `.cjs` script (not `.ts`) to avoid TS compile complexity.

### PowerShell 5.1 quirks
- `Remove-Item` blocked by mavis safety rule → use `mavis-trash`. But NEVER chain other commands after mavis-trash in the same line (mavis-trash is a Node.js external CLI; PowerShell doesn't auto-split compound args — see agent memory).
- `Get-Content` without `-Encoding UTF8` decodes CJK as GBK (display only, file is fine).
- `git commit -m` heredoc with newlines → use single-line message.
- `Start-Process` to run pnpm/npm/node → wrap in `powershell -Command`. Don't pass `D:\Path\file.exe` directly without `-ArgumentList '"D:\Path\file.exe"'`.

### Windows networking
- Agent's bash sandbox does NOT inherit user's VPN. Direct github.com:443 from sandbox fails (GFW). Always use 127.0.0.1:7890 proxy.
- For `git push`, the env vars and `git config --global` are persistent across shells. Don't re-set them.

### LLM translation guard regex
In `scripts/translate.ts` the defensive guard rejects output starting with `Game:` / `ゲーム：` / `게임：` / `Translation:` / `번역：` (with **colon**). Do NOT loosen to `게임 ` (with space) — that false-positives on legitimate Korean translations like "게임 디렉터 ...". Same for `游戏 ` (chinese).

### SQLite WAL mode
DB file is small (`gametoolx.db` ~4KB) but WAL file is the active work area (`gametoolx.db-wal` ~135KB). For production: `pragma wal_checkpoint(TRUNCATE)` periodically. For now: ignore.

### Translation script concurrency
- `setChunkTranslationsBatch` uses SQLite `json_set` to safely merge per-lang writes from multiple concurrent processes. Don't refactor to read-then-write JSON.stringify (race condition).
- 3-process parallel is optimal — more processes = SQLite lock contention.

---

## How to handle common requests

### "Add a new game"
1. Create `data/games/<slug>.json` with `id`, `name` (4-lang), `steamAppId`, `cover`, `screenshots`, `systemReqs`, `metacritic`/`steamPercent`.
2. Download Steam images to `public/images/games/<slug>/` (header/library/capsule/hero/logo + 6 screenshots from `https://cdn.akamai.steamstatic.com/steam/apps/<appid>/`).
3. Add `data/tools/<game>-<tool>.json` for each tool.
4. Update `data/i18n/{en,ja,ko,zh}.json` if any new keys.
5. Test in dev server, then commit + push.

### "Add a new tool type"
1. Define tool type in `lib/data.ts` if it's a new structure.
2. Add tool data in `data/tools/<game>-<tool>.json`.
3. Create `components/tools/<NewTool>.tsx` with the same props pattern (`lang`, `ui`, `tool`, `game`).
4. Update `app/[lang]/tools/[slug]/page.tsx` dispatcher to recognize new tool type.

### "Translate new crawled content"
1. Ensure DB is at schema v3 (run `scripts/apply-v3-migration.cjs` if not).
2. Run `npx tsx scripts/translate.ts --lang <lang>` (uses env vars for LLM creds).
3. Translation skips chunks already having that lang, so re-runs are idempotent.

### "Push to GitHub"
```bash
cd "D:\Idea Project\gametoolx"
git add <specific paths>     # NOT git add -A (avoids staging .next/, node_modules/, *.db-wal)
git commit -m "<type>: <subject>"   # single line
git push origin master
```

If push hangs on connection: wait 1-2 min, then check `git log --oneline origin/master -1` to see if it landed. If still hanging, check `netstat -ano | Select-String "github.com.*ESTABLISHED"` for orphan processes.

### "The dev server broke"
1. `Get-Process node | Where-Object StartTime -gt (Get-Date).AddMinutes(-30)` — find recent node procs
2. `Stop-Process -Id <pid> -Force` if it's a hung dev server
3. `npm run dev` to restart
4. If port 3000 is held, check `netstat -ano | Select-String ":3000"` for orphan listener

---

## DO NOT

- **Do not** use Node v26. Always v24.16.0.
- **Do not** use `next-intl` (Next 16 removed built-in i18n but `next-intl` is over-engineered for our use). Use the custom `middleware.ts` pattern.
- **Do not** AI-generate game art. Steam / Wiki only.
- **Do not** fabricate game data (skills, walkthrough steps, demon stats). Use real Wiki / community sources.
- **Do not** modify `data/gametoolx.db` directly. Use `lib/db.ts` API or `scripts/apply-v3-migration.cjs`.
- **Do not** add `.git-credentials` to gitignore.
- **Do not** chain mavis-trash with other PowerShell commands (agent memory: this caused a directory to be permanently deleted once).
- **Do not** commit `.next/`, `node_modules/`, `data/gametoolx.db*`, `next-env.d.ts`, `.dev-*.log`, `.env*.local`, `.dev-translate-*.{log,pid}` — all in `.gitignore`.
- **Do not** buy a domain or server without explicit user Go decision.
- **Do not** spawn another agent for low-complexity tasks (the project has known patterns; just do it).
- **Do not** use `mavis team plan run` for this project — the design iterates too often, and owner-finished deadlock has bitten us before. (See agent memory.)

---

## Key file references

- **Game data**: `data/games/*.json` — see `octopath-traveler-2.json` for the canonical shape.
- **Tool data**: `data/tools/*.json` — see `octopath-traveler-2-job-recommender.json` for the largest example (24 recs × 8 jobs × 10 skills).
- **i18n keys**: `data/i18n/{en,ja,ko,zh}.json` — must keep all 4 files in sync.
- **Crawler pattern**: `scripts/crawl-megaten.ts` — uses Fandom MediaWiki API. New crawlers should follow this pattern.
- **DB API**: `lib/db.ts` — `upsertSession`, `getOrCreateSessionId`, `upsertCrawledDocument`, `searchChunks({preferredLang})`, `getChunkTranslation`, `setChunkTranslation`, `setChunkTranslations`.
- **Session**: `lib/session.ts` — `getOrCreateSessionId` reads `gtx_sid` cookie or creates a 16-byte hex ID (1 year expiry).
- **i18n middleware**: `middleware.ts` — parses `Accept-Language`, respects `gtx_lang` cookie, 307 redirect to `/<lang>/`.

---

## When stuck

1. Read `HANDOVER.md` — has the most recent state snapshot.
2. Read `D:\Idea Project\dream\GameToolX-MVP-任务清单.md` — has the 10-night MVP plan with acceptance criteria.
3. Check the last 5 git commits: `git log --oneline -5`.
4. Read the agent's `MEMORY.md` for cross-project lessons (LLM prompt design, SQLite json_set, mavis-trash pitfalls, git push orphan processes, Windows GCM issues).
5. If DB seems off: `node -e "const db=require('better-sqlite3')('data/gametoolx.db',{readonly:true});db.pragma('user_version');console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\"').all());"`
