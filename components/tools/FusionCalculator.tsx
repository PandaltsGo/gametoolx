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

  // Find fusion result by ingredients
  const fusionResult = useMemo(() => {
    if (!pickedA || !pickedB) return null;
    const ids = [pickedA.id, pickedB.id].sort();
    // Direct match (sorted)
    for (const [resultId, entry] of Object.entries(chart)) {
      if (entry.ingredients.length === 2) {
        const sorted = [...entry.ingredients].sort();
        if (sorted[0] === ids[0] && sorted[1] === ids[1]) {
          const result = demons.find((d) => d.id === resultId);
          if (result) return { result, entry, type: "exact" as const };
        }
      }
    }
    return { result: null, entry: null, type: "none" as const };
  }, [pickedA, pickedB, chart, demons]);

  // Reverse lookup: what can I make FROM these ingredients (any recipe size)
  const recipesWithA = useMemo(() => {
    if (!pickedA) return [];
    return Object.entries(chart).filter(([_, entry]) =>
      entry.ingredients.includes(pickedA.id)
    );
  }, [pickedA, chart]);

  const recipesWithBoth = useMemo(() => {
    if (!pickedA || !pickedB) return [];
    return Object.entries(chart).filter(([_, entry]) => {
      const ing = new Set(entry.ingredients);
      return ing.has(pickedA.id) && ing.has(pickedB.id);
    });
  }, [pickedA, pickedB, chart]);

  return (
    <div className="space-y-6">
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
                  placeholder="搜索恶魔名 / Search demon..."
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

      {/* Result */}
      {pickedA && pickedB && (
        <section className="rounded-2xl border-2 border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-black/30 p-5">
          <h3 className="text-xl font-bold text-white mb-3">🧪 合体结果</h3>
          {fusionResult.type === "exact" && fusionResult.result ? (
            <div>
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
                <div className="text-2xl font-bold text-yellow-200">
                  {getName(fusionResult.result)}
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  {getRace(fusionResult.result.race)} · Lv {fusionResult.result.level}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  力/魔/耐/速/运: {fusionResult.result.stats.str}/{fusionResult.result.stats.mag}/{fusionResult.result.stats.vit}/{fusionResult.result.stats.agi}/{fusionResult.result.stats.luc}
                </div>
                {fusionResult.entry.note && (
                  <p className="text-xs text-yellow-100 mt-2">📌 {fusionResult.entry.note}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
              <div className="text-orange-200 font-semibold">⚠️ 没有 2-way 精确配方</div>
              <p className="text-sm text-orange-100 mt-1">
                这两只恶魔没有直接的 2-way 合体配方。可能需要精灵升降级到相同种族后才能合，或者需要 3-4 只的特殊配方（见下方）。
              </p>
            </div>
          )}

          {/* Reverse lookup: what recipes include these? */}
          {recipesWithBoth.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-brand-300 mb-2">
                🎯 这两只恶魔参与的特殊配方：
              </div>
              <div className="space-y-2">
                {recipesWithBoth.map(([resultId, entry]) => {
                  const result = demons.find((d) => d.id === resultId);
                  return (
                    <div key={resultId} className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
                      <div className="text-white font-semibold">
                        → {result ? getName(result) : resultId} ({entry.ingredients.length}-way)
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Ingredients: {entry.ingredients.map((id) => {
                          const d = demons.find((x) => x.id === id);
                          return d ? getName(d) : id;
                        }).join(" + ")}
                      </div>
                      {entry.note && <div className="text-xs text-yellow-300 mt-1">📌 {entry.note}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tip: ingredient A appears in N recipes */}
      {pickedA && recipesWithA.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-brand-300 mb-2">
            🔍 {getName(pickedA)} 可用于 {recipesWithA.length} 个配方
          </h3>
          <div className="text-xs text-gray-400 space-y-1">
            {recipesWithA.slice(0, 8).map(([resultId, entry]) => {
              const result = demons.find((d) => d.id === resultId);
              return (
                <div key={resultId}>
                  • {result ? getName(result) : resultId} ({entry.ingredients.length}-way)
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tips */}
      <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 text-sm text-gray-300 space-y-2">
        <div className="text-yellow-300 font-semibold mb-1">💡 提示</div>
        <div>• 同一族精灵可升降种族的种族（skill 继承关键）</div>
        <div>• 双攻击弱点恶魔 + 同种族精灵 = 完美继承</div>
        <div>• 高位恶魔初始等级 ≥142 才能 100% 吃满「兵器诞生」加成</div>
        <div>• 黄龙 / 米迦勒 / 路西法 / 湿婆 / 平将门 需要完成支线或通关</div>
      </section>
    </div>
  );
}
