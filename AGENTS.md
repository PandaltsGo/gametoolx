# GameToolX — AGENTS.md

> **受众**：任何被交接本项目的 AI agent session。
> **目标**：零成本接手。读完这份文档，你就知道项目在哪、当前状态、接下来要做什么、哪些事绝对不能做。
> **先读这份 → 再读 `HANDOVER.md` 看最新快照 → 需要时再读 `D:\Idea Project\dream\` 里的任务规划文档。**

---

## 项目是什么

面向日 / 韩 / 中小语种市场的**多游戏攻略工具站**。核心定位：「**批量搜索 + 整理 4 语言游戏攻略**」。每款游戏最低提供 2 类工具：

1. **攻略（Walkthrough）** —— 多源交叉验证的流程攻略，结构化呈现
2. **系统配置检测（System Checker）** —— 官方推荐配置 + 浏览器自动检测 + 预估画质/帧率

按游戏特点再扩展 3、4 类工具：配装推荐、结局追踪、路线选择、仲魔/角色库等。游戏来源包含 Humble 月包 + 任何被验证有攻略资源的小语种市场游戏。

**不是内容站，不是内容生成器。是需要准确游戏数据的工具站。**

详细 MVP 任务和 Go/No-Go 判定见 `D:\Idea Project\dream\GameToolX-MVP-任务清单.md`。

---

## 项目根目录

```
D:\Idea Project\gametoolx
```

GitHub：`https://github.com/PandaltsGo/gametoolx`（master 分支）。

---

## 技术栈（已锁，不要改）

| 组件 | 版本 | 原因 |
|------|------|------|
| Node.js | **v24.16.0** | 24 LTS 最新 patch。**绝不用 v26**（Current 状态，2026-10 才转 LTS）。 |
| Next.js | 16.2.7 | App Router + Turbopack |
| React | 19.2.4 | |
| Tailwind | v4 | |
| TypeScript | 5 | |
| 数据库 | SQLite via `better-sqlite3` ^12 | 单实例，100 并发 / 10k DAU 够用。WAL 模式。 |
| 搜索 | SQLite FTS5 + `unicode61 remove_diacritics 2` | RAG 第一阶段，避免引入向量依赖。 |
| LLM | MiniMax-Text-01（`https://api.minimaxi.com/v1`） | OpenAI 兼容。Token Plan key 在 `D:\Idea Project\daily_on_work\_check_api.py`。 |
| 图片源 | Steam CDN（`akamai.steamstatic.com`） | 绝不用 AI 生成游戏美术。 |
| i18n | 自定义 middleware（不用 `next-intl`） | Next 16 移除了内置 i18n。我们用 Accept-Language → 307 重定向 + cookie 覆盖。 |

---

## 文件结构（当前）

```
gametoolx/
├── app/[lang]/                        路由（i18n 动态段）
│   ├── page.tsx                       首页
│   ├── games/[slug]/page.tsx          游戏详情
│   ├── tools/[slug]/page.tsx          工具分发器（6 种 tool type）
│   ├── tools/system-checker/page.tsx  通用系统检测器
│   ├── search/page.tsx                FTS5 搜索（4 语言 + 源语言徽章）
│   └── api/
│       ├── progress/[tool]/[key]/route.ts   GET/POST/DELETE
│       └── system-checks/route.ts           GET/POST
├── components/
│   ├── LanguageSwitcher.tsx           JA/KO/ZH/EN 切换器
│   └── tools/                         6 个工具组件
│       ├── SystemCheckerClient.tsx
│       ├── BuildRecommender.tsx
│       ├── EndingsTracker.tsx         走 DB（useProgress hook）
│       ├── Walkthrough.tsx            块渲染：heading/paragraph/callout/step/boss/table/tip
│       ├── RouteChooser.tsx           5 题问答
│       └── FusionCalculator.tsx       60+ 恶魔搜索 + 反向配方查询
├── data/
│   ├── games/                         游戏配置 JSON（2 个：OT2、SMT5V）
│   ├── tools/                         工具配置 JSON（5 个）
│   ├── i18n/{en,ja,ko,zh}.json        4 语言 59 keys 对齐
│   ├── system-tiers.json              GPU/CPU/RAM/Storage 等级定义
│   └── gametoolx.db                   ⚠️ SQLite（gitignored，本地保留）
├── lib/
│   ├── data.ts                        JSON 加载器（getGame/getTool/listGames/...）
│   ├── db.ts                          SQLite 层 + 3 个 migration + FTS5 + 翻译 API
│   └── session.ts                     基于 cookie 的匿名 session
├── hooks/useProgress.ts               客户端 DB 进度同步
├── scripts/
│   ├── crawl-megaten.ts               Fandom MediaWiki API 爬虫（15 页 → 833 chunks）
│   ├── translate.ts                   LLM 批量翻译（ja/ko/zh，OpenAI 兼容）
│   └── apply-v3-migration.cjs         幂等 v3 迁移
├── middleware.ts                      Accept-Language → 307 到 /<lang>/
├── HANDOVER.md                        当前状态快照（临时）
├── AGENTS.md                          本文档（canonical 接手指南）
├── README.md                          给人类看的发布文档
├── .nvmrc                             24.16.0
└── package.json                       见技术栈
```

---

## 状态快照

**最新 commit**：`585bce2 feat(translate): LLM batch translator + ja/ko/zh full coverage (828/828/828)`

**已完成**：
- 2 款游戏 × 6 个工具 = 完整功能 UI
- i18n：4 语言 59 keys 对齐，middleware + cookie 持久化
- SQLite 持久化 v1+v2+v3（sessions / progress / system_checks / RAG / translations）
- RAG 爬虫：MegaTen Wiki → 833 chunks
- 翻译：828/828 ja/ko/zh
- FTS5 搜索带源语言徽章
- 通用系统检测器带浏览器 API 自动识别

**未做（按优先级）**：
1. **OT2 攻略工具**（`octopath-traveler-2-walkthrough.json`）—— 当前最大缺口。新规则要求每款游戏至少包含攻略 + 系统检测，OT2 只有后者。按 SMT5V walkthrough 流程做一遍：选蓝本 + 交叉验证 + 结构化 + 4 语言。
2. **AI Q&A**（`/api/qa`）：searchChunks → LLM prompt → 流式回答。
3. **更多 crawler**：NGA（zh）、3DM（zh）、GameWith（ja）、Steam News。
4. **向量搜索**：`sqlite-vss` 或迁 `pgvector`。
5. **云部署**：腾讯云首尔 2C4G + aaPanel + 域名。**等用户 Go 决策再买。**
6. **i18n 收尾**：`SystemCheckerClient.tsx` 残留英文。

---

## 工具 pipeline 规约（每个游戏最低 2 类工具）

### 强制：每款游戏至少包含以下 2 类

#### 1. 攻略（Walkthrough）—— 流程 / 章节 / Boss / 支线

**数据源选择**：以**一篇综合性攻略为蓝本**（如 Wiki、3DM、GameWith、NGA 长贴），再用 **2+ 个独立来源做交叉验证**。

**制作流程**（规约级，不是建议）：
1. **选蓝本**：从 Wiki / 攻略站 / Steam 社区选一篇最全的攻略作为基础结构
2. **交叉验证**：至少 2 个独立来源核对关键事实（章节顺序、Boss 弱点、装备属性）
3. **结构化**：用 `walkthrough` 块格式（`heading` / `paragraph` / `callout` / `step` / `boss` / `table` / `tip`），详见 `lib/data.ts` 的 `WalkthroughBlock` 类型
4. **多语言翻译**：把每个 chunk 翻译到 ja/ko/zh（en 用原文或本地化）
5. **来源标注**：数据文件顶层加 `sources: [{lang, url, attribution}]`；每个 chunk 翻译时记 `sourceLanguage` + 来源

**禁止**：
- **不准**编造章节、Boss、装备、属性
- 关键数据有矛盾时回到 Wiki 主源确认，不可挑一个就用
- 不要混编两份攻略的章节结构（除非两份都是权威）

#### 2. 系统配置检测（System Checker）—— 官方推荐配置 + 浏览器自动检测

**数据来源**：Steam 商店页 / 发行商官网拉官方推荐配置（`systemRequirements.minimum` / `recommended`）。

**功能要求**：
1. 浏览器 API 自动检测（`navigator.hardwareConcurrency` / `deviceMemory` / `platform` / `screen` / `userAgent`）
2. 不可检测项（GPU、Storage）让用户手动输入
3. 对比用户硬件 vs 官方推荐配置 → 输出**预估画质 + 帧率**（保守 / 平衡 / 流畅 / 极佳）
4. 每次检测入库到 `system_checks` 表，留作产品分析

**数据格式参考**：`data/system-tiers.json`（GPU/CPU/RAM/Storage 等级定义）。

### 3. 扩展工具（按游戏特点可选）

| 类型 | 适用场景 | 数据格式参考 |
|------|----------|--------------|
| 配装推荐（Build） | 回合制 / 职业制 RPG（OT2、FF、BDFF） | `data/tools/<game>-job-recommender.json` |
| 结局追踪（Endings） | 多结局游戏（SMT、RA、FFXV） | `data/tools/<game>-endings-tracker.json` |
| 路线选择（Route） | 多分支叙事（SMT V、RA、FFXIII） | `data/tools/<game>-route-chooser.json` |
| 仲魔 / 角色库（Compendium） | 仲魔系统、角色养成（SMT、Persona） | `data/tools/<game>-fusion-calculator.json` |
| 流程攻略（Walkthrough） | 任何带剧情的游戏 | `data/tools/<game>-walkthrough.json` |

### 当前各游戏工具覆盖

| 游戏 | system-checker | walkthrough | 扩展 | 状态 |
|------|----------------|-------------|------|------|
| 歧路旅人 II | ✓ | **✗ 缺** | job-recommender | **不符合 2 类最低要求** |
| 真・女神转生Ⅴ 复仇 | ✓ | ✓ | endings / route / fusion | 完整 |

### 翻译的来源标注规约（所有工具数据文件）

**顶层 `sources` 字段**：
```json
{
  "sources": [
    { "lang": "en", "url": "https://...", "attribution": "GameSpot Guide" },
    { "lang": "ja", "url": "https://gamewith.jp/...", "attribution": "GameWith 攻略" },
    { "lang": "zh", "url": "https://3dmgame.com/...", "attribution": "3DM 攻略" }
  ]
}
```

**单条数据可加 `sourceUrl` / `sourceLang` 字段**（引用具体来源，做交叉验证）。

**RAG 爬取内容**（`crawled_documents` / `crawled_chunks`）：通过 `source_language` + `url` 字段追踪，schema v3 已实现。

---

## 工具 pipeline（每个游戏最低 2 类工具）

### 强制要求：每款游戏至少包含以下 2 类

#### 1. 攻略（Walkthrough）—— 流程 / 章节 / Boss / 支线

**数据源**：以**一篇综合性攻略**为蓝本（如 Wiki、3DM、GameWith、NGA 长贴），再用 2+ 篇**其他来源**做交叉验证。

**制作流程**（这是规约，不是建议）：
1. **选蓝本**：从 Wiki / 攻略站 / Steam 社区选一篇最全的攻略作为基础结构
2. **交叉验证**：至少 2 个独立来源核对关键事实（章节顺序、Boss 弱点、装备属性）
3. **结构化**：用 `walkthrough` 块格式（`heading` / `paragraph` / `callout` / `step` / `boss` / `table` / `tip`），详见 `lib/data.ts` 的 `WalkthroughBlock` 类型
4. **多语言翻译**：把每个 chunk 翻译到 ja/ko/zh（en 用原文或本地化）
5. **来源标注**：每个数据文件顶层加 `sources: [{lang, url, attribution}]`，每个 chunk 翻译时记 `sourceLanguage` + 来源

**禁止**：
- 不准编造章节、Boss、装备、属性
- 关键数据有矛盾时回到 Wiki 主源确认，不可挑一个就用
- 不要混编两份攻略的章节结构（除非两份都是权威）

#### 2. 系统配置检测（System Checker）—— 官方推荐配置 + 浏览器自动检测

**数据**：从 Steam 商店页 / 发行商官网拉官方推荐配置（`systemRequirements.minimum` / `recommended`）。

**功能**：
1. 浏览器 API 自动检测（`navigator.hardwareConcurrency` / `deviceMemory` / `platform` / `screen` / `userAgent`）
2. 不可检测项（GPU、Storage）让用户手动输入
3. 对比用户的硬件 vs 官方推荐配置 → 输出**预估画质 + 帧率**（保守 / 平衡 / 流畅 / 极佳）
4. 每次检测入库到 `system_checks` 表，留作产品分析

**数据格式**：参考 `data/system-tiers.json`（GPU/CPU/RAM/Storage 等级定义）。

### 3. 扩展工具（按游戏特点可选）

| 类型 | 适用场景 | 数据格式参考 |
|------|----------|--------------|
| 配装推荐（Build） | 回合制 / 职业制 RPG（OT2、FF、BDFF） | `data/tools/<game>-job-recommender.json` |
| 结局追踪（Endings） | 多结局游戏（SMT、RA、FFXV） | `data/tools/<game>-endings-tracker.json` |
| 路线选择（Route） | 多分支叙事（SMT V、RA、FFXIII） | `data/tools/<game>-route-chooser.json` |
| 仲魔 / 角色库（Compendium） | 仲魔系统、角色养成（SMT、Persona） | `data/tools/<game>-fusion-calculator.json` |
| 流程攻略（Walkthrough） | 任何带剧情的游戏 | `data/tools/<game>-walkthrough.json` |

**当前各游戏工具覆盖**：

| 游戏 | 工具 | 状态 |
|------|------|------|
| OT2 | system-checker ✓ / job-recommender ✓ / **walkthrough ✗** | 缺攻略，需补 |
| SMT5V | system-checker ✓ / walkthrough ✓ / endings-tracker ✓ / route-chooser ✓ / fusion-calculator ✓ | 完整 |

**OT2 攻略工具**是当前最大缺口，下次开发优先补。

### 翻译的来源标注规约

**所有多语言数据文件（攻略 / 配装 / 工具数据）必须包含**：

```json
{
  "sources": [
    { "lang": "en", "url": "https://example.com/walkthrough", "attribution": "GameSpot Guide" },
    { "lang": "ja", "url": "https://gamewith.jp/...", "attribution": "GameWith 攻略" },
    { "lang": "zh", "url": "https://3dmgame.com/...", "attribution": "3DM 攻略" }
  ]
}
```

**已爬取的 RAG 内容**（`crawled_documents` / `crawled_chunks`）：通过 `source_language` 字段 + 文档 `url` 字段追踪，已在 schema v3 实现。

**工具数据文件**（攻略 / 配装）：`sources` 字段在文件顶层；每个具体条目可加 `sourceUrl` / `sourceLang` 引用具体来源。

---

## 怎么跑 / 怎么验证

### 启动 dev server
```bash
cd "D:\Idea Project\gametoolx"
npm run dev
# http://localhost:3000 → 自动 307 重定向到 /<浏览器语言>/
# 改代码 Next.js 自动热重载，不用重启
```

### 不开 dev server 验证状态
```bash
cd "D:\Idea Project\gametoolx"

# DB 统计
node -e "const db=require('better-sqlite3')('data/gametoolx.db',{readonly:true});console.log('docs:',db.prepare('SELECT COUNT(*) as c FROM crawled_documents').get().c);console.log('chunks:',db.prepare('SELECT COUNT(*) as c FROM crawled_chunks').get().c);console.log('translations:',db.prepare(\"SELECT COUNT(*) as c FROM crawled_chunks WHERE translations != '{}'\").get().c);"

# 重跑爬虫（幂等，靠 SHA-256 content_hash）
npx tsx scripts/crawl-megaten.ts

# 重跑翻译（幂等，跳过已有目标语言的 chunk）
LLM_BASE_URL=https://api.minimaxi.com/v1 LLM_API_KEY=... npx tsx scripts/translate.ts --lang ja
```

### 手动测试路径
- `/zh/search?q=Metatron` → 应返回中文翻译
- `/en/search?q=Press%20Turn` → 返回英文原文
- `/ja/search?q=ルシファー` → 返回日文翻译
- `/tools/system-checker?game=shin-megami-tensei-5-vengeance&auto=true` → 浏览器 API 自动识别

---

## 操作上的坑（改代码前必读）

### 用户不写代码也不跑 git
所有代码 + git 推送由 agent 做。用户只发自然语言请求。

### GitHub 推送（3 件事要知道）
1. **`GIT_TERMINAL_PROMPT=0`** 已设为 user 级环境变量（Windows）—— GCM fallback 到 `store` helper，不弹框。
2. **`git config --global http.proxy=http://127.0.0.1:7890`** 已设 —— agent 的 bash 沙箱不走用户的 VPN，要绕到本地 Clash。
3. **Token 在 `~/.git-credentials`**（明文，store helper 读）。**不要**把 `.git-credentials` 加进 gitignore（默认就 ignored）。

如果 push 报 `Failed to connect to github.com port 443`：用户可能关了 VPN。让用户开 VPN 再试，不要乱改 git config。

### 文件大小限制
- `Write` 工具拒绝 > ~22KB 的文件。用 Python `json.dump`（`encoding='utf-8'`）或多 `Edit` 拆分。
- DB 写入用 `.cjs` 脚本（不用 `.ts`，避免 TS 编译复杂度）。

### PowerShell 5.1 坑
- `Remove-Item` 被 mavis 安全规则拦 → 用 `mavis-trash`。但**绝不要**把 mavis-trash 跟其他 PowerShell 命令串在同一条命令里（mavis-trash 是 Node.js 外部 CLI，PowerShell 不会自动分割复合参数 —— 见 agent memory，之前误删过 `mavis-portable` 整个目录）。
- `Get-Content` 不加 `-Encoding UTF8` 会把 CJK 按 GBK 解码（只影响显示，文件本身没事）。
- `git commit -m` 多行用 heredoc 报 ParserError → 用单行 message。
- `Start-Process` 跑 pnpm/npm/node → 用 `powershell -Command` 包，不能直接传 `D:\Path\file.exe`（路径含空格会断）。

### Windows 网络
- agent 的 bash 沙箱**不**继承用户 VPN。从沙箱直连 github.com:443 失败（GFW）。始终用 127.0.0.1:7890 代理。
- `git push` 用的环境变量和 `git config --global` 跨 shell 持久有效。不用反复设。

### LLM 翻译 guard 正则
`scripts/translate.ts` 里的防御 guard 拒绝以 `Game:` / `ゲーム：` / `게임：` / `Translation:` / `번역：` 开头（**带冒号**）的输出。**不要**放宽到 `게임 `（带空格）—— 那种会误杀"게임 디렉터 ..."这种正常韩文。`游戏 `（中文带空格）同理。

### SQLite WAL 模式
DB 文件小（`gametoolx.db` ~4KB）但 WAL 文件才是活跃工作区（`gametoolx.db-wal` ~135KB）。生产环境定期 `pragma wal_checkpoint(TRUNCATE)`。现在先不管。

### 翻译脚本并发
- `setChunkTranslationsBatch` 用 SQLite `json_set` 安全合并多进程按 lang 写入。**不要**改回 read-then-write `JSON.stringify`（会竞态）。
- 3 进程并行最优 —— 更多会撞 SQLite 写锁。

---

## 常见请求的处理方式

### "加新游戏"
1. 在 `data/games/<slug>.json` 写 `id` / `name`（4 语言）/ `steamAppId` / `cover` / `screenshots` / `systemReqs` / `metacritic` / `steamPercent`。
2. Steam 图下到 `public/images/games/<slug>/`（header/library/capsule/hero/logo + 6 张截图，URL 形如 `https://cdn.akamai.steamstatic.com/steam/apps/<appid>/...`）。
3. 每个工具在 `data/tools/<game>-<tool>.json` 写一份数据。
4. `data/i18n/{en,ja,ko,zh}.json` 加新 key（4 个文件对齐）。
5. dev server 测一遍 → commit + push。

### "加新工具类型"
1. 如果结构新，先在 `lib/data.ts` 定义 tool type。
2. `data/tools/<game>-<tool>.json` 写工具数据。
3. `components/tools/<NewTool>.tsx` 实现组件，props 模式统一（`lang` / `ui` / `tool` / `game`）。
4. `app/[lang]/tools/[slug]/page.tsx` 分发器加新 type 识别。

### "翻译新爬取的内容"
1. 确认 DB 在 schema v3（没在就 `scripts/apply-v3-migration.cjs`）。
2. 跑 `npx tsx scripts/translate.ts --lang <lang>`（用环境变量 LLM 凭据）。
3. 脚本跳过已有目标语言 key 的 chunk，重跑幂等。

### "推到 GitHub"
```bash
cd "D:\Idea Project\gametoolx"
git add <具体路径>     # 不要 git add -A（避免把 .next/、node_modules/、*.db-wal 一起加进来）
git commit -m "<type>: <subject>"   # 单行
git push origin master
```

push 卡住时：等 1-2 min，看 `git log --oneline origin/master -1` 是否真的推上去了。如果还卡，`netstat -ano | Select-String "github.com.*ESTABLISHED"` 找孤儿进程。

### "dev server 挂了"
1. `Get-Process node | Where-Object StartTime -gt (Get-Date).AddMinutes(-30)` 找最近的 node 进程
2. `Stop-Process -Id <pid> -Force` 杀挂的 dev server
3. `npm run dev` 重启
4. 端口 3000 被占：`netstat -ano | Select-String ":3000"` 找孤儿监听者

---

## DO NOT

- **不要**用 Node v26。永远 v24.16.0。
- **不要**用 `next-intl`（Next 16 移除了内置 i18n，但 `next-intl` 对本项目过度设计）。用自定义 `middleware.ts` 模式。
- **不要**用 AI 生成游戏美术。只用 Steam / Wiki。
- **不要**编造游戏数据（技能、攻略步骤、恶魔属性）。只用真实 Wiki / 社区源。
- **不要**直接改 `data/gametoolx.db`。用 `lib/db.ts` API 或 `scripts/apply-v3-migration.cjs`。
- **不要**把 `.git-credentials` 加进 gitignore。
- **不要**把 mavis-trash 跟其他 PowerShell 命令串一行（agent memory：曾误删 `mavis-portable` 整个目录）。
- **不要** commit `.next/`、`node_modules/`、`data/gametoolx.db*`、`next-env.d.ts`、`.dev-*.log`、`.env*.local`、`.dev-translate-*.{log,pid}` —— 都在 `.gitignore` 里。
- **不要**在用户明确 Go 决策前买域名或服务器。
- **不要**为低复杂度任务开新 agent（本项目模式已知，自己干就行）。
- **不要**对本项目用 `mavis team plan run` —— 设计迭代太频繁，owner-finished 死锁坑过（见 agent memory）。

---

## 关键文件指引

- **游戏数据**：`data/games/*.json` —— 参考 `octopath-traveler-2.json` 的 canonical 形状。
- **工具数据**：`data/tools/*.json` —— 最大例子 `octopath-traveler-2-job-recommender.json`（24 推荐 × 8 职业 × 10 技能）。
- **i18n key**：`data/i18n/{en,ja,ko,zh}.json` —— 4 个文件保持同步。
- **爬虫模式**：`scripts/crawl-megaten.ts` —— 用 Fandom MediaWiki API。新爬虫照这个模式。
- **DB API**：`lib/db.ts` —— `upsertSession` / `getOrCreateSessionId` / `upsertCrawledDocument` / `searchChunks({preferredLang})` / `getChunkTranslation` / `setChunkTranslation` / `setChunkTranslations`。
- **Session**：`lib/session.ts` —— `getOrCreateSessionId` 读 `gtx_sid` cookie 或生成 16 字节 hex（1 年有效期）。
- **i18n middleware**：`middleware.ts` —— 解析 `Accept-Language`、尊重 `gtx_lang` cookie、307 重定向到 `/<lang>/`。

---

## 卡住时

1. 读 `HANDOVER.md` —— 最新状态快照。
2. 读 `D:\Idea Project\dream\GameToolX-MVP-任务清单.md` —— 10 晚 MVP 计划和验收标准。
3. 看最近 5 个 commit：`git log --oneline -5`。
4. 读 agent 的 `MEMORY.md` —— 跨项目经验（LLM prompt 设计、SQLite json_set、mavis-trash 坑、git push 孤儿进程、Windows GCM）。
5. DB 看起来不对时：`node -e "const db=require('better-sqlite3')('data/gametoolx.db',{readonly:true});db.pragma('user_version');console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\"').all());"`
