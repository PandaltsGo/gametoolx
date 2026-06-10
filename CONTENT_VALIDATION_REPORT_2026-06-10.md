# GameToolX 内容校验报告

生成时间：2026-06-10 HKT

校验范围：
- `data/tools/*.json` 中的攻略、结局、合体、职业推荐、系统检测工具数据。
- `data/games/*.json` 中的系统配置字段。
- `public/images/games/**` 中被工具数据引用的图片路径。

校验方法：
- 本地结构化检查：JSON 结构、图片路径是否存在、图片引用类别是否明显不匹配。
- 外部交叉核验：使用 Game8、PowerPyx、Steam/公开攻略页等资料核对关键事实。
- 本报告优先列出会误导用户、导致页面 404、或破坏攻略可信度的问题。

外部参考源：
- Game8 OT2 Jobs / Licenses: https://game8.co/games/Octopath-Traveler-2/archives/405914
- Game8 OT2 Chapters / Routes: https://game8.co/games/Octopath-Traveler-2/archives/405916
- Game8 SMTV Endings: https://game8.co/games/Shin-Megami-Tensei-V/archives/348226
- PowerPyx SMTV Vengeance All Endings: https://www.powerpyx.com/shin-megami-tensei-v-vengeance-all-endings-guide/
- PowerPyx SMTV Vengeance Godborn: https://www.powerpyx.com/shin-megami-tensei-v-vengeance-how-to-unlock-godborn-difficulty/
- Game8 SMTV Demon List: https://game8.co/games/Shin-Megami-Tensei-V/archives/348028

## 总结

当前内容不能直接视为“已通过内容校验”。主要问题集中在 SMT5V 结局与终局内容、SMT5V 图片引用、OT2 部分许可证/章节描述、以及 SMT5V 合体/恶魔资料。

严重度统计：
- P0 确定错误：6 项
- P1 高风险/需修正：7 项
- P2 质量与一致性问题：5 项

## P0 确定错误

### 1. SMT5V 结局数错误：项目写“全 7 结局”，外部主流来源为 6 个结局

位置：
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:13`
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:15`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:1673`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:1789`

本地内容：
- 标题/描述写“全 7 结局”。
- 数据将 `New Game+ · Rebirth / 创生结局` 当作第 7 个结局。
- walkthrough 又额外写了“复仇线 · 中立（可选结局）”。

核验结论：
- PowerPyx 明确列出 SMTV Vengeance 有 6 个结局。
- Game8 也按 Canon of Creation 4 个 + Canon of Vengeance 2 个组织。
- Godborn / 创生是 NG+ 高难模式，不是额外剧情结局。

建议修复：
- 将 endings-tracker 改为“全 6 结局”。
- 删除 `ngplus-rebirth` 作为 ending 的呈现，改成“终局挑战 / Godborn 模式解锁说明”。
- walkthrough 中删除“复仇线 · 中立（可选结局）”作为独立结局的标题；可改为“中立倾向时可在最终选择中偏向 Tao/Yoko”。

### 2. SMT5V Godborn / 创生模式被误写为结局与 Lv150 结局路线

位置：
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:490`
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:512`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:1799`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:1884`

本地内容：
- “创生模式将敌人提升至 Lv150，并解锁最后一个专属结局。”
- “Defeat Satan → unlock Creation Ending trophy。”

核验结论：
- PowerPyx Godborn 指南描述的是解锁 Godborn 难度/模式，不是解锁第 7 结局。
- Satan 是 Godborn 相关终局挑战，不应写成“创生结局”。

建议修复：
- 改为“Godborn 模式 / Lv150 终局挑战”。
- 奖励描述改为可解锁或完成相关奖杯/挑战，不要写成 ending。

### 3. SMT5V 图片路径缺失 / 404

位置：
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:3066`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:3326`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:3636`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:3863`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:4490`

缺失引用：
- `/images/games/shin-megami-tensei-5-vengeance/regions/region-029-39bda9dc.jpg`
- `/images/games/shin-megami-tensei-5-vengeance/regions/region-031-2b59cae5.jpg`
- `/images/games/shin-megami-tensei-5-vengeance/regions/region-033-fbbef3a3.jpg`
- `/images/games/shin-megami-5-vengeance/demons/demon-262-74cc4663.jpg`
- `/images/games/shin-megami-tensei-5-vengeance/bosses/boss-019-1748932a.jpg`

核验结论：
- 文件系统中不存在这些目标文件。
- `shin-megami-5-vengeance` 是错误目录名，应为 `shin-megami-tensei-5-vengeance`。
- `boss-019-1748932a.jpg` 不存在，但存在 `boss-078-1748932a.jpg`。

建议修复：
- 批量校正路径。
- 对不存在的 region 图片，删除图片字段或替换为实际存在的 `region-024/025/026/027/028/029-c352c260` 之一，但必须确认图像语义。

### 4. SMT5V Boss 块引用了地图/宝箱类图片，属于误用

位置：
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:3353` Marici
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:3393` Odin
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:3703` Chi You
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:4130` Odin build

问题引用：
- Marici 使用 `/chests/chest-053-fee23202.jpg`
- Odin 使用 `/chests/chest-052-41c4efef.jpg`
- Chi You 使用 `/chests/chest-057-460850b9.jpg`

核验结论：
- 本地视觉检查 `chest-053-fee23202.jpg` 实际是台东区地图截图，不是 Boss 图。
- 即使文件夹名为 `chests`，图像内容也不是对应 Boss 肖像/战斗画面。

建议修复：
- Boss 块没有准确 Boss 图时，优先设为 `null`。
- 如果要保留区域地图，应放入 `region` 或 `region_map` 块，不应挂在 boss.image。

### 5. OT2 学者许可证 2 获取方式错误

位置：
- `data/tools/octopath-traveler-2-walkthrough.json:232`
- `data/tools/octopath-traveler-2-job-recommender.json:577`

本地内容：
- 写成“defeat the boss in the Abandoned Factory for 5 Ancient Sentinel Cores”。

核验结论：
- Game8 的学者许可证说明中，Ancient Sentinel Core 来自 Wandering Wood 的 Remnant，可偷取/掉落。
- Abandoned Factory boss 这条不符合公开攻略源。

建议修复：
- 改为“Scholar license 2/3 需要 Ancient Sentinel Core；推荐在 Wandering Wood 找 Remnant 获取。”
- 不要绑定 Partitio Ch.2 / Abandoned Factory boss。

### 6. SMT5V 系统检测读取字段与游戏数据字段不一致，会导致结果不准

位置：
- `data/games/shin-megami-tensei-5-vengeance.json:83`
- `data/games/shin-megami-tensei-5-vengeance.json:91`
- `components/tools/SystemChecker.tsx:190`
- `components/tools/SystemChecker.tsx:211`
- `components/tools/SystemChecker.tsx:232`

本地状态：
- SMT5V 游戏数据使用 `processor / memory / graphics`。
- SystemChecker 只读 `cpu / ram / gpu`。

影响：
- SMT5V 的推荐配置比较会退回默认值或空值，用户会得到错误兼容性结果。

建议修复：
- 统一 game JSON 字段为 `cpu/ram/gpu`。
- 或在 SystemChecker 中兼容读取 `processor/memory/graphics`。

## P1 高风险 / 需修正

### 7. SMT5V Canon of Vengeance 结局倾向描述混乱，Tao/Yoko 与 Law/Chaos 关系需要重写

位置：
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:381`
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:383`
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:431`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:1452`
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:1568`

风险：
- 本地多处把 Law/Chaos、Tao/Yoko、新秩序/混沌结局混写。
- 用户按该攻略做选择，可能无法稳定复现预期结局。

建议修复：
- 以 PowerPyx / Game8 的 6 ending 框架为准，重新写 CoV 两个结局条件。
- 不要同时使用“Law tendency”“Yoko leads new divine order”这类容易自相矛盾的表达。
- 每个结局只列“进入路线条件 + 最终分歧条件 + 是否需要特定支线”。

### 8. SMT5V 真结局条件存在不确定/疑似错误项

位置：
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:296`
- `data/tools/shin-megami-tensei-5-vengeance-endings-tracker.json:298`

风险：
- 写了“Have Tao Isonokami available / 让多绪加入队伍”作为真结局条件。
- 公开攻略通常强调的是 CoC True Neutral 的支线链、Khonsu 存活、Shiva 等关键条件；Tao 表述需要再核源。

建议修复：
- 重核 CoC true neutral 条件。
- 如果 Tao 只是剧情随行或误解，应删除。

### 9. SMT5V 合体计算器恶魔资料大量疑似不准确

位置：
- `data/tools/shin-megami-tensei-5-vengeance-fusion-calculator.json`

样例：
- Apsaras 本地：Lv11 race=yoma。公开资料中 Apsaras 在 SMTV 系列通常不是这个组合。
- Anat 本地：Lv29 lady。公开资料中 Anat 等级明显更高。
- Alice 本地：Lv55 lady。公开资料中 Alice 在 SMTV 通常为 Fiend / Lv40 级段。
- Anubis 本地：Lv50 tyrant。公开资料中 Anubis 通常不是 tyrant。
- Mara 出现两次：`tyrant Lv70` 与 `tenma Lv65`，同名跨 race/level 需要强校验。
- Kikuri-Hime 与 Kikuri 重复，疑似同一角色命名拆分。

核验结论：
- Game8 Demon List 与本地抽样存在多处不一致。
- 当前仅 69 个 demons，且没有真实 special recipe 表，不能称为完整 SMT5V fusion calculator。

建议修复：
- 用稳定来源重建 demons：英文名、日文名、race、level、是否 DLC、unlock 条件。
- 合体计算器应先降级文案：从“fusion calculator”改为“sample demon lookup / partial fusion helper”，直到数据完整。

### 10. SMT5V walkthrough 写“特殊合体 3-4 ingredients”，但本地数据和游戏事实不匹配

位置：
- `data/tools/shin-megami-tensei-5-vengeance-walkthrough.json:134`
- `data/tools/shin-megami-tensei-5-vengeance-fusion-calculator.json:1510`

问题：
- walkthrough 写 special fusion uses 3-4 ingredients。
- fusion 文件内部 note 又出现“7-way special fusion”。

建议修复：
- 改成“特殊合体使用固定配方，素材数量不固定”。
- 不要写死 3-4。

### 11. OT2 章节结构过度泛化：写“第 4-5 章 / 第 5 章 Boss”，不适用于所有角色

位置：
- `data/tools/octopath-traveler-2-walkthrough.json:355`
- `data/tools/octopath-traveler-2-walkthrough.json:369`

问题：
- OT2 不是所有角色都有 Ch.5。
- Game8 的 route/chapter 列表显示不同角色章节数量不同，且有 crossed paths / final chapter。

建议修复：
- 改为“后期角色终章 Boss（Ch.4 或 Ch.5，视角色而定）”。
- 每个角色单列章节终点更稳。

### 12. OT2 “每 NPC 最多偷 3 件”需要核实或删除

位置：
- `data/tools/octopath-traveler-2-walkthrough.json:129`

风险：
- OT2 的 Steal/Purchase 是 NPC 持有物品列表，不应泛化为每 NPC 最多 3 件。
- 该建议会误导用户反复 SL。

建议修复：
- 改为“NPC 可偷取/购买的物品数量取决于该 NPC 的库存；战前存档可降低失败惩罚。”

### 13. OT2 “第 1 章 Boss 是主角单人战”表述需放宽

位置：
- `data/tools/octopath-traveler-2-walkthrough.json:191`

风险：
- 如果用户从其他主角章节开始，章节体验与队伍状态会因招募顺序不同而不同。
- 建议改成“首次选择主角的 Ch.1 为单人体验；后续招募其他角色时可能按章节模式处理。”

## P2 质量与一致性问题

### 14. 通用 system-checker 与 OT2 旧 system-checker 并存

位置：
- `data/tools/system-checker.json`
- `data/tools/octopath-traveler-2-system-checker.json`

影响：
- 首页/游戏页可能同时出现通用系统检测器和旧 per-game 系统检测器。

建议：
- 如果通用入口已是目标架构，删除或隐藏旧 `octopath-traveler-2-system-checker.json`。
- 或在 listTools 时过滤旧 system checker。

### 15. 图片目录分类不可信

观察：
- `chests/` 下有地图图。
- `bosses/` 与 `demons/` 有大量完全相同 SHA-1 图片。
- 这不一定都是错误，但说明图片命名来源不是语义映射，而是批量导入。

建议：
- 为每张图片建立 manifest：`id / semanticType / subject / source / localPath`。
- 工具数据只引用 manifest id，不直接写路径。

### 16. Source URL 有些为 `null` 或私有/不可访问来源

位置：
- 多个工具 JSON 的 `sources`。

风险：
- “Pser_hanser 攻略文档（飞书）”这类来源如果不可公开访问，用户无法复核。

建议：
- 保留私有来源时，补充至少 1 个可公开访问的交叉来源。
- 私有来源作为 attribution，不要作为唯一事实依据。

### 17. Walkthrough 的 sources 颗粒度不够

问题：
- 顶层 sources 有，但很多具体 boss/route/fusion 条目没有能定位到对应事实的来源。

建议：
- 对高风险条目加 block-level sources：boss 弱点、结局条件、隐藏职业、特殊合体。

### 18. 本轮未做完整视觉识别

说明：
- 本轮已做路径存在性、目录类别、抽样视觉检查。
- 未对 353 张图片逐张识别主体，因此“图片误用”报告只覆盖确定性错误和强信号错误。

建议：
- 下一步可做图片 manifest + 人工/模型视觉标注，逐张确认 boss/demon/chest/region 是否匹配。

## 建议修复优先级

1. 立即修复 SMT5V 结局数：7 改 6；移除创生结局；修正 CoV 两结局文案。
2. 立即清理 walkthrough 中 9 个坏图片引用；Boss 没准图就设为 `null`。
3. 修复 SystemChecker 字段兼容，否则 SMT5V 检测结果不可信。
4. 修正 OT2 Scholar license 获取方式。
5. 重建 SMT5V fusion calculator 数据，至少先修正 demons 的 level/race。
6. 对所有攻略高风险事实补 block-level sources。

## 可执行检查命令

图片路径与类别检查可复用以下脚本：

```powershell
@'
const fs=require('fs');
const root='D:/Idea Project/gametoolx';
function walk(obj, cb, p=[]){
  if(Array.isArray(obj)) obj.forEach((v,i)=>walk(v,cb,p.concat(i)));
  else if(obj&&typeof obj==='object'){
    for(const [k,v] of Object.entries(obj)){
      cb(k,v,p.concat(k),obj);
      walk(v,cb,p.concat(k));
    }
  }
}
for(const f of fs.readdirSync(root+'/data/tools').filter(x=>x.endsWith('.json'))){
  const j=JSON.parse(fs.readFileSync(root+'/data/tools/'+f,'utf8'));
  walk(j,(k,v,p,parent)=>{
    if(k==='image' && typeof v==='string'){
      const rel=v.startsWith('/')?v.slice(1):v;
      const issues=[];
      if(!fs.existsSync(root+'/public/'+rel)) issues.push('MISSING');
      if(parent.type==='boss' && /\/chests\//.test(v)) issues.push('BOSS_USES_CHEST');
      if(parent.type==='region' && !/\/regions\//.test(v)) issues.push('REGION_NON_REGION');
      if(issues.length) console.log(f, p.join('.'), parent.name?.en || parent.name?.zh || '', v, issues.join(','));
    }
  });
}
'@ | node -
```

