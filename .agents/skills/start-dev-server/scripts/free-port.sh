#!/usr/bin/env bash
# Stop this checkout's running dev server, then print the first free port from
# 8081. Servers from other worktrees are left alone (matched by process cwd).
set -euo pipefail

SRC_DIR="$(git rev-parse --show-toplevel)/src"

listening() { lsof -ti ":$1" -sTCP:LISTEN >/dev/null 2>&1; }

stopped=()
for pid in $(lsof -ti -iTCP -sTCP:LISTEN 2>/dev/null | sort -u); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  if [[ "$cwd" == "$SRC_DIR" ]]; then
    kill "$pid" && echo "stopped dev server (pid $pid)" >&2
    stopped+=("$pid")
  fi
done

# Wait for the killed servers to exit so their ports can be reused.
for pid in ${stopped[@]+"${stopped[@]}"}; do
  for _ in 1 2 3 4 5; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
done

port=8081
while listening "$port"; do
  port=$((port + 1))
done
echo "$port"
