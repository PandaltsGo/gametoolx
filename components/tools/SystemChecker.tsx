"use client";

import { useMemo, useState } from "react";
import type { GameData, SystemTiers, UITranslations } from "@/lib/data";

type Props = {
  lang: string;
  ui: UITranslations;
  game: GameData;
  tiers: SystemTiers;
};

type Status = "match" | "partial" | "nomatch";
type Check = { label: string; status: Status; detail: string };
type Result = {
  overall: Status;
  summary: string;
  checks: Check[];
  recommendedTier?: { score: number; label: string; resolution: string; fps: number };
};

const STATUS_ICON: Record<Status, string> = {
  match: "✅",
  partial: "⚠️",
  nomatch: "❌",
};

const STATUS_TEXT: Record<Status, string> = {
  match: "text-green-400",
  partial: "text-yellow-400",
  nomatch: "text-red-400",
};

function findGpuTier(input: string | undefined, tiers: SystemTiers) {
  if (!input) return null;
  const norm = input.toLowerCase();
  for (const tier of Object.values(tiers.gpu_tiers)) {
    for (const gpu of tier.gpus) {
      if (norm.includes(gpu.toLowerCase())) {
        return { ...tier, label: tier.label.en };
      }
    }
  }
  return null;
}

function requirementGpuScore(reqStr: string | undefined, tiers: SystemTiers): number {
  if (!reqStr) return tiers.default_scoring.min_score;
  const tier = findGpuTier(reqStr, tiers);
  return tier?.score ?? tiers.default_scoring.min_score;
}

function cpuClassLevel(input: string | undefined): number {
  if (!input) return 0;
  const s = input.toLowerCase();
  if (s.includes("i9") || s.includes("ryzen 9")) return 90;
  if (s.includes("i7") || s.includes("ryzen 7")) return 70;
  if (s.includes("i5") || s.includes("ryzen 5")) return 50;
  if (s.includes("i3") || s.includes("ryzen 3")) return 30;
  return 40;
}

function requirementCpuClass(reqStr: string | undefined): number {
  if (!reqStr) return 30;
  return cpuClassLevel(reqStr);
}

function parseRamGb(input: string | undefined): number {
  if (!input) return 0;
  const m = input.match(/(\d+)\s*GB/i);
  return m ? parseInt(m[1], 10) : 0;
}

function checkStorage(reqStr: string | undefined, userStorage: string): Status {
  if (!reqStr) return "match";
  const s = reqStr.toLowerCase();
  if (s.includes("ssd")) {
    return userStorage === "SSD" ? "match" : "partial";
  }
  return "match";
}

export default function SystemChecker({ ui, game, tiers }: Props) {
  const [cpu, setCpu] = useState("");
  const [gpu, setGpu] = useState("");
  const [ram, setRam] = useState<number | "">("");
  const [storage, setStorage] = useState<"SSD" | "HDD">("SSD");
  const [submitted, setSubmitted] = useState(false);

  const rec = game.systemRequirements?.recommended || {};
  const min = game.systemRequirements?.minimum || {};

  const result = useMemo<Result | null>(() => {
    if (!submitted) return null;

    const checks: Check[] = [];

    // GPU
    const userGpuTier = findGpuTier(gpu, tiers);
    const userGpuScore = userGpuTier?.score ?? 0;
    const recGpuScore = requirementGpuScore(rec.gpu, tiers);
    const minGpuScore = requirementGpuScore(min.gpu, tiers);
    let gpuStatus: Status;
    let gpuDetail: string;
    if (userGpuScore === 0) {
      gpuStatus = "nomatch";
      gpuDetail = `❌ GPU unknown — could not match "${gpu || "—"}"`;
    } else if (userGpuScore >= recGpuScore) {
      gpuStatus = "match";
      gpuDetail = `✅ ${gpu} ≥ ${rec.gpu || "recommended"}`;
    } else if (userGpuScore >= minGpuScore) {
      gpuStatus = "partial";
      gpuDetail = `⚠️ ${gpu} ≥ ${min.gpu || "minimum"} but < ${rec.gpu || "recommended"}`;
    } else {
      gpuStatus = "nomatch";
      gpuDetail = `❌ ${gpu} < ${min.gpu || "minimum requirements"}`;
    }
    checks.push({ label: ui.checker.gpu, status: gpuStatus, detail: gpuDetail });

    // CPU
    const userCpuLvl = cpuClassLevel(cpu);
    const recCpuLvl = requirementCpuClass(rec.cpu);
    const minCpuLvl = requirementCpuClass(min.cpu);
    let cpuStatus: Status;
    let cpuDetail: string;
    if (userCpuLvl === 0) {
      cpuStatus = "nomatch";
      cpuDetail = `❌ CPU unknown — could not match "${cpu || "—"}"`;
    } else if (userCpuLvl >= recCpuLvl) {
      cpuStatus = "match";
      cpuDetail = `✅ ${cpu} ≥ ${rec.cpu || "recommended"}`;
    } else if (userCpuLvl >= minCpuLvl) {
      cpuStatus = "partial";
      cpuDetail = `⚠️ ${cpu} ≥ ${min.cpu || "minimum"} but < ${rec.cpu || "recommended"}`;
    } else {
      cpuStatus = "nomatch";
      cpuDetail = `❌ ${cpu} < ${min.cpu || "minimum"}`;
    }
    checks.push({ label: ui.checker.cpu, status: cpuStatus, detail: cpuDetail });

    // RAM
    const userRam = typeof ram === "number" ? ram : 0;
    const recRam = parseRamGb(rec.ram);
    const minRam = parseRamGb(min.ram);
    let ramStatus: Status;
    let ramDetail: string;
    if (userRam === 0) {
      ramStatus = "nomatch";
      ramDetail = `❌ RAM not selected`;
    } else if (userRam >= recRam) {
      ramStatus = "match";
      ramDetail = `✅ ${userRam} GB ≥ ${rec.ram || "recommended"}`;
    } else if (userRam >= minRam) {
      ramStatus = "partial";
      ramDetail = `⚠️ ${userRam} GB ≥ ${min.ram || "minimum"} but < ${rec.ram || "recommended"}`;
    } else {
      ramStatus = "nomatch";
      ramDetail = `❌ ${userRam} GB < ${min.ram || "minimum"}`;
    }
    checks.push({ label: ui.checker.ram, status: ramStatus, detail: ramDetail });

    // Storage
    const storageStatus = checkStorage(rec.storage || min.storage, storage);
    const storageDetail =
      storageStatus === "match"
        ? `✅ ${storage} matches requirement`
        : `⚠️ ${storage} but SSD recommended`;
    checks.push({ label: ui.checker.storage, status: storageStatus, detail: storageDetail });

    const matches = checks.filter((c) => c.status === "match").length;
    const partials = checks.filter((c) => c.status === "partial").length;
    let overall: Status;
    let summary: string;
    if (matches === checks.length) {
      overall = "match";
      summary = ui.result.compatible;
    } else if (matches + partials === checks.length) {
      overall = "partial";
      summary = ui.result.partial;
    } else {
      overall = "nomatch";
      summary = ui.result.notCompatible;
    }

    return {
      overall,
      summary,
      checks,
      recommendedTier: userGpuTier ?? undefined,
    };
  }, [submitted, cpu, gpu, ram, storage, game, tiers, ui]);

  return (
    <div className="space-y-8">
      {/* Form */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold mb-4">{ui.checker.yourPc}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{ui.checker.cpu}</label>
            <input
              type="text"
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
              placeholder={ui.checker.cpuPlaceholder}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{ui.checker.gpu}</label>
            <input
              type="text"
              value={gpu}
              onChange={(e) => setGpu(e.target.value)}
              placeholder={ui.checker.gpuPlaceholder}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{ui.checker.ram}</label>
            <select
              value={ram}
              onChange={(e) => setRam(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
            >
              <option value="">—</option>
              {tiers.ram_options_gb.map((gb) => (
                <option key={gb} value={gb}>
                  {gb} GB
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{ui.checker.storage}</label>
            <select
              value={storage}
              onChange={(e) => setStorage(e.target.value as "SSD" | "HDD")}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white"
            >
              {tiers.storage_types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => setSubmitted(true)}
          className="mt-6 w-full rounded-lg bg-brand-600 hover:bg-brand-400 px-4 py-3 font-semibold text-white transition-colors"
        >
          {ui.action.check}
        </button>
      </section>

      {/* Result */}
      {result && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold mb-2">{ui.checker.result}</h2>
          <p className={`text-lg font-medium ${STATUS_TEXT[result.overall]}`}>
            {STATUS_ICON[result.overall]} {result.summary}
          </p>
          <ul className="mt-4 space-y-2">
            {result.checks.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="font-semibold text-gray-300">{c.label}:</span>{" "}
                <span className={STATUS_TEXT[c.status]}>{c.detail}</span>
              </li>
            ))}
          </ul>
          {result.recommendedTier && (
            <div className="mt-6 rounded-lg bg-black/30 p-4">
              <p className="text-sm text-gray-400">{ui.checker.recommendation}</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {result.recommendedTier.label}
              </p>
              <p className="text-xs text-gray-500">
                {result.recommendedTier.resolution} @ {result.recommendedTier.fps}fps
              </p>
            </div>
          )}
        </section>
      )}

      {/* Reference */}
      <section className="rounded-2xl border border-white/5 bg-black/30 p-4 text-xs text-gray-500">
        <details>
          <summary className="cursor-pointer text-gray-400">Game requirements (reference)</summary>
          <div className="mt-2 space-y-2">
            <div>
              <strong>Minimum:</strong> {Object.entries(min).map(([k, v]) => `${k}: ${v}`).join(", ")}
            </div>
            <div>
              <strong>Recommended:</strong> {Object.entries(rec).map(([k, v]) => `${k}: ${v}`).join(", ")}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
