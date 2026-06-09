import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getGame, getTool, getSystemTiers, getUITranslations, listTools, listGames } from "@/lib/data";
import SystemChecker from "@/components/tools/SystemChecker";
import BuildRecommender from "@/components/tools/BuildRecommender";
import EndingsTracker from "@/components/tools/EndingsTracker";
import Walkthrough from "@/components/tools/Walkthrough";
import FusionCalculator from "@/components/tools/FusionCalculator";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ game?: string }>;
};

export async function generateStaticParams() {
  // MVP: 2 tools × 3 langs = 6 pages
  const tools = await listTools();
  const params: { lang: string; slug: string }[] = [];
  for (const t of tools) {
    for (const lang of SUPPORTED_LANGS) {
      params.push({ lang, slug: t.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const { game: gameParam } = await searchParams;

  const tool = await getTool(slug);
  if (!tool) return { title: "Not Found" };

  // Universal tool (gameSlug === null) — use query ?game= or first game for metadata
  let game = tool.gameSlug ? await getGame(tool.gameSlug) : null;
  if (!game) {
    const games = await listGames();
    const target = gameParam || games[0]?.slug;
    game = target ? await getGame(target) : null;
  }
  if (!game) return { title: "Not Found" };

  const toolTitle = tool.title[lang] || tool.title.en;
  const gameTitle = game.title[lang] || game.title.en;
  const toolDesc = tool.description[lang] || tool.description.en;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${gameTitle} ${toolTitle}`,
    description: toolDesc,
    url: `https://gametoolx.top/${lang}/tools/${slug}`,
    applicationCategory: "GameApplication",
    operatingSystem: "Web Browser",
    inLanguage: SUPPORTED_LANGS,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    about: {
      "@type": "VideoGame",
      name: gameTitle,
      gamePlatform: "PC",
    },
  };

  return {
    title: `${toolTitle} - ${gameTitle} | GameToolX`,
    description: toolDesc,
    openGraph: {
      title: `${toolTitle} - ${gameTitle}`,
      description: toolDesc,
      locale: lang === "ja" ? "ja_JP" : lang === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    alternates: {
      languages: Object.fromEntries(
        SUPPORTED_LANGS.map((l) => [l, `/${l}/tools/${slug}`]),
      ),
    },
    other: {
      "application/ld+json": JSON.stringify(jsonLd),
    },
  };
}

// JSON-LD also injected as inline script (rendered into <head> via Next.js 15+ conventions)
function JsonLdScript({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function ToolPage({ params, searchParams }: Props) {
  const { lang, slug } = await params;
  const { game: gameParam } = await searchParams;

  if (!SUPPORTED_LANGS.includes(lang as Lang)) {
    notFound();
  }
  const safeLang = lang as Lang;

  const tool = await getTool(slug);
  if (!tool) notFound();

  // Universal tool (gameSlug === null) — resolve game from ?game= or first available
  let game = tool.gameSlug ? await getGame(tool.gameSlug) : null;
  if (!game) {
    const games = await listGames();
    const target = gameParam || games[0]?.slug;
    game = target ? await getGame(target) : null;
  }
  if (!game) notFound();

  const ui = await getUITranslations(safeLang);
  const tiers = await getSystemTiers();
  if (!tiers) notFound();

  // Fetch all games for the universal system-checker picker
  const allGamesList = await listGames();
  const allGamesForPicker = allGamesList.map((g) => ({
    slug: g.slug,
    title: g.title[safeLang] || g.title.en,
  }));

  const toolTitle = tool.title[safeLang] || tool.title.en;
  const gameTitle = game.title[safeLang] || game.title.en;
  const toolDesc = tool.description[safeLang] || tool.description.en;
  const isUniversal = tool.gameSlug === null;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <JsonLdScript data={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: isUniversal ? toolTitle : `${gameTitle} ${toolTitle}`,
        description: toolDesc,
        url: `https://gametoolx.top/${safeLang}/tools/${slug}`,
        applicationCategory: "GameApplication",
        operatingSystem: "Web Browser",
        inLanguage: SUPPORTED_LANGS,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        about: { "@type": "VideoGame", name: gameTitle, gamePlatform: "PC" },
      }} />
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
          {isUniversal ? (
            <span className="text-white">{toolTitle}</span>
          ) : (
            <>
              <Link href={`/${safeLang}/games/${game.slug}`} className="hover:text-white">
                {gameTitle}
              </Link>
              <span className="mx-1">›</span>
              <span className="text-white">{toolTitle}</span>
            </>
          )}
        </nav>

        {/* Header */}
        <header className="mb-8">
          {game.images?.capsule && !isUniversal && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.images.capsule}
              alt={gameTitle}
              className="w-full max-w-2xl rounded-2xl mb-6 shadow-lg shadow-black/40"
            />
          )}
          <h1 className="text-3xl font-bold text-white">
            {isUniversal ? toolTitle : `${gameTitle} - ${toolTitle}`}
          </h1>
          <p className="mt-2 text-gray-400">
            {tool.description[safeLang] || tool.description.en}
          </p>
        </header>

        {/* Tool-specific component */}
        {tool.type === "system-checker" && (
          <SystemChecker
            lang={safeLang}
            ui={ui}
            game={game}
            tiers={tiers}
            allGames={allGamesForPicker}
            autoTrigger={true}
            isUniversal={isUniversal}
          />
        )}

        {tool.type === "build-recommender" && (
          <BuildRecommender lang={safeLang} ui={ui} tool={tool} />
        )}

        {tool.type === "endings-tracker" && (
          <EndingsTracker lang={safeLang} ui={ui} tool={tool} />
        )}

        {tool.type === "walkthrough" && (
          <Walkthrough lang={safeLang} tool={tool} />
        )}

        {tool.type === "fusion-calculator" && (
          <FusionCalculator tool={tool} />
        )}

        {!["system-checker", "build-recommender", "endings-tracker", "walkthrough", "fusion-calculator"].includes(tool.type) && (
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center">
            <p className="text-yellow-300">
              🚧 Tool type &quot;{tool.type}&quot; not yet implemented
            </p>
          </div>
        )}

        {/* Footer back link */}
        <div className="mt-12 text-center">
          <Link href={`/${safeLang}`} className="text-sm text-gray-400 hover:text-white">
            {ui.common.backToTools}
          </Link>
        </div>
      </div>
    </main>
  );
}
