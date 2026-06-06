"use client";

import { useState, useMemo } from "react";
import type { ToolData } from "@/lib/data";

type Props = { tool: ToolData };

type Localized = { en: string; ja?: string; ko?: string; zh?: string };

type Question = {
  id: string;
  text: Localized;
  options: { value: string; label: Localized }[];
};

type Result = {
  id: string;
  title: Localized;
  matches: Record<string, string[]>;
  summary: Localized;
  firstChoice: Localized;
};

const t = (obj: Localized | undefined, lang: string): string => {
  if (!obj) return "";
  return obj[lang as keyof Localized] || obj.en || "";
};

export default function RouteChooser({ tool }: Props) {
  const lang = "zh"; // 4-lang handled by parent
  const questions = (tool.data.questions as Question[]) || [];
  const results = (tool.data.results as Result[]) || [];

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const recommended = useMemo<Result | null>(() => {
    if (!submitted) return null;
    // Score each result by how many answers match
    const scored = results.map((r) => {
      let score = 0;
      let total = 0;
      for (const [qId, allowedValues] of Object.entries(r.matches)) {
        total += 1;
        if (allowedValues.includes(answers[qId])) score += 1;
      }
      return { result: r, score, total };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.result || null;
  }, [submitted, answers, results]);

  const progress = Object.keys(answers).length;
  const total = questions.length;
  const allAnswered = progress === total;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">
            进度 / Progress: {progress} / {total}
          </span>
          <button
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
            className="text-xs text-gray-400 hover:text-red-300"
          >
            🔄 重置
          </button>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all"
            style={{ width: `${(progress / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              <span className="text-brand-300 mr-2">Q{i + 1}.</span>
              {t(q.text, lang)}
            </h3>
            <div className="grid gap-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, [q.id]: opt.value }));
                      setSubmitted(false);
                    }}
                    className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                      selected
                        ? "border-brand-400 bg-brand-600/20 text-white"
                        : "border-white/10 bg-black/30 text-gray-300 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                          selected ? "border-brand-400 bg-brand-400" : "border-gray-500"
                        }`}
                      />
                      <span className="text-sm">{t(opt.label, lang)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={() => setSubmitted(true)}
        disabled={!allAnswered}
        className="w-full rounded-lg bg-brand-600 hover:bg-brand-400 px-4 py-3 font-semibold text-white transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
      >
        {allAnswered ? "🎯 查看推荐路线" : `请回答所有问题 (${progress}/${total})`}
      </button>

      {/* Result */}
      {submitted && recommended && (
        <section className="rounded-2xl border-2 border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-black/30 p-6">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-3xl">🎯</span>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-brand-300 mb-1">
                Recommended Route
              </div>
              <h3 className="text-2xl font-bold text-white">{t(recommended.title, lang)}</h3>
            </div>
          </div>

          <p className="text-gray-200 leading-relaxed mb-4">
            {t(recommended.summary, lang)}
          </p>

          <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
            <div className="text-xs uppercase tracking-wide text-red-300 mb-1">
              ⚠️ 关键选择
            </div>
            <p className="text-white font-semibold">{t(recommended.firstChoice, lang)}</p>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            *基于你的 5 个问题回答匹配。两条路线都有完整剧情，建议至少各打一遍。
          </p>
        </section>
      )}
    </div>
  );
}
