/**
 * Client-side hook for persistent progress (via /api/progress).
 * Replaces localStorage — data is stored on the server keyed by anonymous session ID.
 */
"use client";

import { useEffect, useState, useCallback } from "react";

type ProgressEntry = { key: string; value: string; updatedAt: number };

type Options = {
  /** When true, fetch and sync progress on mount. */
  loadOnMount?: boolean;
};

/**
 * useProgress(tool) — load all progress entries for this tool.
 * Returns: { progress, get, set, remove, refresh }
 */
export function useProgress(tool: string, opts: Options = { loadOnMount: true }) {
  const [progress, setProgressState] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/progress/${tool}/_all`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      const map: Record<string, string> = {};
      for (const p of (json.progress || []) as ProgressEntry[]) {
        map[p.key] = p.value;
      }
      setProgressState(map);
    } catch {
      // network error — keep current state
    } finally {
      setLoading(false);
    }
  }, [tool]);

  useEffect(() => {
    if (opts.loadOnMount !== false) refresh();
  }, [refresh, opts.loadOnMount]);

  const get = useCallback((key: string): string | null => progress[key] ?? null, [progress]);

  const set = useCallback(
    async (key: string, value: unknown) => {
      const stringValue = typeof value === "string" ? value : JSON.stringify(value);
      setProgressState((prev) => ({ ...prev, [key]: stringValue }));
      try {
        await fetch(`/api/progress/${tool}/${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value: stringValue }),
        });
      } catch {
        // best-effort sync
      }
    },
    [tool]
  );

  const remove = useCallback(
    async (key: string) => {
      setProgressState((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        await fetch(`/api/progress/${tool}/${key}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {}
    },
    [tool]
  );

  return { progress, loading, get, set, remove, refresh };
}
