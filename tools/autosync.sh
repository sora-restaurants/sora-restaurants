#!/usr/bin/env bash

set -u

INTERVAL_SECONDS="${AUTOSYNC_INTERVAL_SECONDS:-60}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$REPO_DIR/.git/autosync"
PID_FILE="$STATE_DIR/pid"
LOG_FILE="$STATE_DIR/autosync.log"
LOCK_DIR="$STATE_DIR/lock"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*"
}

die() {
  log "ERROR: $*" >&2
  return 1
}

current_branch() {
  git -C "$REPO_DIR" symbolic-ref --quiet --short HEAD
}

validate_repo() {
  git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    die "Not inside a Git worktree."
    return 1
  }

  local branch
  branch="$(current_branch)" || return 1
  case "$branch" in
    main|master|production|prod)
      die "Refusing to autosync protected branch '$branch'."
      return 1
      ;;
  esac

  git -C "$REPO_DIR" remote get-url origin >/dev/null 2>&1 || {
    die "Remote 'origin' is not configured."
    return 1
  }
  printf '%s\n' "$branch"
}

contains_forbidden_paths() {
  git -C "$REPO_DIR" diff --cached --name-only -z | while IFS= read -r -d '' path; do
    case "$path" in
      .env|.env.*|*/.env|*/.env.*|.vercel/*|*/.vercel/*|*.pem|*.p12|*.pfx|*.key|*credentials.json|*id_rsa*)
        if [[ "$path" != ".env.example" && "$path" != */.env.example ]]; then
          printf '%s\n' "$path"
        fi
        ;;
    esac
  done
}

remote_is_safe() {
  local branch="$1"
  local remote_check
  git -C "$REPO_DIR" ls-remote --exit-code --heads origin "refs/heads/$branch" >/dev/null 2>&1
  remote_check=$?

  if [[ "$remote_check" -eq 2 ]]; then
    return 0
  fi
  if [[ "$remote_check" -ne 0 ]]; then
    die "Could not verify origin/$branch. Autosync stopped without committing or pushing."
    return 1
  fi

  git -C "$REPO_DIR" fetch --quiet origin "$branch" || {
    die "Could not fetch origin/$branch."
    return 1
  }

  if ! git -C "$REPO_DIR" merge-base --is-ancestor "origin/$branch" HEAD; then
    die "origin/$branch contains work not present locally. Autosync stopped without pulling or overwriting anything."
  fi
}

sync_once() {
  local branch forbidden timestamp
  branch="$(validate_repo)" || return 1

  if ! git -C "$REPO_DIR" diff --cached --quiet; then
    die "Pre-existing staged changes found. Commit or unstage them manually before autosync."
  fi

  remote_is_safe "$branch" || return 1

  if [[ -z "$(git -C "$REPO_DIR" status --porcelain)" ]]; then
    log "No changes to sync on $branch."
    return 0
  fi

  git -C "$REPO_DIR" add -A || return 1

  forbidden="$(contains_forbidden_paths)"
  if [[ -n "$forbidden" ]]; then
    git -C "$REPO_DIR" restore --staged :/ >/dev/null 2>&1 || true
    die "Refusing to commit sensitive-looking path(s): $(printf '%s' "$forbidden" | tr '\n' ' ')"
  fi

  if ! git -C "$REPO_DIR" diff --cached --check; then
    git -C "$REPO_DIR" restore --staged :/ >/dev/null 2>&1 || true
    die "Whitespace or conflict-marker check failed; changes were left uncommitted."
  fi

  if git -C "$REPO_DIR" diff --cached --quiet; then
    log "No committable changes to sync on $branch."
    return 0
  fi

  timestamp="$(date '+%Y-%m-%d %H:%M:%S %Z')"
  git -C "$REPO_DIR" commit -m "chore(autosync): checkpoint $timestamp" || return 1

  remote_is_safe "$branch" || return 1
  git -C "$REPO_DIR" push --set-upstream origin "HEAD:refs/heads/$branch" || return 1
  log "Checkpoint pushed to origin/$branch."
}

run_loop() {
  mkdir -p "$STATE_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    die "Autosync is already running or a stale lock exists at $LOCK_DIR."
    return 1
  fi
  trap 'rm -rf "$LOCK_DIR" "$PID_FILE"' EXIT INT TERM
  printf '%s\n' "$$" >"$PID_FILE"
  log "Autosync started for $(current_branch) every ${INTERVAL_SECONDS}s."

  while true; do
    sync_once || {
      log "Autosync stopped after a safety check or push failure."
      return 1
    }
    sleep "$INTERVAL_SECONDS"
  done
}

start() {
  mkdir -p "$STATE_DIR"
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    log "Autosync is already running with PID $(cat "$PID_FILE")."
    return 0
  fi

  rm -rf "$LOCK_DIR"
  validate_repo >/dev/null || return 1
  nohup "$0" run >>"$LOG_FILE" 2>&1 &
  local launcher_pid=$!
  sleep 1
  if kill -0 "$launcher_pid" 2>/dev/null; then
    log "Autosync started. Log: $LOG_FILE"
  else
    die "Autosync failed to start. Check $LOG_FILE"
  fi
}

stop() {
  if [[ ! -f "$PID_FILE" ]]; then
    log "Autosync is not running."
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    log "Stopped autosync process $pid."
  else
    log "Removed stale autosync state for process $pid."
  fi
  rm -rf "$PID_FILE" "$LOCK_DIR"
}

status() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    log "Autosync is running with PID $(cat "$PID_FILE") on $(current_branch)."
    log "Log: $LOG_FILE"
  else
    log "Autosync is stopped."
    return 1
  fi
}

usage() {
  cat <<'EOF'
Usage: tools/autosync.sh start|stop|status|once|run|log

  start   Run safe checkpoint commits in the background every 60 seconds.
  stop    Stop the background process.
  status  Show whether autosync is running.
  once    Perform one safe commit-and-push check now.
  run     Run the foreground loop (used internally by start).
  log     Follow the background log.

Set AUTOSYNC_INTERVAL_SECONDS to change the interval.
EOF
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  once) sync_once ;;
  run) run_loop ;;
  log)
    mkdir -p "$STATE_DIR"
    touch "$LOG_FILE"
    tail -f "$LOG_FILE"
    ;;
  *) usage; exit 2 ;;
esac
