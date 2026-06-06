import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame, getUITranslations, listTools, listGames } from "@/lib/data";

const SUPPORTED_LANGS = ["ja", "ko", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = { params: Promise<{ lang: string; slug: string }> };

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
  const desc = `${gameTitle} のツール一覧。 ${(game.genres || []).join(", ")}。`;
  return {
    title: `${gameTitle} ツール一覧 | GameToolX`,
    description: desc,
    openGraph: {
      title: `${gameTitle} ツール一覧`,
      description: desc,
      locale: lang === "ja" ? "ja_JP" : lang === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    alternates: {
      languages: Object.fromEntries(
        SUPPORTED_LANGS.map((l) => [l, `/${l}/games/${slug}`]),
      ),
    },
    other: {
      "application/ld+json": JSON.stringify({
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
  const gameTools = allTools.filter((t) => t.gameSlug === slug);

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
          <h1 className="text-3xl font-bold text-white">{gameTitle}</h1>
          <div className="mt-2 text-sm text-gray-400 space-y-1">
            <p>Release: {game.releaseDate || "—"}</p>
            {game.genres && game.genres.length > 0 && (
              <p>Genres: {game.genres.join(", ")}</p>
            )}
            <p>
              <a
                href={`https://store.steampowered.com/app/${game.steamAppId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 hover:underline"
              >
                Steam Store →
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
            <p className="text-gray-500">No tools available for this game yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {gameTools.map((tool) => {
                const toolTitle = tool.title[safeLang] || tool.title.en;
                return (
                  <Link
                    key={tool.slug}
                    href={`/${safeLang}/tools/${tool.slug}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
                  >
                    <h3 className="text-lg font-semibold text-white">{toolTitle}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      Type: {tool.type}
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

        {/* System requirements reference */}
        {game.systemRequirements && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">System Requirements</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-semibold text-yellow-300 mb-2">Minimum</h3>
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
                <h3 className="text-sm font-semibold text-green-300 mb-2">Recommended</h3>
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
