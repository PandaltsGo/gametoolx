import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame, getSystemTiers, getUITranslations, listGames, listTools } from "@/lib/data";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { touchSession } from "@/lib/session";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = { params: Promise<{ lang: string }> };

// Re-validate every 60s so new tools / games show up quickly after deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }));
}

export default async function LangHomePage({ params }: Props) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) notFound();
  const safeLang = lang as Lang;

  const ui = await getUITranslations(safeLang);
  const games = await listGames();
  const tools = await listTools();
  const tiers = await getSystemTiers();

  // Touch the session for analytics
  touchSession(safeLang).catch(() => {});

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
          <p className="mt-2 text-lg text-gray-400">{ui.site.tagline}</p>
        </header>

        {/* Games gallery (with images) */}
        {games.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              {ui.nav.games} ({games.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {games.map((g) => {
                const gameTitle = g.title[safeLang] || g.title.en;
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
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Tools list (with game thumbnail) */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            {ui.nav.tools} ({tools.length})
          </h2>
          {tools.length === 0 ? (
            <p className="text-gray-500">{ui.common.loading}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool) => {
                // Universal tool (gameSlug === null) — show first game as default
                const game = tool.gameSlug
                  ? games.find((g) => g.slug === tool.gameSlug)
                  : games[0];
                const toolTitle = tool.title[safeLang] || tool.title.en;
                const gameTitle = game?.title[safeLang] || game?.title.en || (tool.gameSlug ?? "Universal");
                // Universal tool needs ?game=<slug> in URL — use first game as default
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
          )}
        </section>
      </div>
    </main>
  );
}
