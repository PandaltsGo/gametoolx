/**
 * Language switcher.
 * - Server component reads current lang from params.
 * - Switches via Link (Next.js will navigate to new lang route).
 * - Sets cookie to remember choice (overrides Accept-Language on next visit).
 */
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

type Props = {
  current: string;
  className?: string;
};

const LANGS = [
  { code: "ja", label: "JA", native: "日本語" },
  { code: "ko", label: "KO", native: "한국어" },
  { code: "zh", label: "ZH", native: "中文" },
  { code: "en", label: "EN", native: "English" },
];

function setLangCookie(code: string) {
  // 1 year, root path
  document.cookie = `gtx_lang=${code}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
}

export default function LanguageSwitcher({ current, className = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [, startTransition] = useTransition();

  function switchTo(code: string) {
    if (code === current) return;
    setLangCookie(code);
    // pathname like "/zh/tools/..." → "/<new>/tools/..."
    const newPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, `/${code}$1`);
    startTransition(() => router.push(newPath));
  }

  return (
    <div className={`flex gap-1 text-xs ${className}`}>
      {LANGS.map((l) => {
        const active = l.code === current;
        return (
          <button
            key={l.code}
            onClick={() => switchTo(l.code)}
            title={l.native}
            className={`rounded px-2 py-1 transition-colors ${
              active
                ? "bg-brand-600 text-white"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
