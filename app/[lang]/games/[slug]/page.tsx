import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame, getUITranslations, listTools, listGames } from "@/lib/data";
import { listResourcesByGame, listTopicsByGame } from "@/lib/resources";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ResourceCard from "@/components/ResourceCard";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = { params: Promise<{ lang: string; slug: string }> };

// Re-validate the SSG cache every 60s so content changes (new tools, updated
// walkthroughs, etc.) show up within a minute of deploy. Without this, Next.js
// 16's default `s-maxage=31536000` (1 year) would cache forever.
export const revalidate = 60;

export async function generateStaticParams() {
  const games = await listGames();
  const params: { lang: string; slug: string }[] = [];
  for (const g of games) {
    for (const lang of SUPPORTED_LANGS) {
      params.push({ lang, slug: g.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const game = await getGame(slug);
  if (!game) return { title: "Not Found" };

  const gameTitle = game.title[lang] || game.title.en;
  const desc = `${gameTitle} 攻略资源索引与工具。 ${(game.genres || []).join(", ")}。`;
  return {
    title: `${gameTitle} | GameToolX`,
    description: desc,
    // Self-canonical — we are an aggregator, not a mirror (see §18.1 of 需求-v2-资源索引.md)
    alternates: {
      canonical: `/${lang}/games/${slug}`,
      languages: Object.fromEntries(
        SUPPORTED_LANGS.map((l) => [l, `/${l}/games/${slug}`]),
      ),
    },
    openGraph: {
      title: `${gameTitle}`,
      description: desc,
      locale: lang === "ja" ? "ja_JP" : lang === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
  };
}

export default async function GamePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) notFound();
  const safeLang = lang as Lang;

  const game = await getGame(slug);
  if (!game) notFound();

  const ui = await getUITranslations(safeLang);
  const allTools = await listTools();
  // Game-specific tools + universal tools (gameSlug === null, e.g. system-checker)
  const gameTools = allTools.filter((t) => t.gameSlug === slug || t.gameSlug === null);

  // v2: Resource index
  let resources: Awaited<ReturnType<typeof listResourcesByGame>> = [];
  let topics: { topic: string; count: number }[] = [];
  try {
    resources = listResourcesByGame(slug, { limit: 12 });
    topics = listTopicsByGame(slug);
  } catch {
    // DB not initialized yet — silently fall back to empty
  }

  const gameTitle = game.title[safeLang] || game.title.en;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: gameTitle,
            description: game.title.en,
            datePublished: game.releaseDate,
            gamePlatform: ["PC", "Steam"],
            applicationCategory: "Game",
            inLanguage: SUPPORTED_LANGS,
            offers: {
              "@type": "Offer",
              url: `https://store.steampowered.com/app/${game.steamAppId}`,
            },
          }),
        }}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header with lang switcher */}
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher current={safeLang} />
        </div>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 mb-4">
          <Link href={`/${safeLang}`} className="hover:text-white">
            GameToolX
          </Link>
          <span className="mx-1">›</span>
          <span className="text-white">{gameTitle}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          {game.images?.header && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.images.header}
              alt={gameTitle}
              className="w-full rounded-2xl mb-6 shadow-lg shadow-black/40"
            />
          )}
          <h1 className="text-3xl font-bold text-white">{gameTitle}</h1>
          <div className="mt-2 text-sm text-gray-400 space-y-1">
            <p>{ui.page.release}: {game.releaseDate || "—"}</p>
            {game.genres && game.genres.length > 0 && (
              <p>{ui.page.genres}: {game.genres.join(", ")}</p>
            )}
            <p>
              <a
                href={`https://store.steampowered.com/app/${game.steamAppId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 hover:underline"
              >
                {ui.page.viewOnSteam}
              </a>
            </p>
          </div>
        </header>

        {/* Tools */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">
            {ui.nav.tools} ({gameTools.length})
          </h2>
          {gameTools.length === 0 ? (
            <p className="text-gray-500">{ui.page.noTools}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {gameTools.map((tool) => {
                const toolTitle = tool.title[safeLang] || tool.title.en;
                // Universal tools (gameSlug === null) need ?game=<slug> in URL
                // so the tool page pre-selects the current game.
                const toolHref = tool.gameSlug === null
                  ? `/${safeLang}/tools/${tool.slug}?game=${slug}`
                  : `/${safeLang}/tools/${tool.slug}`;
                return (
                  <Link
                    key={tool.slug}
                    href={toolHref}
                    className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
                  >
                    <h3 className="text-lg font-semibold text-white">{toolTitle}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {ui.page.type}: {tool.type}
                    </p>
                    <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                      {tool.description[safeLang] || tool.description.en}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* v2: Resource Index Section */}
        {resources.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold text-white">
                {ui.resource?.indexTitle || "Guide Resource Index"}
              </h2>
              <span className="text-sm text-gray-500">
                {(ui.resource?.resourceCount || "{count} resources").replace("{count}", String(resources.length))}
              </span>
            </div>
            {ui.resource?.indexSubtitle && (
              <p className="mb-4 text-sm text-gray-400">{ui.resource.indexSubtitle}</p>
            )}

            {/* Topic chips */}
            {topics.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="text-sm text-gray-400 self-center mr-1">
                  {ui.resource?.browseByTopic || "Browse by topic"}:
                </span>
                <Link
                  href={`/${safeLang}/games/${slug}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10"
                >
                  {ui.resource?.allTopics || "All"}
                </Link>
                {topics.map((t) => (
                  <Link
                    key={t.topic}
                    href={`/${safeLang}/games/${slug}/${t.topic}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10"
                  >
                    {ui.resource?.topicLabels?.[t.topic] || t.topic} ({t.count})
                  </Link>
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {resources.map((r) => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  lang={safeLang}
                  ui={ui}
                />
              ))}
            </div>
          </section>
        )}

        {/* System requirements reference */}
        {game.systemRequirements && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">{ui.page.systemRequirements}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-semibold text-yellow-300 mb-2">{ui.page.minimum}</h3>
                <dl className="text-sm space-y-1">
                  {Object.entries(game.systemRequirements.minimum || {}).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-gray-400 min-w-20">{k}:</dt>
                      <dd className="text-gray-200">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-semibold text-green-300 mb-2">{ui.page.recommended}</h3>
                <dl className="text-sm space-y-1">
                  {Object.entries(game.systemRequirements.recommended || {}).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-gray-400 min-w-20">{k}:</dt>
                      <dd className="text-gray-200">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>
        )}

        <div className="mt-12 text-center">
          <Link href={`/${safeLang}`} className="text-sm text-gray-400 hover:text-white">
            {ui.common.backToTools}
          </Link>
        </div>
      </div>
    </main>
  );
}
