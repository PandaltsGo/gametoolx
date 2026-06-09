#!/usr/bin/env bash
# sync-images.sh — sync LLM-tagged SMT5V images between local dev and server
#
# These images are .gitignored (too many for git, 120MB+).
# They live on the server disk and are served by nginx/Next.js.
# Use this script to:
#   - push: dev → server (after adding/editing images locally)
#   - pull: server → dev (after fresh clone, or to sync back to local)
#
# Usage:
#   ./scripts/sync-images.sh push        # local → server
#   ./scripts/sync-images.sh pull        # server → local
#   ./scripts/sync-images.sh status      # diff summary
#
# Server config (override via env vars):
#   GTX_SSH_KEY     default: ~/.ssh/gametoolx-root-2026-06-07
#   GTX_SSH_HOST    default: root@124.156.229.149
#   GTX_REMOTE_DIR  default: /www/wwwroot/gametoolx.top/public/images/games/shin-megami-tensei-5-vengeance
#   GTX_LOCAL_DIR   default: ./public/images/games/shin-megami-tensei-5-vengeance

set -euo pipefail

# --- resolve repo root (parent of scripts/) ---
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="${GTX_LOCAL_DIR:-$REPO_ROOT/public/images/games/shin-megami-tensei-5-vengeance}"
REMOTE_DIR="${GTX_REMOTE_DIR:-/www/wwwroot/gametoolx.top/public/images/games/shin-megami-tensei-5-vengeance}"
SSH_HOST="${GTX_SSH_HOST:-root@124.156.229.149}"
SSH_KEY="${GTX_SSH_KEY:-/c/Users/zy187/.ssh-tmp/gametoolx-root-2026-06-07}"

# On Windows, the ssh key path is in MSYS format for git bash
if [[ "$SSH_KEY" == /c/* ]] && command -v cygpath >/dev/null 2>&1; then
  SSH_KEY="$(cygpath -w "$SSH_KEY")"
fi

# Subdirs to sync (only the 5 LLM-tagged ones)
SUBDIRS=(bosses regions chests demons misc)

# --- args ---
DIRECTION="${1:-status}"

# --- helpers ---
die() { echo "[sync-images] ERROR: $*" >&2; exit 1; }
note() { echo "[sync-images] $*"; }

check_local() {
  [[ -d "$LOCAL_DIR" ]] || die "local dir not found: $LOCAL_DIR"
}

check_remote() {
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_HOST" \
    "test -d '$REMOTE_DIR'" >/dev/null 2>&1 \
    || die "remote dir not found: $SSH_HOST:$REMOTE_DIR"
}

# Build rsync include/exclude patterns
build_rsync_args() {
  local mode="$1"  # "push" or "pull" — controls --delete flag
  local args=(
    -avz
    --progress
    --human-readable
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
    --include='*/'
    --include='bosses/***'
    --include='regions/***'
    --include='chests/***'
    --include='demons/***'
    --include='misc/***'
    --exclude='*'
  )
  echo "${args[@]}"
}

cmd_status() {
  check_local
  note "local:  $LOCAL_DIR"
  note "remote: $SSH_HOST:$REMOTE_DIR"
  note "subdirs: ${SUBDIRS[*]}"
  echo
  note "--- local file counts ---"
  for d in "${SUBDIRS[@]}"; do
    local count
    count=$(find "$LOCAL_DIR/$d" -type f 2>/dev/null | wc -l | tr -d ' ')
    printf "  %-10s %5d files\n" "$d/" "$count"
  done
  echo
  note "--- remote file counts ---"
  for d in "${SUBDIRS[@]}"; do
    local count
    count=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_HOST" \
      "find '$REMOTE_DIR/$d' -type f 2>/dev/null | wc -l" | tr -d ' ')
    printf "  %-10s %5d files\n" "$d/" "$count"
  done
}

cmd_push() {
  check_local
  check_remote
  note "PUSH local → $SSH_HOST:$REMOTE_DIR"
  echo
  # Use rsync with --delete to mirror (deletions also sync)
  rsync $(build_rsync_args push) --delete \
    "$LOCAL_DIR/" \
    "$SSH_HOST:$REMOTE_DIR/"
  echo
  note "Push complete."
}

cmd_pull() {
  check_local
  check_remote
  note "PULL $SSH_HOST:$REMOTE_DIR → local"
  echo
  rsync $(build_rsync_args pull) --delete \
    "$SSH_HOST:$REMOTE_DIR/" \
    "$LOCAL_DIR/"
  echo
  note "Pull complete."
}

# --- main ---
case "$DIRECTION" in
  push) cmd_push ;;
  pull) cmd_pull ;;
  status) cmd_status ;;
  *)
    echo "Usage: $0 {push|pull|status}" >&2
    exit 1
    ;;
esac
