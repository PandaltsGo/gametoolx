# GameToolX — LLM 翻译 Prompt 模板

> 用于把英文 JSON 翻译成日文/韩文。
> 适用：mavis / ChatGPT 网页 / Claude / 其他 LLM。
> 目标：MVP 阶段省 Fiverr 钱，接受 LLM 翻译不完美的现实。

---

## 使用流程

1. 准备英文 JSON（`data/games/*.json`、`data/tools/*.json`）
2. 查 Wiki 拿到**游戏内官方日韩译名**（参考附录）
3. 把下面 prompt 复制给 LLM，**把占位符替换为实际内容**
4. LLM 输出 JSON 后，**用脚本合并到原 JSON**（保留 en、加 ja/ko）
5. 自查机翻感（虽然不懂日语，但排除明显问题：过长句、被动语态堆砌、敬语混乱）

---

## Prompt 模板（复制用）

```
你是 GameToolX 站点的本地化翻译员。这是个面向日本/韩国 PC 玩家的游戏工具站（不是内容站），
工具类型包括：系统配置检测器、职业搭配推荐器、抽卡模拟器、成就追踪器。

## 任务
把下面 JSON 里的英文文本翻译成 {LANG}（{LANG_NAME}），输出**完整 JSON**。

## 风格要求
- 语气参考：{STYLE_REF}
- 像日本/韩国游戏攻略网站常用的实用、简洁风格
- 不要翻译腔、避免过度敬语、避免被动语态堆砌
- 玩家会搜索的关键词要自然出现（SEO 友好）
- 短句优先，能用词的不用句

## 严格规则
1. **保持 JSON 结构完全一致**（键名、嵌套层级、数组顺序都不动）
2. **只翻译空字段**（{LANG} 值为 "" 或缺失的）
3. 不翻译：数字、硬件型号（RTX 3060 等）、URL、专有名词
4. 游戏内专有名词**用下方官方译名**，不要自创
5. UI 文字（按钮、标签）要简短，控制在 2-8 个字
6. 描述/理由类要"自然口语"，像玩家之间说话

## 游戏内官方译名对照表
{TERM_TABLE}

## 输入 JSON
```json
{INPUT_JSON}
```

## 输出要求
**只输出 JSON**，不要 markdown 围栏（不要 ```json ... ```），不要任何解释文字。
```

---

## 占位符说明

| 占位符 | 例子 |
|--------|------|
| `{LANG}` | `ja` 或 `ko` |
| `{LANG_NAME}` | `日本語` 或 `한국어` |
| `{STYLE_REF}` | `gamewith.jp, game8.jp (日本)` 或 `inven.co.kr, dcinside.com (韩国)` |
| `{TERM_TABLE}` | 见下表 |
| `{INPUT_JSON}` | 待翻译的英文 JSON |

---

## OT2 专有名词对照表（手动维护）

| en | ja | ko |
|----|----|----|
| Octopath Traveler II | 歧路旅人II | 옥토패스 트래블러 II |
| Warrior | 剣士 | 검사 |
| Merchant | 商人 | 상인 |
| Scholar | 学者 | 학자 |
| Dancer | 踊り子 | 무희 |
| Hunter | 狩人 | 사냥꾼 |
| Apothecary | 薬師 | 약사 |
| Thief | 盗賊 | 도적 |
| Cleric | 神官 | 사제 |
| Hikari | ヒカリ | 히카리 |
| Agnea | オフィリア | 아그네아 |
| Partitio | パルティシオ | 파르티시오 |
| Osvald | オスバルド | 오스발트 |
| Temenos | テメノス | 테메노스 |
| Throne | トロンオ | 트로네오 |
| Castti | キャスティ | 캐스티 |
| Ochette | オーシュット | 오셰트 |

---

## 用 mavis 调翻译（更省事）

如果你常用 mavis，可以写一个简单的脚本：

```typescript
// scripts/translate.ts
import { readFileSync } from 'fs';
import { mavis } from '@mavis/sdk'; // 假设有 SDK

async function translateJson(inputPath: string, targetLang: 'ja' | 'ko') {
  const json = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const prompt = buildPrompt(json, targetLang);  // 用上面模板
  const result = await mavis.chat(prompt);        // 调 LLM
  const translated = JSON.parse(result);
  mergeLangFields(json, translated, targetLang); // 合并
  return json;
}
```

**MVP 阶段不实现这个脚本**，用 ChatGPT 网页手动跑即可。

---

## 自查清单（翻译完后过一遍）

- [ ] JSON 结构没动（用 jq 或 python 验证）
- [ ] 所有 `""` 空字段都有新值
- [ ] 没有意外翻译数字/型号
- [ ] 长度差异 < 50%（过长可能机器翻译堆砌）
- [ ] 多次跑不同 LLM 选最好版本
