import { searchChunks, getCrawledStats, getDocumentsByGame } from "@/lib/db";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; game?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  return {
    title: `Search Guides - GameToolX`,
    alternates: {
      languages: Object.fromEntries(
        SUPPORTED_LANGS.map((l) => [l, `/${l}/search`]),
      ),
    },
  };
}

const TITLES: Record<Lang, string> = {
  ja: "攻略検索",
  ko: "공략 검색",
  zh: "攻略搜索",
  en: "Search Guides",
};

const SUBTITLES: Record<Lang, string> = {
  ja: "ゲームガイドを全文検索",
  ko: "게임 가이드 전문 검색",
  zh: "在所有游戏攻略里搜索",
  en: "Full-text search across all game guides",
};

const PLACEHOLDERS: Record<Lang, string> = {
  ja: "例: 湿婆, プレスターン, 路線",
  ko: "예: 시바, 프레스 턴, 루트",
  zh: "例如：湿婆, Press Turn, 路线",
  en: "e.g. Shiva, Press Turn, fusion",
};

const NO_RESULTS: Record<Lang, string> = {
  ja: "結果がありません",
  ko: "결과 없음",
  zh: "没有找到相关结果",
  en: "No results found",
};

const TRY: Record<Lang, string> = {
  ja: "別のキーワードを試す",
  ko: "다른 키워드 시도",
  zh: "试试其他关键词",
  en: "Try a different keyword",
};

const INDEX_LABEL: Record<Lang, string> = {
  ja: "索引済みソース",
  ko: "인덱싱된 소스",
  zh: "已索引数据源",
};

const DOC_LABEL: Record<Lang, string> = {
  ja: "ドキュメント",
  ko: "문서",
  zh: "文档",
};

const CHUNK_LABEL: Record<Lang, string> = {
  ja: "チャンク",
  ko: "청크",
  zh: "段",
};

export default async function SearchPage({ params, searchParams }: Props) {
  const { lang: rawLang } = await params;
  const { q, game } = await searchParams;
  if (!SUPPORTED_LANGS.includes(rawLang as Lang)) return null;
  const lang = rawLang as Lang;
  const stats = getCrawledStats();

  const results = q ? searchChunks({ query: q, gameSlug: game, preferredLang: lang, limit: 20 }) : [];

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Lang switcher */}
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher current={lang} />
        </div>

        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">🔍 {TITLES[lang]}</h1>
          <p className="mt-1 text-sm text-gray-400">{SUBTITLES[lang]}</p>
        </header>

        {/* Search bar */}
        <form method="GET" className="mb-6 flex gap-2">
          <input
            name="q"
            type="text"
            defaultValue={q || ""}
            placeholder={PLACEHOLDERS[lang]}
            className="flex-1 rounded-lg bg-black/30 border border-white/10 px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-brand-400 focus:outline-none"
            autoFocus
          />
          {game && <input type="hidden" name="game" value={game} />}
          <button
            type="submit"
            className="rounded-lg bg-brand-600 hover:bg-brand-500 px-5 py-2.5 font-medium text-white"
          >
            {lang === "ja" ? "検索" : lang === "ko" ? "검색" : lang === "zh" ? "搜索" : "Search"}
          </button>
        </form>

        {/* Index stats */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6 text-sm">
          <div className="text-xs uppercase tracking-wide text-brand-300 mb-2">
            📚 {INDEX_LABEL[lang]}
          </div>
          <div className="text-gray-300">
            <span className="text-white font-semibold">{stats.sources}</span> {DOC_LABEL[lang]} ·{" "}
            <span className="text-white font-semibold">{stats.documents}</span> {DOC_LABEL[lang]} ·{" "}
            <span className="text-white font-semibold">{stats.chunks}</span> {CHUNK_LABEL[lang]}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.bySource.map((s) => `${s.name}: ${s.count}`).join(" · ")}
          </div>
        </div>

        {/* Active filter */}
        {game && (
          <div className="mb-4 text-sm text-gray-400">
            {lang === "ja" ? "絞り込み" : lang === "ko" ? "필터" : lang === "zh" ? "筛选" : "Filter"}:{" "}
            <span className="text-brand-300 font-semibold">{game}</span>{" "}
            <Link href={`/${lang}/search?q=${encodeURIComponent(q || "")}`} className="text-xs text-gray-500 hover:text-red-300 ml-2">
              ✕ {lang === "ja" ? "解除" : lang === "ko" ? "제거" : lang === "zh" ? "移除" : "remove"}
            </Link>
          </div>
        )}

        {/* Results */}
        {q && results.length === 0 && (
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-center">
            <p className="text-yellow-300 mb-2">⚠️ {NO_RESULTS[lang]}</p>
            <p className="text-sm text-gray-400">{TRY[lang]}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {results.length} {lang === "ja" ? "件" : lang === "ko" ? "개" : lang === "zh" ? "条" : "results"}
            </p>
            {results.map((r) => (
              <article key={r.chunkId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white truncate flex-1">
                    {r.title}
                  </h3>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {r.source}
                  </span>
                </div>
                <div className="text-xs text-brand-300 mb-2">
                  📑 {r.sectionTitle}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {r.snippet}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-brand-300 truncate flex-1"
                  >
                    🔗 {r.url.length > 60 ? r.url.slice(0, 60) + "..." : r.url}
                  </a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.sourceLanguage && (
                      <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-gray-400">
                        源: {r.sourceLanguage.toUpperCase()}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        r.contentLang === "translated"
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      }`}
                      title={r.contentLang === "translated" ? "Translated to your language" : "Showing source language"}
                    >
                      {r.contentLang === "translated"
                        ? lang === "ja" ? "翻訳済"
                        : lang === "ko" ? "번역됨"
                        : lang === "zh" ? "已翻译"
                        : "Translated"
                        : lang === "ja" ? "原文"
                        : lang === "ko" ? "원문"
                        : lang === "zh" ? "原文"
                        : "Original"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Empty state — show top docs */}
        {!q && stats.documents > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-brand-300 mb-3 uppercase tracking-wide">
              📖 {DOC_LABEL[lang]} ({stats.documents})
            </h2>
            <ul className="space-y-1.5 text-sm">
              {stats.byGame.slice(0, 10).map((g) => (
                <li key={g.game} className="flex items-center justify-between">
                  <Link
                    href={`/${lang}/search?q=*&game=${encodeURIComponent(g.game)}`}
                    className="text-gray-300 hover:text-brand-200"
                  >
                    {g.game === "(none)" ? "—" : g.game}
                  </Link>
                  <span className="text-xs text-gray-500">{g.count} {CHUNK_LABEL[lang]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Q&A placeholder */}
        {q && results.length > 0 && (
          <div className="mt-8 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5 text-center">
            <div className="text-2xl mb-2">🤖</div>
            <p className="text-sm text-purple-200">
              AI 攻略问答 · {lang === "ja" ? "近日公開予定" : lang === "ko" ? "곧 출시 예정" : lang === "zh" ? "即将上线" : "Coming soon"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {lang === "ja"
                ? "上記の結果を LLM に渡して、自然言語で回答する機能を開発中です"
                : lang === "ko"
                ? "위 결과를 LLM에 전달해 자연어로 답변하는 기능을 개발 중입니다"
                : lang === "zh"
                ? "正在开发中：把搜索结果喂给 LLM，用自然语言回答你的问题"
                : "Soon: feed these results to an LLM for natural-language Q&A"}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
