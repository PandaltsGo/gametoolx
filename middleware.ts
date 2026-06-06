/**
 * Language detection middleware.
 * - If user visits `/` (no lang), parse Accept-Language and redirect to /<lang>/
 * - If user has set a lang cookie, use that (overrides Accept-Language)
 */
import { NextRequest, NextResponse } from "next/server";

const SUPPORTED = ["ja", "ko", "zh", "en"] as const;
const DEFAULT_LANG = "en";
const COOKIE_NAME = "gtx_lang";

function pickLang(req: NextRequest): string {
  // 1. Cookie (user explicit choice)
  const cookieLang = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieLang && SUPPORTED.includes(cookieLang as (typeof SUPPORTED)[number])) {
    return cookieLang;
  }

  // 2. Accept-Language header
  const accept = req.headers.get("accept-language") || "";
  // Parse "ja,ko-KR;q=0.9,en;q=0.8" style
  const candidates = accept
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? parseFloat(qParam.split("=")[1]) : 1;
      return { tag: tag.toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const c of candidates) {
    const base = c.tag.split("-")[0]; // ja, ko, zh, en
    if (SUPPORTED.includes(base as (typeof SUPPORTED)[number])) return base;
  }

  // 3. Chinese: distinguish zh-cn vs zh-tw by region (default to zh-CN)
  // (Already handled above by taking base lang)

  return DEFAULT_LANG;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // Only act on root or non-prefixed paths
  // Skip API, _next, files, and existing /<lang>/... routes
  const isPrefixed = SUPPORTED.some(
    (l) => path === `/${l}` || path.startsWith(`/${l}/`)
  );
  const isSystemPath =
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path.startsWith("/static") ||
    path.includes(".") || // static files
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml";

  if (isPrefixed || isSystemPath) {
    return NextResponse.next();
  }

  // For / and other unprefixed paths, redirect to /<lang>/
  const lang = pickLang(req);
  const redirectUrl = url.clone();
  redirectUrl.pathname = `/${lang}${path === "/" ? "" : path}${url.search}`;
  return NextResponse.redirect(redirectUrl, 307);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/* (API routes)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt, /sitemap.xml
     * - Files with extensions (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)",
  ],
};
