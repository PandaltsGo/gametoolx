"use client";

import { useState, useEffect, useMemo } from "react";
import type { ToolData, UITranslations } from "@/lib/data";
import { useProgress } from "@/hooks/useProgress";

type Props = {
  lang: string;
  ui: UITranslations;
  tool: ToolData;
};

type Localized = { en: string; ja?: string; ko?: string; zh?: string };

type Ending = {
  id: string;
  name: Localized;
  requirement: string;
  requirementLocalized: Localized;
  summary: Localized;
};

type Route = {
  id: string;
  name: Localized;
  description: Localized;
  endings: Ending[];
};

type ProTip = string;

export default function EndingsTracker({ lang, ui, tool }: Props) {
  const routes = (tool.data.routes as Route[]) || [];
  const proTips = (tool.data.proTips as Record<string, ProTip[]>) || {};

  const t = (obj: Localized | undefined): string => {
    if (!obj) return "";
    return obj[lang as keyof Localized] || obj.en || "";
  };

  const allEndings = useMemo(() => {
    const out: Ending[] = [];
    for (const r of routes) {
      for (const e of r.endings) {
        out.push({ ...e, id: `${r.id}::${e.id}` } as Ending);
      }
    }
    return out;
  }, [routes]);

  // DB-backed progress (auto cross-device)
  const { progress: progressMap, set: setProgress, remove: removeProgress, loading } = useProgress(tool.slug);
  const [filter, setFilter] = useState<string>("all");
  const [hydrated, setHydrated] = useState(false);

  const unlocked = useMemo<Set<string>>(() => {
    try {
      const raw = progressMap["unlocked"];
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }, [progressMap]);

  useEffect(() => {
    if (!loading) setHydrated(true);
  }, [loading]);

  function toggleEnding(id: string) {
    const next = new Set(unlocked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setProgress("unlocked", JSON.stringify(Array.from(next)));
  }

  function resetAll() {
    if (confirm("Reset all progress?")) {
      removeProgress("unlocked");
    }
  }

  const progress = `${hydrated ? unlocked.size : 0} / ${allEndings.length}`;
  const percent = Math.round(((hydrated ? unlocked.size : 0) / allEndings.length) * 100);

  const tips = proTips[lang] || proTips.en || [];

  return (
    <div className="space-y-8">
      {/* Progress Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-semibold text-white">
            📊 {progress} ({percent}%)
          </h2>
          <button
            onClick={resetAll}
            className="text-sm text-gray-400 hover:text-red-300"
          >
            🗑️ Reset
          </button>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filter === "all"
                ? "bg-brand-600 text-white"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            All
          </button>
          {routes.map((r) => (
            <button
              key={r.id}
              onClick={() => setFilter(r.id)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                filter === r.id
                  ? "bg-brand-600 text-white"
                  : "bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {t(r.name)}
            </button>
          ))}
        </div>
      </section>

      {/* Routes & Endings */}
      {routes.map((route) => {
        if (filter !== "all" && filter !== route.id) return null;
        return (
          <section key={route.id} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold text-white mb-1">{t(route.name)}</h2>
            <p className="text-sm text-gray-400 mb-4">{t(route.description)}</p>

            <div className="space-y-3">
              {route.endings.map((ending) => {
                const fullId = `${route.id}::${ending.id}`;
                const isUnlocked = hydrated && unlocked.has(fullId);
                return (
                  <div
                    key={ending.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isUnlocked
                        ? "border-green-500/40 bg-green-500/10"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isUnlocked}
                        onChange={() => toggleEnding(fullId)}
                        className="mt-1 h-5 w-5 rounded accent-brand-600 cursor-pointer"
                      />
                      <div className="flex-1">
                        <h3
                          className={`text-lg font-semibold ${
                            isUnlocked ? "text-green-300" : "text-white"
                          }`}
                        >
                          {t(ending.name)}
                        </h3>
                        <div className="mt-2 text-sm">
                          <div className="text-xs uppercase tracking-wide text-brand-300 mb-1">
                            Requirement
                          </div>
                          <p className="text-gray-200">
                            {t(ending.requirementLocalized) || ending.requirement}
                          </p>
                        </div>
                        <div className="mt-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                            Summary
                          </div>
                          <p className="text-gray-300">{t(ending.summary)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Pro Tips */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">💡 Pro Tips</h2>
        <ul className="space-y-2 text-sm text-gray-300">
          {tips.map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-brand-300">▸</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
