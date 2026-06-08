"use client";

import { useState, useMemo } from "react";
import type { ToolData } from "@/lib/data";

type Props = { tool: ToolData };

type Localized = { en: string; ja?: string; ko?: string; zh?: string };
type Race = { id: string; en: string; ja?: string; ko?: string; zh?: string };
type Demon = {
  id: string;
  name: Localized;
  race: string;
  level: number;
  stats: { str: number; mag: number; vit: number; agi: number; luc: number };
};
type FusionEntry = {
  ingredients: string[];
  race: string;
  note?: string;
};

const t = (obj: Localized | undefined, lang: string): string => {
  if (!obj) return "";
  return obj[lang as keyof Localized] || obj.en || "";
};

type RecipeRow = {
  resultId: string;
  result: Demon | null;
  entry: FusionEntry;
};

export default function FusionCalculator({ tool }: Props) {
  const lang = "zh";
  const races = (tool.data.races as Race[]) || [];
  const demons = (tool.data.demons as Demon[]) || [];
  const chart = (tool.data.fusionChart as Record<string, FusionEntry>) || {};

  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [pickedA, setPickedA] = useState<Demon | null>(null);
  const [pickedB, setPickedB] = useState<Demon | null>(null);

  const getName = (d: Demon) => t(d.name, lang);
  const getRace = (rId: string) => {
    const r = races.find((x) => x.id === rId);
    return r ? t(r as unknown as Localized, lang) : rId;
  };

  const filteredDemons = (query: string) => {
    const q = query.toLowerCase();
    if (!q) return demons;
    return demons.filter((d) => {
      const n = getName(d).toLowerCase();
      const e = d.name.en?.toLowerCase() || "";
      const j = d.name.ja?.toLowerCase() || "";
      return n.includes(q) || e.includes(q) || j.includes(q) || d.id.toLowerCase().includes(q);
    });
  };

  // Helper: find demon by id (may return null for chart aliases like metatronA)
  const findDemon = (id: string): Demon | null =>
    demons.find((d) => d.id === id) || null;

  // === Recipe lookups ===
  // 2-way exact match between pickedA and pickedB
  const exact2Way = useMemo<RecipeRow | null>(() => {
    if (!pickedA || !pickedB) return null;
    const ids = [pickedA.id, pickedB.id].sort();
    for (const [resultId, entry] of Object.entries(chart)) {
      if (entry.ingredients.length === 2) {
        const sorted = [...entry.ingredients].sort();
        if (sorted[0] === ids[0] && sorted[1] === ids[1]) {
          return { resultId, result: findDemon(resultId), entry };
        }
      }
    }
    return null;
  }, [pickedA, pickedB, chart, demons]);

  // 3-way/4-way recipes that contain BOTH pickedA and pickedB
  const multiwayWithBoth = useMemo<RecipeRow[]>(() => {
    if (!pickedA || !pickedB) return [];
    return Object.entries(chart)
      .filter(([_, entry]) => {
        if (entry.ingredients.length < 3) return false;
        const ing = new Set(entry.ingredients);
        return ing.has(pickedA.id) && ing.has(pickedB.id);
      })
      .map(([resultId, entry]) => ({ resultId, result: findDemon(resultId), entry }))
      .sort((a, b) => a.entry.ingredients.length - b.entry.ingredients.length);
  }, [pickedA, pickedB, chart, demons]);

  // All recipes where pickedA is an ingredient (for "what can I make with A?")
  const recipesWithA = useMemo<RecipeRow[]>(() => {
    if (!pickedA) return [];
    return Object.entries(chart)
      .filter(([_, entry]) => entry.ingredients.includes(pickedA.id))
      .map(([resultId, entry]) => ({ resultId, result: findDemon(resultId), entry }));
  }, [pickedA, chart, demons]);

  // Group recipesWithA by 2-way / 3-way / 4-way+ for display
  const recipesWithAGrouped = useMemo(() => {
    const g2: RecipeRow[] = [];
    const g3: RecipeRow[] = [];
    const gN: RecipeRow[] = [];
    for (const r of recipesWithA) {
      if (r.entry.ingredients.length === 2) g2.push(r);
      else if (r.entry.ingredients.length === 3) g3.push(r);
      else gN.push(r);
    }
    return { g2, g3, gN };
  }, [recipesWithA]);

  const clearAll = () => {
    setPickedA(null);
    setPickedB(null);
    setSearchA("");
    setSearchB("");
  };

  // Render a recipe card
  const renderRecipe = (r: RecipeRow, highlight: string | null = null) => {
    const ingredientNames = r.entry.ingredients.map((id) => {
      const d = findDemon(id);
      return d ? getName(d) : id;
    });
    const otherCount = r.entry.ingredients.length - 1;
    return (
      <div
        key={r.resultId + r.entry.ingredients.join("+")}
        className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm"
      >
        <div className="text-white font-semibold">
          → {r.result ? getName(r.result) : r.resultId}{" "}
          <span className="text-xs text-gray-500">
            ({r.entry.ingredients.length}-way · {getRace(r.result?.race || r.entry.race)})
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {r.entry.ingredients.map((id, i) => {
            const d = findDemon(id);
            const name = d ? getName(d) : id;
            const isHL = highlight && id === highlight;
            return (
              <span key={id} className={isHL ? "text-brand-300 font-semibold" : ""}>
                {i > 0 && <span className="text-gray-600"> + </span>}
                {name}
              </span>
            );
          })}
        </div>
        {r.entry.note && <div className="text-xs text-yellow-300 mt-1">📌 {r.entry.note}</div>}
        {otherCount > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            + 再加 {otherCount} 个 {r.entry.ingredients.length === 3 ? "仲魔" : "仲魔（4-way+）"}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with clear button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          选 1 只仲魔：查看可参与的所有配方 · 选 2 只：精确匹配 2-way 配方
        </div>
        {(pickedA || pickedB) && (
          <button
            onClick={clearAll}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/20 transition"
          >
            🗑️ 清空选择
          </button>
        )}
      </div>

      {/* Two demon pickers */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "A", pick: pickedA, search: searchA, setSearch: setSearchA, setPick: setPickedA },
          { label: "B", pick: pickedB, search: searchB, setSearch: setSearchB, setPick: setPickedB },
        ].map((slot, idx) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-brand-300 mb-2">恶魔 {slot.label}</div>
            {slot.pick ? (
              <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-white font-semibold">{getName(slot.pick)}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {getRace(slot.pick.race)} · Lv {slot.pick.level}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      力/魔/耐/速/运: {slot.pick.stats.str}/{slot.pick.stats.mag}/{slot.pick.stats.vit}/{slot.pick.stats.agi}/{slot.pick.stats.luc}
                    </div>
                  </div>
                  <button
                    onClick={() => slot.setPick(null)}
                    className="text-gray-400 hover:text-red-300 text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="搜索恶魔名（中/英/日）..."
                  value={slot.search}
                  onChange={(e) => slot.setSearch(e.target.value)}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-brand-400 focus:outline-none mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredDemons(slot.search).slice(0, 30).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        slot.setPick(d);
                        slot.setSearch("");
                      }}
                      className="w-full text-left rounded border border-white/5 bg-black/30 hover:bg-white/5 px-2 py-1.5 text-sm text-gray-200"
                    >
                      <span className="text-white">{getName(d)}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {getRace(d.race)} · Lv {d.level}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* === MAIN RESULTS SECTION === */}

      {/* Case 1: Both A and B picked — show 2-way first, then 3-way/4-way candidates */}
      {pickedA && pickedB && (
        <section className="rounded-2xl border-2 border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-black/30 p-5 space-y-4">
          <h3 className="text-xl font-bold text-white">🧪 合体结果</h3>

          {/* 2-way exact match */}
          {exact2Way ? (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
              <div className="text-xs text-yellow-300 font-semibold mb-1">✅ 2-way 精确命中</div>
              {exact2Way.result ? (
                <>
                  <div className="text-2xl font-bold text-yellow-200">
                    {getName(exact2Way.result)}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    {getRace(exact2Way.result.race)} · Lv {exact2Way.result.level}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    力/魔/耐/速/运: {exact2Way.result.stats.str}/{exact2Way.result.stats.mag}/{exact2Way.result.stats.vit}/{exact2Way.result.stats.agi}/{exact2Way.result.stats.luc}
                  </div>
                </>
              ) : (
                <div className="text-yellow-100">
                  （图表别名 {exact2Way.resultId}，演示用）
                </div>
              )}
              {exact2Way.entry.note && (
                <p className="text-xs text-yellow-100 mt-2">📌 {exact2Way.entry.note}</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
              <div className="text-orange-200 font-semibold">⚠️ 没有 2-way 精确配方</div>
              <p className="text-sm text-orange-100 mt-1">
                这两只恶魔没有直接的 2-way 配方。下方查看是否可作为 3-way / 4-way 特殊配方的一部分。
              </p>
            </div>
          )}

          {/* 3-way/4-way candidates containing both */}
          {multiwayWithBoth.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-brand-300 mb-2">
                🎯 含 {getName(pickedA)} + {getName(pickedB)} 的特殊配方：
              </div>
              <div className="space-y-2">
                {multiwayWithBoth.map((r) => renderRecipe(r))}
              </div>
            </div>
          )}

          {/* Reminder of A's other recipes (helps user discover options) */}
          {recipesWithA.length > 0 && (
            <details className="rounded-lg border border-white/10 bg-black/20 p-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">
                💡 {getName(pickedA)} 还可以参与另外 {recipesWithA.length} 个配方（点击展开）
              </summary>
              <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                {recipesWithA.slice(0, 20).map((r) => renderRecipe(r, pickedB?.id))}
              </div>
            </details>
          )}
        </section>
      )}

      {/* Case 2: Only A picked — show ALL recipes A is in (the main feature) */}
      {pickedA && !pickedB && recipesWithA.length > 0 && (
        <section className="rounded-2xl border-2 border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-black/30 p-5 space-y-4">
          <h3 className="text-xl font-bold text-white">
            🔍 {getName(pickedA)} 可参与 {recipesWithA.length} 个配方
          </h3>

          {recipesWithAGrouped.g2.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-brand-300 mb-2">
                ⚡ 2-way 配方（{recipesWithAGrouped.g2.length} 个）
              </div>
              <div className="space-y-2">
                {recipesWithAGrouped.g2.map((r) => renderRecipe(r))}
              </div>
            </div>
          )}

          {recipesWithAGrouped.g3.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-brand-300 mb-2">
                🔱 3-way 配方（{recipesWithAGrouped.g3.length} 个）
              </div>
              <div className="space-y-2">
                {recipesWithAGrouped.g3.map((r) => renderRecipe(r))}
              </div>
            </div>
          )}

          {recipesWithAGrouped.gN.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-brand-300 mb-2">
                ✨ 4-way+ 特殊配方（{recipesWithAGrouped.gN.length} 个）
              </div>
              <div className="space-y-2">
                {recipesWithAGrouped.gN.map((r) => renderRecipe(r))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 pt-2 border-t border-white/5">
            提示：选第二只仲魔后会自动尝试 2-way 精确匹配；选一个会大幅缩小可合成的范围。
          </p>
        </section>
      )}

      {/* Case 3: Only A picked but has no recipes */}
      {pickedA && !pickedB && recipesWithA.length === 0 && (
        <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 text-sm text-gray-300">
          <div className="text-yellow-300 font-semibold mb-1">⚠️ {getName(pickedA)} 未收录于当前图表</div>
          <p>该仲魔暂未列入数据库（通常是终盘极稀有仲魔）。可参考下方玩法提示获取替代方案。</p>
        </section>
      )}

      {/* === HINTS === */}
      <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 text-sm text-gray-300 space-y-2">
        <div className="text-yellow-300 font-semibold mb-1">💡 合体机制提示</div>
        <div>• <b>2-way</b>：2 只仲魔直接合成，结果种族 = 较高种族在环上的下一格，等级 = 平均 +1</div>
        <div>• <b>3-way</b>：3 只仲魔合成，可跨多个种族（用于特殊仲魔如 Alice、Horus、Beelzebub）</div>
        <div>• <b>4-way+</b>：黄龙 / 米迦勒 / 路西法 / 湿婆 / 平将门 / 伊邪那岐等终极仲魔，需要 4-7 只特殊组合</div>
        <div>• <b>种族升降</b>：用元素精灵（Fire / Ice / Wind / Elec Sprite）把仲魔升降 1 种族，再合成可继承关键技能</div>
        <div>• <b>技能继承</b>：结果种族必须与素材之一相同；双攻击弱点 + 同种族精灵 = 完美继承</div>
        <div>• 高位仲魔初始等级 ≥142 才能 100% 吃满「兵器诞生」加成</div>
      </section>
    </div>
  );
}
