/**
 * ResourceCard — single resource summary card used in:
 * - Game page resource index
 * - Topic page resource list
 * - Search results
 *
 * Displays: title, AI summary (current lang), source attribution, reliability, topic tags.
 * Outbound link to source is always present.
 * DisplayPolicy is honored — restricted sources show only metadata.
 */
import Link from "next/link";
import type { ResourceView } from "@/lib/data";
import TrackedOutboundLink from "./TrackedOutboundLink";

type Lang = "ja" | "ko" | "zh" | "en";

type Props = {
  resource: ResourceView;
  lang: Lang;
  ui: Record<string, any>;
};

const LANG_LABELS: Record<Lang, string> = {
  en: "EN",
  ja: "JA",
  ko: "KO",
  zh: "ZH",
};

const LICENSE_LABELS: Record<string, string> = {
  "cc-by-sa": "CC BY-SA 4.0",
  "cc-by": "CC BY 4.0",
  official: "Official",
  permission: "Permission",
  unknown: "Unknown",
  restricted: "Restricted",
};

export default function ResourceCard({ resource, lang, ui }: Props) {
  const r = resource;
  const title = r.title[lang] || r.title.en;
  const summary = r.summary[lang] || r.summary.en;
  const excerpt = r.excerpt?.[lang] || r.excerpt?.en;

  // Topic labels in current language
  const topicLabels = (ui.resource?.topicLabels || {}) as Record<string, string>;

  // Effective policy determines what we show
  const policy = r.effectiveDisplayPolicy;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-lg font-semibold text-white leading-snug flex-1">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Source lang badge */}
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
            {LANG_LABELS[r.sourceLang as Lang] || r.sourceLang.toUpperCase()}
          </span>
          {/* License badge (if not unknown) */}
          {r.source.licenseType !== "unknown" && (
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
              {LICENSE_LABELS[r.source.licenseType] || r.source.licenseType}
            </span>
          )}
        </div>
      </div>

      {/* Reliability stars */}
      <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
        <span>
          {ui.resource?.reliability || "Reliability"}: {"★".repeat(r.reliabilityScore)}
          <span className="text-gray-600">{"★".repeat(5 - r.reliabilityScore)}</span>
        </span>
        <span className="text-gray-600">|</span>
        <span>{ui.resource?.by || "Source"}: {r.source.sourceName}</span>
      </div>

      {/* Summary (only if policy allows) */}
      {policy !== "metadata_only" && summary && (
        <p className="text-sm text-gray-300 line-clamp-3 mb-3">{summary}</p>
      )}

      {/* Excerpt (only if policy >= excerpt) */}
      {(policy === "excerpt" || policy === "full_translation") && excerpt && (
        <blockquote className="border-l-2 border-gray-600 pl-3 mb-3 text-xs text-gray-400 italic line-clamp-2">
          &ldquo;{excerpt}&rdquo;
        </blockquote>
      )}

      {/* Topics */}
      {r.topicTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {r.topicTags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] text-blue-300"
            >
              {topicLabels[t] || t}
            </span>
          ))}
        </div>
      )}

      {/* Action row */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <Link
          href={`/${lang}/resource/${r.id}`}
          className="text-xs text-brand-400 hover:underline"
        >
          {ui.resource?.viewResource || "View Resource →"}
        </Link>
        <TrackedOutboundLink
          href={r.sourceUrl}
          resourceId={r.id}
          sourceId={r.sourceId}
          lang={lang}
          className="text-xs text-gray-400 hover:text-white"
        >
          {ui.resource?.viewOriginal || "View Original →"}
        </TrackedOutboundLink>
      </div>
    </article>
  );
}
