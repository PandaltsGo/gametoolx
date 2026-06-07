# GameToolX — 推广草稿 (2026-06-06)

> 这些是模板，**不直接发**。要你登录对应账号后**人工发帖**（避免 spam 风险 + 账号风控）。
> 截图（OG 图）你按下面指示自己截。

---

## 1. r/octopathtraveler (英文 Reddit)

**URL**: https://www.reddit.com/r/octopathtraveler/submit
**Audience**: OT2 玩家（最精准）
**Format**: Text post + 1-2 截图

### 标题（短，钩子强）

```
I made a free System Requirements Checker + Job Recommender for OT2 (no signup, runs in browser)
```

### 正文

```markdown
Hey all — built a small set of tools for Octopath Traveler II after finishing my first playthrough.
Both are free, no signup, no ads-as-you-use-it (just a single small ad slot to pay for hosting).

## What's there

**1. System Requirements Checker**  
→ https://gametoolx.top/en/tools/octopath-traveler-2-system-checker  
Tells you if your PC can run OT2 (matches min/recommended + suggests graphics settings).  
Also has a JP version: https://gametoolx.top/ja/tools/octopath-traveler-2-system-checker

**2. Job / Build Recommender**  
→ https://gametoolx.top/en/tools/octopath-traveler-2-job-recommender  
Pick the jobs you've unlocked + your playstyle (attack/magic/speed/balanced/support) → get a suggested 4-person party with a reason explaining why.  
Also JP: https://gametoolx.top/ja/tools/octopath-traveler-2-job-recommender

## Why I made this

- I don't actually play OT2 (yet), so the recommendations are pulled from public guides + Wiki data, **not** my personal experience
- Designed for the *browse-once* use case: figure out if your laptop can run it, or get a quick party suggestion when you're stuck
- No tracking, no email capture, no Discord pop-up

## What it doesn't have (yet)

- No achievement tracker (couldn't scrape Steam achievement data reliably)
- No gacha sim (OT2 doesn't have one — the game has zero RNG for jobs, lol)

## Caveats

- The English translations are LLM-assisted, not native. If something reads weird, tell me in the comments and I'll fix it.
- The Japanese version is what the Japanese market is the target — JP feedback is especially welcome.

Feedback / bug reports welcome. If there's interest, I'll add more games from the next Humble Choice batch.

— PandaltsGo
```

### 截图指引

打开 `/ja/tools/octopath-traveler-2-system-checker` ，填一个常见 PC 配置（如 i5-12400F + RTX 3060 + 16GB + SSD），点 "チェックする" 截全屏，**约 60-80% 屏**（含结果区）最佳。

---

## 2. r/Switch (英文 Reddit)

**URL**: https://www.reddit.com/r/NintendoSwitch/submit
**Audience**: Switch 玩家（含 OT2 Switch 玩家）
**Note**: Switch 不跑 PC 工具，**但 OT2 在 Switch 上也是同一游戏**，job recommender 对 Switch 玩家也适用

### 标题

```
Free browser tool: which Octopath Traveler 2 jobs should I use? (party recommender, 12 builds, no signup)
```

### 正文

```markdown
Made a free Job Recommender for OT2 — works for both Switch and Steam versions, just runs in your browser:

→ https://gametoolx.top/en/tools/octopath-traveler-2-job-recommender

Pick the jobs you've unlocked + your playstyle, get a suggested 4-person party with a reasoning field explaining the strengths.

There's also a System Requirements Checker if you want to know if your PC can run it:
→ https://gametoolx.top/en/tools/octopath-traveler-2-system-checker

Both have Japanese versions too. No signup, no ads-as-you-use-it.

Feedback appreciated.
```

---

## 3. 5ch ゲーム板 (日语论坛)

**URL**: 5ch.net (常用板: ゲーム総合 / ロールプレイングゲーム)
**Audience**: 日本 OT2 玩家
**Note**: 5ch 有严重 anti-spam，新号发主题贴要谨慎

### 短文

```
【ツール】歧路旅人II向けの便利ツール作った

歧路旅人II向けに2つツール作った、全部ブラウザで無料、登録不要。

■ 動作環境チェッカー
https://gametoolx.top/ja/tools/octopath-traveler-2-system-checker
自分のPCで動作するかすぐ分かる、推奨設定も出る

■ 職業推奨ツール
https://gametoolx.top/ja/tools/octopath-traveler-2-job-recommender
解放済み職業と好みを入れると推奨パーティ提案、12種類の組み合わせ

感想・要望あればコメントください。
```

---

## 4. Twitter/X (英语 + 日语双语)

**URL**: https://x.com/compose/post
**Audience**: 关注你的 + hashtag 用户
**Format**: Thread (多帖)

### Thread (英语版)

```
Tweet 1/4:
Just launched GameToolX — free browser tools for Octopath Traveler II players:

🔧 System Requirements Checker
🎯 Job / Build Recommender (12 build templates)

No signup, no email, no paywall.
[JP version linked below]

#OctopathTraveler2 #ゲーム攻略

Tweet 2/4:
System Requirements Checker:
→ https://gametoolx.top/en/tools/octopath-traveler-2-system-checker
→ https://gametoolx.top/ja/tools/octopath-traveler-2-system-checker

Tells you if your PC can run OT2 and suggests graphics settings.
[JP screenshot]

Tweet 3/4:
Job Recommender:
→ https://gametoolx.top/en/tools/octopath-traveler-2-job-recommender
→ https://gametoolx.top/ja/tools/octopath-traveler-2-job-recommender

Pick unlocked jobs + playstyle → get a party suggestion with reasoning.
6 playstyles, 12 templates.
[JP screenshot]

Tweet 4/4:
Made this because I wanted a quick "can my laptop run this?" + "what party should I bring" without 30-min YouTube videos.

Feedback welcome — especially from JP users, the JP translations are LLM-assisted.

— PandaltsGo (@你的handle)
```

---

## 截图清单（你截）

| 平台 | 路径 | 大小 |
|------|------|------|
| Twitter 1 | `localhost:3000/ja` 首页 | 全屏 |
| Twitter 2 | `localhost:3000/ja/tools/octopath-traveler-2-system-checker` 输入示例配置后 | 含结果区 |
| Twitter 3 | `localhost:3000/ja/tools/octopath-traveler-2-job-recommender` 选几个 job + playstyle 后 | 含结果区 |
| Reddit | 同上，1-2 张 | 同上 |

---

## 发帖时间建议

| 平台 | 最佳时段 (Asia/Tokyo) |
|------|----------------------|
| Reddit | 平日 21:00-23:00（美西时间早上 5-7AM，Reddit 高峰）|
| 5ch | 平日 20:00-24:00（日本夜猫子高峰）|
| Twitter | 平日 12:00-13:00 / 19:00-21:00（午休/晚高峰）|

---

## ⚠️ 注意

1. **Reddit 反 spam 严**：新号不要 1 天内发 3+ 帖，至少隔 1 天
2. **5ch 反 spam 严**：新号要"馴染む"几天再发主题贴
3. **不要用 reddit/5ch 账号广告语气**：会被秒删
4. **发完后 24h 内回复评论**：否则风控会标
5. **链接到工具页**（不是 Twitter），Twitter 会压 link click rate

---

## 数据追踪

每帖发完记一下：
- URL
- 发出时间
- 24h 后流量
- 评论数

我建一个 `data/promotion-log.json` 自动跟踪，但**需你**录入。
