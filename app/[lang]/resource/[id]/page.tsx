import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame, getUITranslations } from "@/lib/data";
import { getResourceView } from "@/lib/resources";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = { params: Promise<{ lang: string; id: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id } = await params;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) return { title: "Not Found" };

  let view: Awaited<ReturnType<typeof getResourceView>>;
  try {
    view = getResourceView(id);
  } catch {
    return { title: "Not Found" };
  }
  if (!view) return { title: "Not Found" };

  const safeLang = lang as Lang;
  const title = (view.title as any)[safeLang] || view.title.en;
  const summary = (view.summary as any)[safeLang] || view.summary.en;

  // Canonical strategy (§18.1 of 需求-v2-资源索引.md):
  // - metadata_only / summary / excerpt → self-canonical (we are aggregating, not mirroring)
  // - full_translation → noindex + canonical to original (approximate mirror)
  const isFullTranslation = view.effectiveDisplayPolicy === "full_translation";

  return {
    title: `${title} | GameToolX`,
    description: summary,
    alternates: isFullTranslation
      ? { canonical: view.sourceUrl }
      : { canonical: `/${lang}/resource/${id}` },
    robots: isFullTranslation
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function ResourcePage({ params }: Props) {
  const { lang, id } = await params;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) notFound();
  const safeLang = lang as Lang;

  let view: Awaited<ReturnType<typeof getResourceView>>;
  try {
    view = getResourceView(id);
  } catch {
    notFound();
  }
  if (!view) notFound();

  const game = await getGame(view.gameSlug);
  const ui = await getUITranslations(safeLang);

  const title = view.title[safeLang] || view.title.en;
  const summary = view.summary[safeLang] || view.summary.en;
  const excerpt = view.excerpt?.[safeLang] || view.excerpt?.en;
  const gameTitle = game?.title?.[safeLang] || game?.title?.en || view.gameSlug;
  const policy = view.effectiveDisplayPolicy;
  const showSummary = policy !== "metadata_only";
  const showExcerpt = policy === "excerpt" || policy === "full_translation";
  const isFullTranslation = policy === "full_translation";
  const topicLabels = (ui.resource?.topicLabels || {}) as Record<string, string>;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher current={safeLang} />
        </div>
        <nav className="text-sm text-gray-400 mb-4">
          <Link href={`/${safeLang}`} className="hover:text-white">GameToolX</Link>
          <span className="mx-1">›</span>
          <Link href={`/${safeLang}/games/${view.gameSlug}`} className="hover:text-white">{gameTitle}</Link>
          <span className="mx-1">›</span>
          <span className="text-white">{title}</span>
        </nav>

        {/* Banner — always shown for compliance */}
        <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">
          {(ui.resource?.banner?.translatedBy || "This page is an AI summary/translation by GameToolX. Original: {url}")
            .replace("{url}", view.sourceUrl)}
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-3 leading-tight">{title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
              {view.sourceLang.toUpperCase()}
            </span>
            <span>{ui.resource?.reliability || "Reliability"}: {"★".repeat(view.reliabilityScore)}<span className="text-gray-600">{"★".repeat(5 - view.reliabilityScore)}</span></span>
            <span className="text-gray-600">|</span>
            <span>{ui.resource?.by || "Source"}: {view.source.sourceName}</span>
          </div>
          {view.topicTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {view.topicTags.map((t) => (
                <Link
                  key={t}
                  href={`/${safeLang}/games/${view.gameSlug}/${t}`}
                  className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-blue-500/20"
                >
                  {topicLabels[t] || t}
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* Summary */}
        {showSummary && summary && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              {ui.resource?.filters?.lang ? "Summary" : "AI Summary"} ({safeLang.toUpperCase()})
            </h2>
            <p className="text-base text-gray-200 leading-relaxed">{summary}</p>
          </section>
        )}

        {/* Excerpt */}
        {showExcerpt && excerpt && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Excerpt</h2>
            <blockquote className="border-l-2 border-gray-600 pl-4 text-sm text-gray-300 italic">
              &ldquo;{excerpt}&rdquo;
            </blockquote>
          </section>
        )}

        {/* Key timestamps (if video) */}
        {view.keyTimestamps && view.keyTimestamps.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Key Timestamps</h2>
            <ul className="text-sm space-y-1">
              {view.keyTimestamps.map((t, i) => (
                <li key={i} className="flex gap-3 text-gray-300">
                  <span className="font-mono text-yellow-300 min-w-[60px]">
                    {String(Math.floor(t.time / 60)).padStart(2, "0")}:{String(t.time % 60).padStart(2, "0")}
                  </span>
                  <span>{t.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer: always-present outbound + compliance */}
        <footer className="mt-12 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-gray-400 space-y-2">
          <div>
            <a
              href={view.sourceUrl}
              target="_blank"
              rel="noopener noreferrer ugc"
              className="text-brand-400 hover:underline font-medium"
            >
              {ui.resource?.viewOriginal || "View Original →"}
            </a>
            <span className="ml-2 text-gray-500">({view.source.sourceName})</span>
          </div>
          {view.source.licenseType !== "unknown" && (
            <div>
              {(ui.resource?.footer?.license || "Source license: {license}")
                .replace("{license}", view.source.licenseType)}
            </div>
          )}
          <div>
            {(ui.resource?.footer?.indexedAt || "Indexed on {date}")
              .replace("{date}", new Date(view.fetchedAt).toISOString().slice(0, 10))}
          </div>
          <div className="text-gray-500">
            {ui.resource?.footer?.disclaimer}
          </div>
          {/* CC BY-SA ShareAlike: this page is a derivative; declare our page license too. */}
          {view.source.licenseType === "cc-by-sa" && (
            <div className="pt-2 border-t border-white/5 text-gray-400">
              <p>
                {safeLang === "zh"
                  ? "本页内容基于 CC BY-SA 4.0 源材料整理。衍生作品按相同或兼容许可发布。"
                  : safeLang === "ja"
                  ? "このページは CC BY-SA 4.0 ソース素材を整理した派生著作物であり、同じまたは互換ライセンスの下で公開されています。"
                  : safeLang === "ko"
                  ? "이 페이지는 CC BY-SA 4.0 소스 자료를 정리한 파생 저작물이며, 동일하거나 호환 가능한 라이선스로 게시됩니다."
                  : "This page is a derivative work based on CC BY-SA 4.0 source material, published under the same or compatible license."}{" "}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY-SA 4.0</a>
              </p>
            </div>
          )}
          {isFullTranslation && (
            <div className="text-yellow-400">
              ⚠ This is an approximate mirror — see <a href={view.sourceUrl} className="underline">original</a>.
            </div>
          )}
        </footer>

        <div className="mt-8 text-center">
          <Link href={`/${safeLang}/games/${view.gameSlug}`} className="text-sm text-gray-400 hover:text-white">
            ← {gameTitle}
          </Link>
        </div>
      </div>
    </main>
  );
}
