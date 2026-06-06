"use client";

import { useState, useMemo, useEffect } from "react";
import type { ToolData } from "@/lib/data";

type Props = {
  lang: string;
  tool: ToolData;
};

type Localized = { en: string; ja?: string; ko?: string; zh?: string };

type Block =
  | { type: "heading"; level: 2 | 3; text: Localized }
  | { type: "paragraph"; text: Localized }
  | { type: "callout"; variant: "info" | "warning"; text: Localized }
  | { type: "step"; text: Localized }
  | { type: "tip"; text: Localized }
  | { type: "boss"; name: Localized; level: string; weakness: Localized; strategy: Localized }
  | {
      type: "table";
      header: { en: string[]; ja?: string[]; ko?: string[]; zh?: string[] };
      rows: { en: string[]; ja?: string[]; ko?: string[]; zh?: string[] }[];
    };

type Section = {
  id: string;
  title: Localized;
  blocks: Block[];
};

type Source = { name: string; url: string };

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
      {sections.map((section) => (
        <section
          key={section.id}
          id={`section-${section.id}`}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 scroll-mt-4"
        >
          <h2 className="text-2xl font-bold text-white mb-5 pb-3 border-b border-white/10">
            {t(section.title)}
          </h2>

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
                  <p
                    key={i}
                    className="text-gray-200 leading-relaxed text-base"
                  >
                    {t(block.text)}
                  </p>
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
                      <p
                        className={`text-sm leading-relaxed ${
                          isWarning ? "text-red-100" : "text-blue-100"
                        }`}
                      >
                        {t(block.text)}
                      </p>
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
                    <p className="text-gray-200 text-sm leading-relaxed">
                      {t(block.text)}
                    </p>
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
                    <p className="text-gray-200 text-sm leading-relaxed">
                      {t(block.text)}
                    </p>
                  </div>
                );
              }

              if (block.type === "boss") {
                return (
                  <div
                    key={i}
                    className="rounded-xl border-2 border-red-500/40 bg-gradient-to-br from-red-500/10 to-black/30 p-5"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">👹</span>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-red-200">
                          BOSS: {t(block.name)}
                        </h4>
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
                const headerRow = block.header[lang as keyof Localized] || block.header.en;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-black/30 overflow-hidden"
                  >
                    <table className="w-full text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          {headerRow.map((h, hi) => (
                            <th
                              key={hi}
                              className="px-3 py-2 text-left text-xs uppercase tracking-wide text-brand-300 font-semibold"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, ri) => {
                          const cells = row[lang as keyof Localized] || row.en;
                          const isTrueEnding = cells[0]?.toLowerCase().includes("true") || cells[1]?.includes("真") || cells[1]?.includes("真结局");
                          return (
                            <tr
                              key={ri}
                              className={`border-t border-white/5 ${
                                isTrueEnding ? "bg-yellow-500/5" : ""
                              }`}
                            >
                              {cells.map((c, ci) => (
                                <td
                                  key={ci}
                                  className={`px-3 py-2 ${
                                    isTrueEnding ? "text-yellow-200" : "text-gray-200"
                                  }`}
                                >
                                  {c}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </section>
      ))}

      {/* Sources */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          📚 Sources / 参考資料
        </h2>
        <ul className="space-y-1.5 text-sm">
          {sources.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gray-500">•</span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-300 hover:text-brand-200 hover:underline break-all"
              >
                {s.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          Content is summarized from these community sources. For full walkthroughs
          and detailed boss strategies, please visit the source websites directly.
        </p>
      </section>
    </div>
  );
}
