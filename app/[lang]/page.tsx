import Link from "next/link";
import { notFound } from "next/navigation";
import { getSystemTiers, getUITranslations, listGames, listTools } from "@/lib/data";
import { getResourceStats, listResourcesByGame } from "@/lib/resources";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { touchSession } from "@/lib/session";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = { params: Promise<{ lang: string }> };

export const revalidate = 60;

export async function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Props) {
  const { lang } = await params;
  const safeLang = lang as Lang;
  const taglineByLang: Record<Lang, string> = {
    zh: "跨语言游戏攻略资源索引 + AI 摘要",
    en: "Multi-language game guide index with AI summaries",
    ja: "多言語ゲーム攻略リソース索引 + AI 要約",
    ko: "다국어 게임 공략 리소스 인덱스 + AI 요약",
  };
  return {
    title: "GameToolX",
    description: taglineByLang[safeLang] || taglineByLang.en,
    alternates: {
      canonical: `/${safeLang}`,
      languages: Object.fromEntries(SUPPORTED_LANGS.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function LangHomePage({ params }: Props) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) notFound();
  const safeLang = lang as Lang;

  const ui = await getUITranslations(safeLang);
  const games = await listGames();
  const tools = await listTools();
  const tiers = await getSystemTiers();

  // Resource stats (v2)
  let stats: Awaited<ReturnType<typeof getResourceStats>> | null = null;
  let recentResources: Awaited<ReturnType<typeof listResourcesByGame>> = [];
  try {
    stats = getResourceStats();
    // Pull 8 most recent across all games
    for (const g of games) {
      const r = listResourcesByGame(g.slug, { limit: 4 });
      recentResources.push(...r);
    }
    recentResources.sort((a, b) => b.fetchedAt - a.fetchedAt);
    recentResources = recentResources.slice(0, 8);
  } catch {
    // DB not ready — silently fall back
  }

  touchSession(safeLang).catch(() => {});

  // Pick tagline by lang
  const taglineByLang: Record<Lang, string> = {
    zh: "跨语言游戏攻略资源索引 + AI 摘要",
    en: "Multi-language game guide index with AI summaries",
    ja: "多言語ゲーム攻略リソース索引 + AI 要約",
    ko: "다국어 게임 공략 리소스 인덱스 + AI 요약",
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Lang switcher */}
        <div className="mb-8 flex justify-end">
          <LanguageSwitcher current={safeLang} />
        </div>

        {/* Hero */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-white">GameToolX</h1>
          <p className="mt-2 text-lg text-gray-400">{taglineByLang[safeLang]}</p>
          {stats && (
            <p className="mt-3 text-sm text-gray-500">
              {stats.sources} {ui.resource?.by || "sources"} ·{" "}
              {stats.resources} {ui.resource?.resourceCount?.replace("{count}", "") || "resources"} ·{" "}
              {Object.keys(SUPPORTED_LANGS).length} {ui.nav.games ? "langs" : "languages"}
            </p>
          )}
        </header>

        {/* Recently indexed (v2) — only if we have resources */}
        {recentResources.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold text-white">
                {safeLang === "zh" ? "本周新收录" : safeLang === "ja" ? "新着リソース" : safeLang === "ko" ? "새로 인덱싱됨" : "Recently Indexed"}
              </h2>
              <span className="text-xs text-gray-500">
                {safeLang === "zh" ? "按收录时间倒序" : safeLang === "ja" ? "新しい順" : safeLang === "ko" ? "최신순" : "Newest first"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recentResources.map((r) => {
                const title = r.title[safeLang] || r.title.en;
                const game = games.find((g) => g.slug === r.gameSlug);
                const gameTitle = game?.title[safeLang] || game?.title.en || r.gameSlug;
                return (
                  <Link
                    key={r.id}
                    href={`/${safeLang}/resource/${r.id}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                  >
                    <div className="text-xs text-gray-500 mb-1">{gameTitle}</div>
                    <div className="text-sm font-semibold text-white line-clamp-2">{title}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.topicTags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] text-blue-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Games (v2: with resource count) */}
        {games.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              {ui.nav.games} ({games.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {games.map((g) => {
                const gameTitle = g.title[safeLang] || g.title.en;
                let resourceCount = 0;
                try {
                  resourceCount = listResourcesByGame(g.slug, { limit: 1000 }).length;
                } catch {}
                return (
                  <Link
                    key={g.slug}
                    href={`/${safeLang}/games/${g.slug}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition-colors hover:bg-white/10"
                  >
                    {g.images?.capsule && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.images.capsule}
                        alt={gameTitle}
                        className="w-full h-40 object-cover"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-white">{gameTitle}</h3>
                      <p className="mt-1 text-xs text-gray-400">
                        {ui.page.release}: {g.releaseDate || "—"}
                      </p>
                      {resourceCount > 0 && (
                        <p className="mt-1 text-xs text-blue-300">
                          {(ui.resource?.resourceCount || "{count} resources").replace("{count}", String(resourceCount))}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Tools (existing — system-checker + endings-tracker) */}
        {tools.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              {ui.nav.tools} ({tools.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool) => {
                const game = tool.gameSlug ? games.find((g) => g.slug === tool.gameSlug) : games[0];
                const toolTitle = tool.title[safeLang] || tool.title.en;
                const gameTitle = game?.title[safeLang] || game?.title.en || (tool.gameSlug ?? "Universal");
                const toolHref = tool.gameSlug === null && games[0]
                  ? `/${safeLang}/tools/${tool.slug}?game=${games[0].slug}`
                  : `/${safeLang}/tools/${tool.slug}`;
                return (
                  <Link
                    key={tool.slug}
                    href={toolHref}
                    className="block rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition-colors hover:bg-white/10"
                  >
                    {game?.images?.capsule && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={game.images.capsule}
                        alt={gameTitle}
                        className="w-full h-32 object-cover opacity-80"
                      />
                    )}
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-white">{toolTitle}</h3>
                      <p className="mt-1 text-sm text-gray-400">{gameTitle}</p>
                      <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                        {tool.description[safeLang] || tool.description.en}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer: compliance line */}
        <footer className="mt-16 border-t border-white/5 pt-6 text-xs text-gray-500 text-center">
          <p>
            {safeLang === "zh"
              ? "GameToolX 是资源索引与 AI 摘要层，所有内容版权归原作者。"
              : safeLang === "ja"
              ? "GameToolX はリソース索引 + AI 要約レイヤーです。コンテンツ著作権は原著作者に帰属します。"
              : safeLang === "ko"
              ? "GameToolX는 리소스 인덱스 + AI 요약 레이어입니다. 콘텐츠 저작권은 원작자에게 있습니다."
              : "GameToolX is a resource index and AI summary layer. Copyright belongs to the original authors."}
          </p>
        </footer>
      </div>
    </main>
  );
}
