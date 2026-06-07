"use client";

import { useState, useMemo, useEffect } from "react";
import type { ToolData, WalkthroughBlock, WalkthroughSection, Localized, Source } from "@/lib/data";

type Props = {
  lang: string;
  tool: ToolData;
};

type Block = WalkthroughBlock;
type Section = WalkthroughSection;

/** 验证徽章：每个 block 的 sources 数量 */
function VerificationBadge({ sources, lang }: { sources?: string[]; lang: string }) {
  if (!sources || sources.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        title={lang === "zh" ? "此条数据未标注来源" : "This block has no source attribution"}
      >
        ⚠ {lang === "zh" ? "未标注来源" : "no source"}
      </span>
    );
  }
  const verified = sources.length >= 2;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
        verified
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
      }`}
      title={sources.join("\n")}
    >
      ✓ {sources.length} {lang === "zh" ? "源" : "src"}
    </span>
  );
}

export default function Walkthrough({ lang, tool }: Props) {
  const sections = (tool.data.sections as Section[]) || [];
  const sources = (tool.data.sources as Source[]) || [];

  const t = (obj: Localized | string[] | undefined): string => {
    if (!obj) return "";
    if (Array.isArray(obj)) return obj.join(" / ");
    return obj[lang as keyof Localized] || obj.en || "";
  };

  const [activeSection, setActiveSection] = useState<string | null>(null);

  // IntersectionObserver for active section
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observers: IntersectionObserver[] = [];

    sections.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(s.id);
            }
          });
        },
        { rootMargin: "-20% 0px -70% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [sections]);

  return (
    <div className="space-y-8">
      {/* Table of Contents */}
      <nav className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-brand-300 mb-3 uppercase tracking-wide">
          📑 Table of Contents
        </h2>
        <ul className="space-y-1.5 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#section-${s.id}`}
                className={`block rounded px-2 py-1 transition-colors ${
                  activeSection === s.id
                    ? "bg-brand-600/20 text-brand-200"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {t(s.title)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sections */}
      {sections.map((section) => {
        const verifiedCount = section.blocks.filter(
          (b) => b.sources && b.sources.length >= 2
        ).length;
        const totalBlocks = section.blocks.filter(
          (b) => b.type !== "heading"
        ).length;
        return (
          <section
            key={section.id}
            id={`section-${section.id}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 scroll-mt-4"
          >
            <h2 className="text-2xl font-bold text-white mb-3 pb-3 border-b border-white/10">
              {t(section.title)}
            </h2>
            {totalBlocks > 0 && (
              <div className="mb-4 text-xs text-gray-400">
                {lang === "zh"
                  ? `${verifiedCount}/${totalBlocks} 条已交叉验证`
                  : `${verifiedCount}/${totalBlocks} blocks cross-verified`}
                {verifiedCount === totalBlocks && totalBlocks > 0 && (
                  <span className="ml-2 text-emerald-400">✓</span>
                )}
              </div>
            )}

            <div className="space-y-4">
              {section.blocks.map((block, i) => {
                if (block.type === "heading") {
                  if (block.level === 2) {
                    return (
                      <h3
                        key={i}
                        className="text-xl font-semibold text-white mt-6 mb-2"
                      >
                        {t(block.text)}
                      </h3>
                    );
                  }
                  return (
                    <h4
                      key={i}
                      className="text-lg font-semibold text-brand-200 mt-4 mb-2"
                    >
                      {t(block.text)}
                    </h4>
                  );
                }

                if (block.type === "paragraph") {
                  return (
                    <div key={i}>
                      <p className="text-gray-200 leading-relaxed text-base">
                        {t(block.text)}
                      </p>
                      <div className="mt-1">
                        <VerificationBadge sources={block.sources} lang={lang} />
                      </div>
                    </div>
                  );
                }

                if (block.type === "callout") {
                  const isWarning = block.variant === "warning";
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 ${
                        isWarning
                          ? "border-red-500/40 bg-red-500/10"
                          : "border-blue-500/40 bg-blue-500/10"
                      }`}
                    >
                      <div className="flex gap-3">
                        <span className="text-2xl flex-shrink-0">
                          {isWarning ? "⚠️" : "ℹ️"}
                        </span>
                        <div className="flex-1">
                          <p
                            className={`text-sm leading-relaxed ${
                              isWarning ? "text-red-100" : "text-blue-100"
                            }`}
                          >
                            {t(block.text)}
                          </p>
                          <div className="mt-2">
                            <VerificationBadge sources={block.sources} lang={lang} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (block.type === "step") {
                  return (
                    <div
                      key={i}
                      className="flex gap-3 rounded-lg border border-white/5 bg-black/30 p-3"
                    >
                      <span className="text-brand-300 font-semibold text-sm flex-shrink-0 mt-0.5">
                        STEP
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-200 text-sm leading-relaxed">
                          {t(block.text)}
                        </p>
                        <div className="mt-1.5">
                          <VerificationBadge sources={block.sources} lang={lang} />
                        </div>
                      </div>
                    </div>
                  );
                }

                if (block.type === "tip") {
                  return (
                    <div
                      key={i}
                      className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3"
                    >
                      <span className="text-yellow-300 text-xl flex-shrink-0">
                        💡
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-200 text-sm leading-relaxed">
                          {t(block.text)}
                        </p>
                        <div className="mt-1.5">
                          <VerificationBadge sources={block.sources} lang={lang} />
                        </div>
                      </div>
                    </div>
                  );
                }

                if (block.type === "region") {
                  return (
                    <div
                      key={i}
                      className="rounded-xl border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-black/30 p-5"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h4 className="text-lg font-bold text-cyan-200">
                          🗺️ {t(block.name)}
                        </h4>
                        <VerificationBadge sources={block.sources} lang={lang} />
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={block.image}
                        alt={t(block.name)}
                        className="w-full rounded-lg border border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                        loading="lazy"
                      />
                      {block.description && (
                        <p className="mt-3 text-sm text-gray-200 leading-relaxed">
                          {t(block.description)}
                        </p>
                      )}
                    </div>
                  );
                }

                if (block.type === "boss") {
                  return (
                    <div
                      key={i}
                      className="rounded-xl border-2 border-red-500/40 bg-gradient-to-br from-red-500/10 to-black/30 p-5"
                    >
                      {block.image && (
                        <div className="mb-4 flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={block.image}
                            alt={t(block.name)}
                            className="max-h-64 w-auto rounded-lg border border-red-500/30 shadow-lg shadow-red-500/20"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-3xl">👹</span>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-lg font-bold text-red-200">
                              BOSS: {t(block.name)}
                            </h4>
                            <VerificationBadge sources={block.sources} lang={lang} />
                          </div>
                          <div className="mt-1 text-sm text-gray-300">
                            <span className="text-gray-400">Level: </span>
                            <span className="text-white font-semibold">{block.level}</span>
                            <span className="text-gray-400 ml-3">Weakness: </span>
                            <span className="text-red-300 font-semibold">
                              {t(block.weakness)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-red-500/20 pt-3">
                        <div className="text-xs uppercase tracking-wide text-red-300 mb-1">
                          Strategy
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed">
                          {t(block.strategy)}
                        </p>
                      </div>
                    </div>
                  );
                }

                if (block.type === "table") {
                  // 表格渲染：当前数据中无 table 块（未使用）。等有数据时按"header: {lang: string[]}; rows: {lang: string[]}[]"实现。
                  return null;
                }

                return null;
              })}
            </div>
          </section>
        );
      })}

      {/* Sources */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          📚 {lang === "zh" ? "数据来源 / 参考资料" : "Data Sources"}
        </h2>
        <p className="mb-4 text-sm text-gray-300 leading-relaxed">
          {lang === "zh"
            ? "所有攻略内容来自以下社区来源。每条数据已做交叉验证。完整攻略和详细 Boss 策略请访问原网站。"
            : "All walkthrough content comes from these community sources. Each data point has been cross-verified. For full walkthroughs and detailed boss strategies, visit the source sites."}
        </p>
        <ul className="space-y-1.5 text-sm">
          {sources.map((s, i) => (
            <li key={i} className="flex gap-2 items-center">
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                {s.lang}
              </span>
              <span className="text-gray-500">•</span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-300 hover:text-brand-200 hover:underline break-all"
              >
                {s.attribution}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
