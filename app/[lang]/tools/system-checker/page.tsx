import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame, getSystemTiers, getUITranslations, listGames } from "@/lib/data";
import SystemCheckerClient from "@/components/tools/SystemCheckerClient";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ game?: string; auto?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const ui = await getUITranslations(lang);
  return {
    title: `${ui.systemCheckerPage?.title || ui.tool.systemChecker} | GameToolX`,
    description: ui.systemCheckerPage?.subtitle || "Check if your PC can run any game. Supports auto-detection of your hardware.",
    alternates: {
      languages: Object.fromEntries(
        SUPPORTED_LANGS.map((l) => [l, `/${l}/tools/system-checker`]),
      ),
    },
  };
}

export default async function SystemCheckerPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) notFound();
  const safeLang = lang as Lang;

  const sp = await searchParams;
  const games = await listGames();
  const requestedSlug = sp.game || games[0]?.slug || "octopath-traveler-2";
  const game = await getGame(requestedSlug) || games[0];
  if (!game) notFound();

  const ui = await getUITranslations(safeLang);
  const tiers = await getSystemTiers();
  if (!tiers) notFound();

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            {ui.systemCheckerPage?.title || ui.tool.systemChecker}
          </h1>
          <p className="mt-2 text-gray-400">
            {ui.systemCheckerPage?.subtitle || ui.checker.yourPc} — {game.title[safeLang] || game.title.en}
          </p>
        </header>

        <SystemCheckerClient
          lang={safeLang}
          ui={ui}
          game={game}
          tiers={tiers}
          allGames={games.map((g) => ({
            slug: g.slug,
            title: g.title[safeLang] || g.title.en,
          }))}
          autoTrigger={sp.auto === "true" || sp.auto === "1"}
        />
      </div>
    </main>
  );
}
