import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame, getSystemTiers, getUITranslations, listGames, listTools } from "@/lib/data";

const SUPPORTED_LANGS = ["ja", "ko", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = { params: Promise<{ lang: string }> };

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

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Lang switcher */}
        <div className="mb-8 flex gap-2 text-sm">
          {SUPPORTED_LANGS.map((l) => (
            <Link
              key={l}
              href={`/${l}`}
              className={`rounded-full px-3 py-1 ${
                l === safeLang
                  ? "bg-brand-600 text-white"
                  : "bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>

        {/* Hero */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-white">GameToolX</h1>
          <p className="mt-2 text-lg text-gray-400">{ui.site.tagline}</p>
        </header>

        {/* Tools list */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            {ui.nav.tools} ({tools.length})
          </h2>
          {tools.length === 0 ? (
            <p className="text-gray-500">{ui.common.loading}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool) => {
                const game = games.find((g) => g.slug === tool.gameSlug);
                const toolTitle = tool.title[safeLang] || tool.title.en;
                const gameTitle = game?.title[safeLang] || game?.title.en || tool.gameSlug;
                return (
                  <Link
                    key={tool.slug}
                    href={`/${safeLang}/tools/${tool.slug}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
                  >
                    <h3 className="text-lg font-semibold text-white">{toolTitle}</h3>
                    <p className="mt-1 text-sm text-gray-400">{gameTitle}</p>
                    <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                      {tool.description[safeLang] || tool.description.en}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Games list */}
        {games.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">
              {ui.nav.games} ({games.length})
            </h2>
            <ul className="space-y-2">
              {games.map((g) => (
                <li key={g.slug} className="text-gray-300">
                  {g.title[safeLang] || g.title.en}{" "}
                  <span className="text-gray-500 text-sm">({g.releaseDate})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Debug info (temporary) */}
        {tiers && (
          <details className="mt-12 text-xs text-gray-600">
            <summary className="cursor-pointer">Debug: tier info</summary>
            <pre className="mt-2 overflow-x-auto bg-black/30 p-2 rounded">
              {Object.keys(tiers.gpu_tiers).length} GPU tiers,{" "}
              {Object.keys(tiers.cpu_generation_tiers.intel).length + Object.keys(tiers.cpu_generation_tiers.amd).length} CPU models
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
