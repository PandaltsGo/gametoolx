import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame, getUITranslations, listGames } from "@/lib/data";
import { listResourcesByGame, listTopicsByGame } from "@/lib/resources";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ResourceCard from "@/components/ResourceCard";

const SUPPORTED_LANGS = ["ja", "ko", "zh", "en"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

const TOPIC_SLUGS = [
  "ending", "boss", "quest", "build", "item", "map",
  "system", "lore", "character", "mechanic", "walkthrough",
];

type Props = { params: Promise<{ lang: string; slug: string; topic: string }> };

export const revalidate = 60;

export async function generateStaticParams() {
  const games = await listGames();
  const params: { lang: string; slug: string; topic: string }[] = [];
  for (const g of games) {
    for (const lang of SUPPORTED_LANGS) {
      for (const topic of TOPIC_SLUGS) {
        params.push({ lang, slug: g.slug, topic });
      }
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug, topic } = await params;
  const game = await getGame(slug);
  if (!game) return { title: "Not Found" };
  const ui = await getUITranslations(lang as Lang);
  const gameTitle = game.title[lang] || game.title.en;
  const topicLabel = (ui.resource?.topicLabels as Record<string, string>)?.[topic] || topic;
  return {
    title: `${gameTitle} — ${topicLabel} | GameToolX`,
    alternates: {
      canonical: `/${lang}/games/${slug}/${topic}`,
    },
  };
}

export default async function TopicPage({ params }: Props) {
  const { lang, slug, topic } = await params;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) notFound();
  if (!TOPIC_SLUGS.includes(topic)) notFound();
  const safeLang = lang as Lang;

  const game = await getGame(slug);
  if (!game) notFound();

  const ui = await getUITranslations(safeLang);
  const gameTitle = game.title[safeLang] || game.title.en;
  const topicLabel = (ui.resource?.topicLabels as Record<string, string>)?.[topic] || topic;
  const allTopics = listTopicsByGame(slug);
  let resources: Awaited<ReturnType<typeof listResourcesByGame>> = [];
  try {
    resources = listResourcesByGame(slug, { topic, limit: 100 });
  } catch {}

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher current={safeLang} />
        </div>
        <nav className="text-sm text-gray-400 mb-4">
          <Link href={`/${safeLang}`} className="hover:text-white">GameToolX</Link>
          <span className="mx-1">›</span>
          <Link href={`/${safeLang}/games/${slug}`} className="hover:text-white">{gameTitle}</Link>
          <span className="mx-1">›</span>
          <span className="text-white">{topicLabel}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{topicLabel}</h1>
          <p className="text-sm text-gray-400">
            {(ui.resource?.resourceCount || "{count} resources").replace("{count}", String(resources.length))}
            {" · "}{gameTitle}
          </p>
        </header>

        {/* Other topics */}
        {allTopics.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Link
              href={`/${safeLang}/games/${slug}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10"
            >
              {ui.resource?.allTopics || "All"}
            </Link>
            {allTopics.map((t) => (
              <Link
                key={t.topic}
                href={`/${safeLang}/games/${slug}/${t.topic}`}
                className={`rounded-full px-3 py-1 text-xs ${
                  t.topic === topic
                    ? "border border-brand-400 bg-brand-400/20 text-brand-300"
                    : "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {(ui.resource?.topicLabels as Record<string, string>)?.[t.topic] || t.topic} ({t.count})
              </Link>
            ))}
          </div>
        )}

        {resources.length === 0 ? (
          <p className="text-gray-500">
            {ui.resource?.noResourcesInTopic || "No resources in this topic yet."}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} lang={safeLang} ui={ui} />
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href={`/${safeLang}/games/${slug}`} className="text-sm text-gray-400 hover:text-white">
            ← {gameTitle}
          </Link>
        </div>
      </div>
    </main>
  );
}
