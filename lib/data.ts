/**
 * Data loaders for game content.
 * Server-side only (uses fs). Used by Next.js server components.
 */

import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

export type GameData = {
  slug: string;
  title: Record<string, string>;
  steamAppId: number;
  releaseDate?: string;
  genres?: string[];
  /** 标签，例如 ["humble2026-06", "rpg", "japanese"]，游戏分类 / 来源标识 */
  tags?: string[];
  images?: {
    library?: string;
    header?: string;
    capsule?: string;
    logo?: string;
    hero?: string;
    screenshots?: string[];
  };
  developer?: string;
  publisher?: string;
  languages?: string[];
  metacriticScore?: number;
  steamReviewPercent?: number;
  price?: { currency: string; standard: number; deluxe?: number; dlcSet?: number };
  playtimeHours?: number;
  platforms?: string[];
  description?: Record<string, string>;
  systemRequirements?: {
    minimum?: Record<string, string> | null;
    recommended?: Record<string, string> | null;
  };
  /** 来源：官方商店页、官方推荐配置、官方截图等。 */
  sources?: Source[];
};

export type ToolData = {
  slug: string;
  /** Game binding — `null` for universal tools (e.g. system-checker) that
   * appear under every game page. */
  gameSlug: string | null;
  type: string;
  title: Record<string, string>;
  description: Record<string, string>;
  data: Record<string, unknown>;
  /** 来源标注：每条数据用了哪些源。每项含语言、URL、署名。 */
  sources?: Source[];
};

/** 单条来源：语言、URL（可选）、署名。 */
export type Source = {
  lang: string;
  /** 可选：源站可能已失效 / 不可公网访问 / 只在登录态可见。空字符串 / 省略 = 跳过 URL 校验。 */
  url?: string;
  attribution: string;
};

/** Walkthrough block 通用结构（heading / paragraph / callout / step / boss / table / tip / region） */
export type Localized = { en: string; ja?: string; ko?: string; zh?: string };

export type WalkthroughBlock =
  | { type: "heading"; level: 2 | 3; text: Localized; sources?: string[] }
  | { type: "paragraph"; text: Localized; sources?: string[] }
  | { type: "callout"; variant: "info" | "warning"; text: Localized; sources?: string[] }
  | { type: "step"; text: Localized; sources?: string[] }
  | { type: "tip"; text: Localized; sources?: string[] }
  | {
      type: "region";
      name: Localized;
      image: string;          // /images/games/<slug>/regions/<slug>.png
      description?: Localized;
      sources?: string[];
    }
  | {
      type: "boss";
      name: Localized;
      level: string;
      image?: string;         // /images/games/<slug>/bosses/<slug>.png
      weakness: Localized;
      strategy: Localized;
      sources?: string[];
    }
  | {
      type: "table";
      header: Localized;
      rows: Localized[];
      sources?: string[];
    }
  | {
      /**
       * 区域地图（结构化）。无图，纯文本 + 子地图列表 + 灵体列表。
       * 用于替代 region 类型（避免用截图当内容），由前端用 flex/grid 渲染。
       */
      type: "region_map";
      name: Localized;
      /** 子地图（如：港区表 / 祸径 / 未满 等） */
      subMaps: { name: Localized; description: Localized }[];
      /** 灵体/恶魔列表（按出现顺序） */
      espers: { name: Localized; type: string }[];
      sources?: string[];
    }
  | {
      /**
       * 章节仲魔选择（结构化表格）。表头：Name / Race / Level / Role / Notes。
       * 用于推荐某一章内可用的恶魔配队。
       */
      type: "demon_selection";
      name: Localized;
      demons: {
        name: Localized;
        race: Localized;
        level: string;
        role: string;
        notes?: Localized;
      }[];
      sources?: string[];
    };

export type WalkthroughSection = {
  id: string;
  title: Localized;
  blocks: WalkthroughBlock[];
};

export type SystemTiers = {
  version: string;
  lastUpdated: string;
  gpu_tiers: Record<
    string,
    { score: number; label: Record<string, string>; resolution: string; fps: number; gpus: string[] }
  >;
  cpu_generation_tiers: { intel: Record<string, number>; amd: Record<string, number> };
  ram_options_gb: number[];
  storage_types: string[];
  default_scoring: { min_score: number; rec_score: number };
};

/**
 * UI 翻译：嵌套对象，叶子是字符串。
 * 例如 `ui.page.release` = "发售日期"。
 * 用 `Record<string, any>`：翻译 JSON 字段增删不用同步改类型；
 * 取 `any` 是因为递归 `string | UITranslations` 在 `.release` 访问时无法 narrow。
 * 后续要严格化时改成 explicit interface 即可，调用方不动。
 */
export type UITranslations = Record<string, any>;

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getGame(slug: string): Promise<GameData | null> {
  return readJson<GameData>(path.join(DATA_DIR, "games", `${slug}.json`));
}

export async function getTool(slug: string): Promise<ToolData | null> {
  return readJson<ToolData>(path.join(DATA_DIR, "tools", `${slug}.json`));
}

export async function getSystemTiers(): Promise<SystemTiers | null> {
  return readJson<SystemTiers>(path.join(DATA_DIR, "system-tiers.json"));
}

export async function getUITranslations(lang: string): Promise<UITranslations> {
  const tr = await readJson<UITranslations>(path.join(DATA_DIR, "i18n", `${lang}.json`));
  if (tr) return tr;
  const fallback = await readJson<UITranslations>(path.join(DATA_DIR, "i18n", "en.json"));
  return fallback || {};
}

export async function listGames(): Promise<GameData[]> {
  const dir = path.join(DATA_DIR, "games");
  try {
    const files = await fs.readdir(dir);
    const games: GameData[] = [];
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      const g = await readJson<GameData>(path.join(dir, f));
      if (g) games.push(g);
    }
    return games;
  } catch {
    return [];
  }
}

export async function listTools(): Promise<ToolData[]> {
  const dir = path.join(DATA_DIR, "tools");
  try {
    const files = await fs.readdir(dir);
    const tools: ToolData[] = [];
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      const t = await readJson<ToolData>(path.join(dir, f));
      if (t) tools.push(t);
    }
    return tools;
  } catch {
    return [];
  }
}
