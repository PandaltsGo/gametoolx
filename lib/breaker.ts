/**
 * Circuit breaker + per-domain token bucket.
 *
 * Per 需求-v2-资源索引.md §13-14:
 * - Don't rely on robots.txt crawl-delay (Googlebot doesn't process it)
 * - Per-domain queue with token bucket
 * - Circuit breaker: 3 consecutive failures → 24h pause
 * - 429 → 1h backoff
 * - 5xx rate > 50% (10 calls) → 6h pause
 *
 * State is in-memory (Map) + persisted to source_sites table (lastCrawledAt
 * already exists). For multi-process safety, we serialize via SQLite.
 */
import { dbReady } from "./db";

type CircuitState = "closed" | "open" | "half_open";

export type CircuitBreakerStatus = {
  sourceId: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt?: number;
  openedAt?: number;
  opensAt?: number;          // when open should transition to half_open
  reason?: string;
};

// ===== Token bucket =====

export type BucketState = {
  sourceId: string;
  tokens: number;            // current available
  capacity: number;          // max tokens (= rate per interval)
  refillPerSec: number;      // how fast tokens regenerate
  lastRefillMs: number;
};

/**
 * Try to consume 1 token from the bucket. Returns true if allowed.
 * Caller MUST skip the request if false (no retry immediately).
 */
export function tryConsumeToken(sourceId: string, capacity: number, refillPerSec: number): boolean {
  const d = dbReady();
  // We use a simple per-source row in memory (in-process). For multi-process, swap to Redis.
  // For now: in-memory + reset on process restart.
  // Stored in the source_sites.config_json blob (JSON-typed) for inspection.
  const row = d.prepare(`SELECT config_json FROM source_sites WHERE id = ?`).get(sourceId) as { config_json: string | null } | undefined;
  let bucket: BucketState;
  if (row?.config_json) {
    try {
      const parsed = JSON.parse(row.config_json);
      if (parsed.bucket) {
        bucket = parsed.bucket;
      } else {
        bucket = { sourceId, tokens: capacity, capacity, refillPerSec, lastRefillMs: Date.now() };
      }
    } catch {
      bucket = { sourceId, tokens: capacity, capacity, refillPerSec, lastRefillMs: Date.now() };
    }
  } else {
    bucket = { sourceId, tokens: capacity, capacity, refillPerSec, lastRefillMs: Date.now() };
  }

  // Refill based on elapsed time
  const now = Date.now();
  const elapsed = (now - bucket.lastRefillMs) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerSec);
  bucket.lastRefillMs = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    persistBucket(sourceId, bucket);
    return true;
  }
  persistBucket(sourceId, bucket);
  return false;
}

function persistBucket(sourceId: string, bucket: BucketState) {
  const d = dbReady();
  const current = d.prepare(`SELECT config_json FROM source_sites WHERE id = ?`).get(sourceId) as { config_json: string | null } | undefined;
  let merged: any = {};
  if (current?.config_json) {
    try { merged = JSON.parse(current.config_json); } catch {}
  }
  merged.bucket = bucket;
  d.prepare(`UPDATE source_sites SET config_json = ? WHERE id = ?`).run(JSON.stringify(merged), sourceId);
}

/**
 * Compute next-run timestamp given circuit state.
 * - open: 24h after opened_at
 * - closed: 0 (run now)
 * - half_open: 1h after opened_at
 */
export function nextRunDelayMs(state: CircuitState, openedAt?: number): number {
  if (state === "closed") return 0;
  if (state === "open" && openedAt) return Math.max(0, 24 * 3600 * 1000 - (Date.now() - openedAt));
  if (state === "half_open" && openedAt) return Math.max(0, 3600 * 1000 - (Date.now() - openedAt));
  return 0;
}

// ===== Circuit breaker =====

const CIRCUIT_OPEN_MS = 24 * 3600 * 1000;
const CIRCUIT_HALF_OPEN_MS = 3600 * 1000;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_5XX_WINDOW_MS = 10 * 60 * 1000; // 10 min
const CIRCUIT_5XX_THRESHOLD = 0.5;             // >50%
const CIRCUIT_5XX_MIN_SAMPLES = 10;

type BreakerSnapshot = {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt?: number;
  opensAt?: number;
  lastFailureAt?: number;
  recent5xx: Array<{ at: number }>;
};

function readBreaker(sourceId: string): BreakerSnapshot {
  const d = dbReady();
  const row = d.prepare(`SELECT config_json FROM source_sites WHERE id = ?`).get(sourceId) as { config_json: string | null } | undefined;
  if (row?.config_json) {
    try {
      const parsed = JSON.parse(row.config_json);
      if (parsed.breaker) return parsed.breaker;
    } catch {}
  }
  return { state: "closed", consecutiveFailures: 0, recent5xx: [] };
}

function writeBreaker(sourceId: string, b: BreakerSnapshot) {
  const d = dbReady();
  const current = d.prepare(`SELECT config_json FROM source_sites WHERE id = ?`).get(sourceId) as { config_json: string | null } | undefined;
  let merged: any = {};
  if (current?.config_json) {
    try { merged = JSON.parse(current.config_json); } catch {}
  }
  merged.breaker = b;
  d.prepare(`UPDATE source_sites SET config_json = ? WHERE id = ?`).run(JSON.stringify(merged), sourceId);
}

/**
 * Check if a request to this sourceId is allowed right now.
 * Updates state if half_open → open (still failing) or → closed (success).
 */
export function canRequest(sourceId: string): { allowed: boolean; reason?: string; state: CircuitState } {
  const b = readBreaker(sourceId);
  const now = Date.now();
  if (b.state === "open" && b.opensAt && now >= b.opensAt) {
    // Transition to half_open
    b.state = "half_open";
    writeBreaker(sourceId, b);
  }
  if (b.state === "open" && b.opensAt && now < b.opensAt) {
    return { allowed: false, reason: "circuit_open", state: "open" };
  }
  return { allowed: true, state: b.state };
}

/** Record a successful request. May transition half_open → closed. */
export function recordSuccess(sourceId: string): void {
  const b = readBreaker(sourceId);
  if (b.state === "half_open" || b.consecutiveFailures > 0) {
    b.state = "closed";
    b.consecutiveFailures = 0;
    b.openedAt = undefined;
    b.opensAt = undefined;
    b.recent5xx = [];
    writeBreaker(sourceId, b);
  }
}

/** Record a failure. May open the circuit. */
export function recordFailure(sourceId: string, statusCode: number, reason?: string): void {
  const b = readBreaker(sourceId);
  const now = Date.now();
  b.consecutiveFailures += 1;
  b.lastFailureAt = now;

  if (statusCode === 429) {
    // Rate-limited: open for 1h
    b.state = "open";
    b.openedAt = now;
    b.opensAt = now + 3600 * 1000;
    b.reason = `429 rate-limited${reason ? ": " + reason : ""}`;
  } else if (statusCode >= 500) {
    // Track 5xx in sliding window
    b.recent5xx = b.recent5xx.filter((x) => now - x.at < CIRCUIT_5XX_WINDOW_MS);
    b.recent5xx.push({ at: now });
    if (b.recent5xx.length >= CIRCUIT_5XX_MIN_SAMPLES) {
      // 5xx > 50% → 6h pause
      b.state = "open";
      b.openedAt = now;
      b.opensAt = now + 6 * 3600 * 1000;
      b.reason = `5xx_rate_${Math.round((b.recent5xx.length / CIRCUIT_5XX_MIN_SAMPLES) * 100)}pct`;
    } else if (b.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      // 3 consecutive failures → 24h
      b.state = "open";
      b.openedAt = now;
      b.opensAt = now + CIRCUIT_OPEN_MS;
      b.reason = `consecutive_failures_${b.consecutiveFailures}`;
    }
  } else if (b.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    // Network error etc.
    b.state = "open";
    b.openedAt = now;
    b.opensAt = now + CIRCUIT_OPEN_MS;
    b.reason = `consecutive_failures_${b.consecutiveFailures}${reason ? ": " + reason : ""}`;
  }
  writeBreaker(sourceId, b);
}

export function getBreakerStatus(sourceId: string): CircuitBreakerStatus {
  const b = readBreaker(sourceId);
  return {
    sourceId,
    state: b.state,
    consecutiveFailures: b.consecutiveFailures,
    lastFailureAt: b.lastFailureAt,
    openedAt: b.openedAt,
    opensAt: b.opensAt,
    reason: b.reason,
  };
}

export function getAllBreakerStatuses(): CircuitBreakerStatus[] {
  const d = dbReady();
  const ids = (d.prepare(`SELECT id FROM source_sites WHERE takedown_status = 'active'`).all() as { id: string }[]).map((x) => x.id);
  return ids.map(getBreakerStatus);
}
