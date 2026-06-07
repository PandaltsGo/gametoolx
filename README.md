# GameToolX

> Game tools platform for small-language markets (JA / KO / CN).
> Currently 2 games, 6 tools, 4 languages, with a RAG data layer ready for AI Q&A.

[Tools](#features) • [Tech Stack](#tech-stack) • [Development](#development) • [Contributing](#contributing) • [License](#license)

---

## What is GameToolX

A **multi-game tools platform** — not a content site. For each supported game, GameToolX provides:

- **System Requirement Checker** — match your PC specs to the game's requirements
- **Build Advisor** — recommended builds / loadouts from real community data
- **Walkthrough** — structured step-by-step guide with source citations
- **Endings Tracker** — track which endings you've unlocked (DB-backed, cross-device)
- **Route Chooser** — quiz-based recommender for branching games
- **Fusion Calculator** — search demons / recipes by name or stats

All data is sourced from real game Wikis and community guides, **never AI-fabricated**. All UI is translated to **Japanese / Korean / Chinese / English**.

## Why

Small-language markets (JP / KR / CN) are underserved by tools sites that focus on English. GameToolX aims to bring high-quality, language-native game tools to these audiences.

## Features

- 4 languages: **JA / KO / ZH / EN** (auto-detected from `Accept-Language`, cookie-persisted)
- Real game data, sourced from Steam + community Wikis (MegaTen Wiki, NGA, 3DM, GameWith, ...)
- Cross-device progress tracking (anonymous session, DB-backed)
- RAG data layer: crawled content + FTS5 search + LLM-translated chunks
- Universal system checker (works for any game that has data)

## Currently supported games

| Game | Tools |
|------|-------|
| 歧路旅人 II / Octopath Traveler II | System Checker, Job Recommender |
| 真・女神转生Ⅴ 复仇 / Shin Megami Tensei V: Vengeance | System Checker, Endings Tracker, Walkthrough, Route Chooser, Fusion Calculator |

## Tech stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript 5
- **Backend**: Next.js API routes + Node.js v24.16.0
- **Database**: SQLite (better-sqlite3 + WAL), FTS5 for search
- **i18n**: Custom middleware + cookie persistence
- **Translation**: LLM (MiniMax-Text-01, OpenAI-compatible)
- **Crawler**: Fandom MediaWiki API

## Development

### Prerequisites
- Node.js **v24.16.0** (use `nvm use` if you have nvm)
- pnpm (recommended) or npm

### Setup
```bash
git clone https://github.com/PandaltsGo/gametoolx.git
cd gametoolx
npm install
npm run dev
# http://localhost:3000
```

The first visit auto-redirects to `/<browser-language>/` based on `Accept-Language`.

### Data files
- `data/games/*.json` — game metadata
- `data/tools/*.json` — tool configurations (recommendations, walkthroughs, ...)
- `data/i18n/{en,ja,ko,zh}.json` — UI translations (4 files kept in sync)
- `data/gametoolx.db` — SQLite DB (gitignored, includes crawled RAG content)

### Adding a new game
See `AGENTS.md` for the canonical process (game data → tool data → images → i18n).

### Adding a new tool
See `AGENTS.md` for the canonical process (tool type → data → component → dispatcher).

## Contributing

We welcome contributions in:
- **New game data** (recommendations, walkthroughs, endings, fusion recipes) — must be from real sources (Wiki, community)
- **Translations** — help us improve 4-language UI quality
- **New crawlers** — for adding more community data sources

Before opening a PR, please read `AGENTS.md` to understand the architecture and constraints.

## License

TBD. Currently single-developer project.

## Contact

Open an issue on GitHub.
