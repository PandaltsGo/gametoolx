# GameToolX — Handover（临时状态快照）

> **本文档是临时的**，记录"当前"状态。要看 canonical 的接手指南（不怎么变），请先读 `AGENTS.md`。
> 每次重要工作结束都更新一下。

## 当前状态（2026-06-07 13:30 HKT）

- **代码**：全部已推到 `master`，最新 commit `585bce2`
- **数据**：本地 SQLite `data/gametoolx.db` 内保留
  - 1 个抓取源（MegaTen Wiki Fandom）
  - 15 篇文档（Vengeance / SMT V / Press Turn / Magatsuhi / Masakado + 8 个 List of XXX）
  - 833 个 chunk（~500 字/段，已 FTS5 索引）
  - **828/828 ja 翻译** | **828/828 ko 翻译** | **828/828 zh 翻译**（5 块 < 20 字符按设计跳过）
  - 共 ~320KB 正文 / ~211k token

## 已完成

### 第一阶段：基础
- Next.js 16 + TypeScript + Tailwind v4 + React 19
- Node.js v24.16.0（24 LTS）
- 4 语言 i18n（ja/ko/zh/en）59 个 key 全部对齐
- middleware.ts 自动检测 `Accept-Language` → 重定向到 `/<lang>/`
- LanguageSwitcher 组件 + cookie 持久化

### 第二阶段：工具
- **歧路旅人 II**（首款游戏）
  - 系统配置检测（Universal System Checker）
  - 职业搭配推荐（24 条推荐 + 8 职业 + 完整技能数据）
- **真·女神转生Ⅴ 复仇**（第二款游戏）
  - 系统配置检测
  - 全结局攻略（6 结局，DB 存进度）
  - 图文流程攻略（5 章节，8 参考源）
  - 路线选择器（5 问诊推荐）
  - 仲魔合体计算器（60+ 恶魔 + 特殊配方）

### 第三阶段：持久化 + RAG
- **better-sqlite3** + WAL 模式（100 并发 / 1w DAU 完全够用）
- Schema v1：sessions / progress / system_checks / page_views
- Schema v2（**RAG 核心**）：
  - `crawled_sources` —— 来源登记
  - `crawled_documents` —— 抓取页（hash 用于增量更新，**source_language** 标注）
  - `crawled_chunks` —— 切片段落，**translations JSON** 存预翻译
  - `crawled_chunks_fts` —— FTS5 全文索引（自动同步）
  - `crawl_jobs` —— 抓取任务追踪
  - `translate_jobs` —— 翻译任务追踪
  - `qa_interactions` —— 未来 LLM 对话历史
- Schema v3（**翻译流水线**）：
  - `crawled_documents.source_language` —— 来源语种（en/ja/ko/zh）
  - `crawled_chunks.translations` —— JSON map `{ja, ko, zh}`，原 content 不破坏
  - `crawled_chunks.translated_at` —— 翻译时间戳
  - `translate_jobs` 完善：start/finish/duration/chunks_processed/failed/model
- API：`/api/progress/[tool]/[key]` + `/api/system-checks`
- 爬虫：`scripts/crawl-megaten.ts`（Fandom MediaWiki API）
- 翻译脚本：`scripts/translate.ts`（LLM 批量翻译 ja/ko/zh，**已跑完 828/828**）
- v3 迁移脚本：`scripts/apply-v3-migration.cjs`（幂等）
- 搜索页：`/[lang]/search` 用 FTS5 全文检索，**按用户语言优先返回翻译版**
- AI Q&A 占位：搜索结果底部"🤖 AI 攻略问答 · 即将上线"

## 文件结构

```
gametoolx/
├── data/
│   ├── games/                      游戏基础数据 (JSON)
│   │   ├── octopath-traveler-2.json
│   │   └── shin-megami-tensei-5-vengeance.json
│   ├── tools/                      工具数据 (JSON)
│   │   ├── octopath-traveler-2-job-recommender.json
│   │   ├── octopath-traveler-2-system-checker.json
│   │   ├── shin-megami-tensei-5-vengeance-endings-tracker.json
│   │   ├── shin-megami-tensei-5-vengeance-fusion-calculator.json
│   │   ├── shin-megami-tensei-5-vengeance-route-chooser.json
│   │   └── shin-megami-tensei-5-vengeance-walkthrough.json
│   ├── i18n/                       4 语言翻译 (en/ja/ko/zh)
│   ├── system-tiers.json           GPU/CPU tier 定义
│   └── gametoolx.db                ⚠️ SQLite DB（gitignored，本地保留）
├── public/images/games/             Steam 抓的 header/capsule/library/hero/logo/截图
├── scripts/
│   ├── crawl-megaten.ts            Fandom 爬虫
│   ├── translate.ts                LLM 翻译脚本（已跑完 828/828）
│   └── apply-v3-migration.cjs      v3 迁移（幂等）
├── lib/
│   ├── data.ts                     JSON loaders
│   ├── db.ts                       SQLite 层 + 迁移 + FTS5 + 翻译 API
│   └── session.ts                  cookie session helper
├── hooks/
│   └── useProgress.ts              React hook 同步进度到 DB
├── components/
│   ├── LanguageSwitcher.tsx
│   └── tools/                      6 个工具组件
│       ├── SystemCheckerClient.tsx
│       ├── BuildRecommender.tsx
│       ├── EndingsTracker.tsx
│       ├── Walkthrough.tsx
│       ├── RouteChooser.tsx
│       └── FusionCalculator.tsx
├── app/
│   ├── [lang]/
│   │   ├── page.tsx                首页
│   │   ├── games/[slug]/page.tsx
│   │   ├── tools/[slug]/page.tsx
│   │   ├── tools/system-checker/page.tsx  通用 system checker
│   │   └── search/page.tsx         FTS5 搜索页（含翻译 + 源语言徽章）
│   ├── api/
│   │   ├── progress/[tool]/[key]/route.ts
│   │   └── system-checks/route.ts
│   └── layout.tsx
├── AGENTS.md                       canonical 接手文档（智能体看）
├── README.md                       发布文档（人看）
├── HANDOVER.md                     本文档（临时状态）
└── middleware.ts                   Accept-Language → /<lang>/
```

## 本地启动（最简）

```bash
cd "D:\Idea Project\gametoolx"
npm run dev
# 然后访问 http://localhost:3000
# （首次会自动 307 重定向到 /en 或 /zh，根据浏览器语言）
```

## 验证数据没丢

```bash
# 1. DB 文件
ls -lh data/gametoolx.db   # 应该 ~1.5MB（含 WAL）

# 2. 跑一个无依赖的 quick check
node -e "const db=require('better-sqlite3')('data/gametoolx.db',{readonly:true});console.log('Docs:',db.prepare('SELECT COUNT(*) as c FROM crawled_documents').get().c);console.log('Chunks:',db.prepare('SELECT COUNT(*) as c FROM crawled_chunks').get().c);"

# 3. 访问搜索页验证 FTS5
# http://localhost:3000/zh/search?q=Metatron
# http://localhost:3000/en/search?q=Press%20Turn
# http://localhost:3000/ja/search?q=ルシファー

# 4. 重跑爬虫（增量更新，不会重复入库）
npx tsx scripts/crawl-megaten.ts
```

## 翻译脚本

爬虫抓下来的是英文（Fandom），搜索时会自动返回用户语言版本（如果有翻译的话）。**当前 828/828/828 已完成**。

```bash
# 1. 配置 LLM 凭据（任选一种 OpenAI 兼容接口）
# 建议创建 .env.local
echo 'LLM_BASE_URL=https://api.minimaxi.com/v1' >> .env.local
echo 'LLM_API_KEY=sk-...' >> .env.local
echo 'LLM_MODEL=MiniMax-Text-01' >> .env.local

# 2. 跑翻译（ja + ko + zh）
npx tsx scripts/translate.ts

# 限流参数
npx tsx scripts/translate.ts --lang ja     # 只翻日文
npx tsx scripts/translate.ts --limit 200  # 一轮 200 chunk
```

翻译存在 `crawled_chunks.translations` JSON 字段，不修改原始 content。`searchChunks({preferredLang})` 会按用户语言优先返回翻译版。

**新抓的页面怎么补翻译**：爬虫跑完 → `apply-v3-migration.cjs` 确保 schema 是 v3 → `translate.ts` 会自动跳过已有 key，只翻译新增 chunks。

## 推送通道（已修）

GitHub 直连在 agent 沙箱里被 GFW 挡，每次 push 还要弹 GCM 框。两层修复：

```bash
# 1. GCM 静默失败（fall back 到 store）
# 已设 user 级环境变量 GIT_TERMINAL_PROMPT=0
[System.Environment]::GetEnvironmentVariable("GIT_TERMINAL_PROMPT", "User")
# → "0"

# 2. git 全局走本地 VPN 代理（Clash 默认 7890）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

`~/.git-credentials` 已有 github token（`x-access-token:ghp_...`），store helper 拿得到。VPN 关了会断，开了就通。

## 下次开发方向（按优先级）

| 优先级 | 方向 | 工作量 |
|-------|------|--------|
| 🥇 | **接 LLM 做 AI Q&A**：写 `/api/qa` 路由，searchChunks → LLM prompt → 流式返回 | 1-2 小时 |
| 🥈 | **多来源爬虫**：NGA 帖子、3DM 攻略、GameWith 日文、Steam News | 半天 |
| 🥉 | **向量搜索**：embed chunks 进 sqlite-vss 或切到 pgvector | 半天 |
| 4 | **云部署**：腾讯云首尔 2C4G + aaPanel + 域名（$15-180 一次性） | 1 天 |
| 5 | **第三款游戏**：再验证一遍多游戏架构 | 半天 |
| 6 | **SystemCheckerClient 残留英文 + i18n 收尾** | 1 小时 |

## 关键约定

- 所有 UI 文案 → `data/i18n/<lang>.json`，4 语言全对齐
- 4 语言渲染：component 里用 `t(obj, lang)` 工具函数 + `Record<string, string>` 数据
- 工具数据 → `data/tools/<game>-<tool>.json` 单独文件
- 游戏数据 → `data/games/<slug>.json` + Steam 图片在 `public/images/games/<slug>/`
- DB schema 改动 → 在 `lib/db.ts` 的 `MIGRATIONS` 数组加新版本，自动跑
- 写新组件 → "use client" + 接受 `lang` + `ui` + `tool`/`game` props
- i18n 缺 key → 默认 fall back 到 `en.json`

## 联系

下次回来直接说"继续 gametoolx 的 XXX"即可，DB 数据都在 `data/gametoolx.db` 里等你。
