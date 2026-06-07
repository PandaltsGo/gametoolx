"use client";

import { useMemo, useState } from "react";
import type { ToolData, UITranslations } from "@/lib/data";

type Props = {
  lang: string;
  ui: UITranslations;
  tool: ToolData;
};

type LocalizedName = { en: string; ja?: string; ko?: string; zh?: string };
type Skill = {
  en: string;
  ja?: string;
  ko?: string;
  zh?: string;
  /** 获取方式：位置 + 方法 + 时段（数据用 zh，但 i18n 在所有语言下都可显示） */
  acquisition?: { location?: string; method?: string; phase?: string };
};

type Job = {
  id: string;
  name: LocalizedName;
  role: string;
  weapon?: string[];
  description?: LocalizedName;
  skills?: {
    main?: Skill[];
    support?: Skill[];
  };
};

type Recommendation = {
  playstyle: string;
  name: LocalizedName;
  party: string[];
  reason: LocalizedName;
  skills?: string[];
};

export default function BuildRecommender({ lang, ui, tool }: Props) {
  const jobs = (tool.data.jobs as Job[]) || [];
  const recommendations = (tool.data.recommendations as Recommendation[]) || [];

  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [playstyle, setPlaystyle] = useState<string>("balanced");
  const [submitted, setSubmitted] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const playstyles = Array.from(new Set(recommendations.map((r) => r.playstyle)));

  const t = (obj: LocalizedName | undefined): string => {
    if (!obj) return "";
    return obj[lang as keyof LocalizedName] || obj.en || "";
  };

  const result = useMemo<{
    matched: Recommendation | null;
    missingJobs: string[];
    unlockedParty: (string | null)[];
    reason: string;
  } | null>(() => {
    if (!submitted) return null;
    const target = recommendations.find((r) => r.playstyle === playstyle);
    if (!target) return null;

    const unlockedArr = Array.from(unlocked);
    const unlockedParty = target.party.map((jobId) => (unlocked.has(jobId) ? jobId : null));
    const missingJobs = target.party.filter((jobId) => !unlocked.has(jobId));

    let matched = target;
    let reason = t(target.reason);

    if (missingJobs.length > 0) {
      // Find closest match by playstyle + minimizing missing jobs
      const sorted = recommendations
        .filter((r) => r.playstyle === playstyle)
        .map((r) => ({
          rec: r,
          miss: r.party.filter((j) => !unlocked.has(j)).length,
          hit: r.party.filter((j) => unlocked.has(j)).length,
        }))
        .sort((a, b) => {
          if (a.miss !== b.miss) return a.miss - b.miss;
          return b.hit - a.hit;
        });
      if (sorted.length > 0 && sorted[0].miss < missingJobs.length) {
        matched = sorted[0].rec;
        const note = (ui.recommender.closestMatchNote || "")
          .replace("{name}", t(target.name))
          .replace("{missing}", missingJobs.join(", "));
        reason = `${t(matched.reason)}\n\n${note}`;
      }
    }

    return { matched, missingJobs, unlockedParty, reason };
  }, [submitted, unlocked, playstyle, recommendations, lang]);

  function toggleJob(id: string) {
    const next = new Set(unlocked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setUnlocked(next);
  }

  return (
    <div className="space-y-8">
      {/* Input */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold mb-4 text-white">{ui.recommender.unlocked}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {jobs.map((job) => {
            const checked = unlocked.has(job.id);
            const jobName = t(job.name);
            return (
              <label
                key={job.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  checked
                    ? "border-brand-400 bg-brand-600/20 text-white"
                    : "border-white/10 bg-black/30 text-gray-300 hover:border-white/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleJob(job.id)}
                  className="h-4 w-4 rounded accent-brand-600"
                />
                <span className="text-sm">{jobName}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-300 mb-2">{ui.recommender.playstyle}</h3>
          <div className="flex flex-wrap gap-2">
            {playstyles.map((ps) => (
              <button
                key={ps}
                onClick={() => setPlaystyle(ps)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  ps === playstyle
                    ? "bg-brand-600 text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {ui.recommender.playstyles?.[ps] || ps}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setSubmitted(true)}
          disabled={unlocked.size === 0}
          className="mt-6 w-full rounded-lg bg-brand-600 hover:bg-brand-400 px-4 py-3 font-semibold text-white transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
        >
          {ui.recommender.show}
        </button>
      </section>

      {/* Result */}
      {result && result.matched && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold mb-2 text-white">
            🎯 {t(result.matched.name)}
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            {ui.recommender.playstyle}: {ui.recommender.playstyles?.[result.matched.playstyle] || result.matched.playstyle}
          </p>

          {/* Party */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {result.matched.party.map((jobId, i) => {
              const job = jobs.find((j) => j.id === jobId);
              const jobName = t(job?.name);
              const isUnlocked = unlocked.has(jobId);
              const isExpanded = expandedJob === jobId;
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-3 ${
                    isUnlocked
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-yellow-500/30 bg-yellow-500/10"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xs text-gray-400">{ui.recommender.slot} {i + 1}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{jobName}</div>
                    {!isUnlocked && (
                      <div className="mt-1 text-xs text-yellow-400">🔒 {ui.recommender.locked}</div>
                    )}
                  </div>
                  {job?.skills && (
                    <button
                      onClick={() => setExpandedJob(isExpanded ? null : jobId)}
                      className="mt-2 w-full text-xs text-brand-300 hover:text-brand-200 transition-colors"
                    >
                      {isExpanded ? "▲" : "▼"} {ui.recommender.skills || "Skills"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expanded job skills */}
          {expandedJob && (() => {
            const job = jobs.find((j) => j.id === expandedJob);
            if (!job?.skills) return null;
            return (
              <div className="mb-6 rounded-xl border border-brand-500/30 bg-brand-600/5 p-4">
                <h3 className="text-base font-semibold text-white mb-3">
                  {t(job.name)} — {ui.recommender.skills || "Skills"}
                </h3>
                {job.skills.main && job.skills.main.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-brand-300 mb-2">
                      {ui.recommender.mainSkills || "Main Skills"}
                    </div>
                    <div className="grid gap-2">
                      {job.skills.main.map((sk, i) => (
                        <div
                          key={i}
                          className="rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-xs"
                        >
                          <div className="text-white font-medium">{t(sk)}</div>
                          {sk.acquisition && (
                            <div className="mt-1 text-gray-400 leading-relaxed">
                              {ui.recommender.acquisitionLocation}: {sk.acquisition.location}
                              {sk.acquisition.method && (
                                <> · {ui.recommender.acquisitionMethod}: {sk.acquisition.method}</>
                              )}
                              {sk.acquisition.phase && sk.acquisition.phase !== "anytime" && (
                                <> · {ui.recommender.acquisitionPhase}: {sk.acquisition.phase}</>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {job.skills.support && job.skills.support.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                      {ui.recommender.supportSkills || "Support Skills"}
                    </div>
                    <div className="grid gap-2">
                      {job.skills.support.map((sk, i) => (
                        <div
                          key={i}
                          className="rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-xs"
                        >
                          <div className="text-gray-200 font-medium">{t(sk)}</div>
                          {sk.acquisition && (
                            <div className="mt-1 text-gray-500 leading-relaxed">
                              {ui.recommender.acquisitionLocation}: {sk.acquisition.location}
                              {sk.acquisition.method && (
                                <> · {ui.recommender.acquisitionMethod}: {sk.acquisition.method}</>
                              )}
                              {sk.acquisition.phase && sk.acquisition.phase !== "anytime" && (
                                <> · {ui.recommender.acquisitionPhase}: {sk.acquisition.phase}</>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Key skills for recommendation */}
          {result.matched.skills && result.matched.skills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                {ui.recommender.keySkills || "Key Skills"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.matched.skills.map((skillEn, i) => {
                  // Find the skill in any job's skills array to get localized name
                  let localized: string = skillEn;
                  for (const job of jobs) {
                    const all = [...(job.skills?.main || []), ...(job.skills?.support || [])];
                    const found = all.find((s) => s.en === skillEn);
                    if (found) {
                      localized = t(found);
                      break;
                    }
                  }
                  return (
                    <span
                      key={i}
                      className="rounded-md bg-brand-600/20 border border-brand-500/30 px-2 py-1 text-xs text-white"
                    >
                      ⚔️ {localized}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">{ui.recommender.reason}</h3>
            <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
              {result.reason}
            </p>
          </div>
        </section>
      )}

      {submitted && result && result.missingJobs.length === result.matched?.party.length && (
        <p className="text-sm text-yellow-400">
          ⚠️ {ui.common.error}
        </p>
      )}
    </div>
  );
}
