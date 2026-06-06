# GameToolX 项目说明 (AGENTS.md)

> 任何 agent 接手本项目前必读。

## 项目定位

面向日/韩小语种市场的**游戏工具站**（非内容站），围绕 Humble Choice 月包热点快速上架工具页。完整决策见 `D:\Idea Project\dream\GameToolX-MVP-任务清单.md` 和 `C:\Users\zy187\WorkBuddy\2026-06-04-22-33-30\PRD-GameToolX.md`。

## 关键路径

| 项 | 路径 |
|----|------|
| 项目根 | `D:\Idea Project\gametoolx\` |
| GitHub | https://github.com/PandaltsGo/gametoolx |
| 任务清单 | `D:\Idea Project\dream\GameToolX-MVP-任务清单.md` |
| PRD | `C:\Users\zy187\WorkBuddy\2026-06-04-22-33-30\PRD-GameToolX.md` |
| IMPLEMENTATION | `C:\Users\zy187\WorkBuddy\2026-06-04-22-33-30\IMPLEMENTATION-GameToolX.md` |

## 技术栈（实际版本，非 PRD 默认）

- **Node.js**: v24.16.0（用户偏好 24 LTS 最新 patch，**不要升 26**）
- **Next.js**: 16.2.7（App Router + Turbopack）
- **React**: 19.2.4
- **Tailwind**: v4
- **TypeScript**: 5
- **i18n**: Next.js 16 已移除内置 i18n，必须用 `next-intl` 库（IMPL 2.1 节代码已过期，要重写）

## 工作流（关键约束）

### 用户不碰代码
**用户不写代码，不跑 git 命令。** 所有代码改动 + GitHub 推送由 agent 负责。

### 每次改完代码 → 自动推送
```bash
cd "D:\Idea Project\gametoolx"
git add -A
git commit -m "<type>: <subject>"
git push
```

**认证**:
- `git config --global credential.helper store` 已配
- PAT 存于 `~/.git-credentials`
- git push 自动用，无需贴 token

### dev server 持续跑
- 路径: `D:\Idea Project\gametoolx\`
- 命令: `npm run dev`（后台）
- 日志: `D:\Idea Project\gametoolx\.dev-stdout.log` / `.dev-stderr.log`（在 .gitignore）
- 验证: `localhost:3000` 返 200
- **改代码后 Next.js 会自动热重载**，不用重启 dev server

### 部署（仅在 Go 决策后）
- 腾讯云域名 + 首尔 2C4G 轻量服务器
- 用 aaPanel（宝塔海外版），详细步骤见任务清单"上线准备"章节

## 数据原则

- 翻译用 LLM（mavis / ChatGPT），0 成本
- 不找母语者校对（MVP 阶段）
- 工具数据用 JSON 文件，**不**用数据库
- 游戏数据来源：Steam 商店页 + 游戏 Wiki

## MVP 节奏

10 晚完成（每天 2h），每晚任务见任务清单。当前进度：

- ✅ 第 1 晚：项目骨架 + 推 GitHub
- ⏳ 第 2 晚：Steam 数据预热
- ⏳ 第 3-4 晚：配置检测器 + 职业推荐器
- ⏳ 第 5 晚：聚合页 + 首页
- ⏳ 第 6 晚：SEO 基础设施
- ⏳ 第 7 晚：LLM 自校
- ⏳ 第 8 晚：推广预热
- ⏳ 第 9 晚：数据基线
- ⏳ 第 10 晚：2 周复盘 + Go/No-Go

## 验证线

2 周后 OT2 工具页 UV > 100 = Go，< 30 = Stop，30-100 = Pivot。
