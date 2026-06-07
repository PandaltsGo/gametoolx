# GameToolX

> 面向小语种市场（日 / 韩 / 中）的多游戏工具站。
> 当前 2 款游戏、6 个工具、4 种语言，RAG 数据层已就绪等待 AI Q&A 接入。

[功能](#功能) • [技术栈](#技术栈) • [开发](#开发) • [贡献](#贡献) • [许可](#许可)

---

## 这是什么

**多游戏工具平台** —— 不是内容站。每款游戏提供：

- **系统配置检测** —— 你的 PC 跑不跑得动
- **配装推荐** —— 来自真实社区数据的 build
- **流程攻略** —— 带出处引用的结构化 step-by-step
- **结局追踪** —— 记录已解锁结局（DB 持久化，跨设备）
- **路线选择器** —— 多分支游戏的问答推荐
- **仲魔合体计算器** —— 按名 / 属性搜恶魔和配方

所有数据来自真实游戏 Wiki 和社区攻略，**绝不**用 AI 编造。UI 全部翻译为 **日 / 韩 / 中 / 英** 4 种语言。

## 为什么

小语种市场（JP / KR / CN）被英文为主的工具站服务得很差。GameToolX 想把高质量的、母语级的游戏工具带到这些受众面前。

## 功能

- 4 种语言：**日 / 韩 / 中 / 英**（自动从 `Accept-Language` 检测，cookie 持久化偏好）
- 真实游戏数据，源自 Steam + 社区 Wiki（MegaTen Wiki、NGA、3DM、GameWith 等）
- 跨设备进度追踪（匿名 session，DB 持久化）
- RAG 数据层：爬取内容 + FTS5 搜索 + LLM 翻译 chunks
- 通用系统检测器（任何有数据的游戏都能用）

## 当前支持的游戏

| 游戏 | 工具 |
|------|------|
| 歧路旅人 II / Octopath Traveler II | 系统检测、Job 推荐 |
| 真・女神转生Ⅴ 复仇 / Shin Megami Tensei V: Vengeance | 系统检测、结局追踪、流程攻略、路线选择、仲魔合体 |

## 技术栈

- **前端**：Next.js 16（App Router）+ React 19 + Tailwind v4 + TypeScript 5
- **后端**：Next.js API routes + Node.js v24.16.0
- **数据库**：SQLite（better-sqlite3 + WAL），搜索用 FTS5
- **i18n**：自定义 middleware + cookie 持久化
- **翻译**：LLM（MiniMax-Text-01，OpenAI 兼容）
- **爬虫**：Fandom MediaWiki API

## 开发

### 环境要求
- Node.js **v24.16.0**（有 nvm 就 `nvm use`）
- pnpm（推荐）或 npm

### 启动
```bash
git clone https://github.com/PandaltsGo/gametoolx.git
cd gametoolx
npm install
npm run dev
# http://localhost:3000
```

首次访问会按 `Accept-Language` 自动 307 重定向到 `/<浏览器语言>/`。

### 数据文件
- `data/games/*.json` —— 游戏元数据
- `data/tools/*.json` —— 工具配置（推荐、攻略、...)
- `data/i18n/{en,ja,ko,zh}.json` —— UI 翻译（4 个文件同步维护）
- `data/gametoolx.db` —— SQLite DB（gitignored，含爬取的 RAG 内容）

### 加新游戏
详见 `AGENTS.md` 的 canonical 流程（游戏数据 → 工具数据 → 图片 → i18n）。

### 加新工具
详见 `AGENTS.md` 的 canonical 流程（工具 type → 数据 → 组件 → 分发器）。

## 贡献

欢迎贡献：
- **新游戏数据**（推荐、攻略、结局、合体配方）—— 必须来自真实源（Wiki、社区）
- **翻译** —— 帮我们改进 4 语言 UI 质量
- **新爬虫** —— 接入更多社区数据源

提 PR 前请先读 `AGENTS.md` 理解架构和约束。

## 许可

待定。当前单人开发项目。

## 联系

在 GitHub 开 issue。
