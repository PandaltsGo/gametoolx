"use client";

import { useMemo, useState } from "react";
import type { ToolData, UITranslations } from "@/lib/data";

type Props = {
  lang: string;
  ui: UITranslations;
  tool: ToolData;
};

type Job = {
  id: string;
  name: Record<string, string>;
  role: string;
};

type Recommendation = {
  playstyle: string;
  name: Record<string, string>;
  party: string[];
  reason: Record<string, string>;
};

export default function BuildRecommender({ ui, tool }: Props) {
  const jobs = (tool.data.jobs as Job[]) || [];
  const recommendations = (tool.data.recommendations as Recommendation[]) || [];

  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [playstyle, setPlaystyle] = useState<string>("balanced");
  const [submitted, setSubmitted] = useState(false);

  const playstyles = Array.from(new Set(recommendations.map((r) => r.playstyle)));

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
    let reason = target.reason;

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
        const newMissing = matched.party.filter((j) => !unlocked.has(j));
        reason = `${matched.reason}\n\n⚠️ Note: this is the closest match given your unlocked jobs. Original recommendation (${target.name}) would need: ${missingJobs.join(", ")}.`;
      }
    }

    return { matched, missingJobs, unlockedParty, reason };
  }, [submitted, unlocked, playstyle, recommendations]);

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
            const jobName = job.name[Object.keys(job.name).find((k) => job.name[k]) ?? "en"] || job.id;
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
                {ps}
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
            🎯 {result.matched.name[Object.keys(result.matched.name).find((k) => result.matched!.name[k]) ?? "en"]}
          </h2>
          <p className="text-sm text-gray-400 mb-4">playstyle: {result.matched.playstyle}</p>

          {/* Party */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {result.matched.party.map((jobId, i) => {
              const job = jobs.find((j) => j.id === jobId);
              const jobName = job?.name[Object.keys(job.name).find((k) => job.name[k]) ?? "en"] || jobId;
              const isUnlocked = unlocked.has(jobId);
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-3 text-center ${
                    isUnlocked
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-yellow-500/30 bg-yellow-500/10"
                  }`}
                >
                  <div className="text-xs text-gray-400">Slot {i + 1}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{jobName}</div>
                  {!isUnlocked && (
                    <div className="mt-1 text-xs text-yellow-400">🔒 not unlocked</div>
                  )}
                </div>
              );
            })}
          </div>

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
          ⚠️ None of the recommended jobs are unlocked. Try unlocking more jobs or pick a different playstyle.
        </p>
      )}
    </div>
  );
}
