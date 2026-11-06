#!/usr/bin/env bash
# Film the Yala Maha admin-panel scenes with the project's stageshow skill.
#
# The scene source of truth is stageshow-scenes/scenes/. The stageshow
# playground only films folders inside its own examples/, so this script
# copies the scenes in first (those copies are gitignored), then films each
# one: a poster still, a states sheet, and both again at phone width (390),
# all through the rehearsal gate.
#
# Usage (from anywhere):
#   stageshow-scenes/film.sh              # sync + film every scene
#   stageshow-scenes/film.sh yala-tanks   # sync + film one scene
#   stageshow-scenes/film.sh --sync       # only copy scenes into the playground
#
# Needs the playground running (cd .claude/skills/stageshow && npm run dev).
# Start it AFTER the first sync: Vite only discovers example folders that
# exist when it starts.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$HERE/../.claude/skills/stageshow"
OUT="$HERE/out"
PORT="${STAGESHOW_PORT:-5173}"
export CHROME_PATH="${CHROME_PATH:-/c/Program Files (x86)/Google/Chrome/Application/chrome.exe}"

# The shared look is not a scene; everything else in scenes/ is.
sync() {
  for dir in "$HERE"/scenes/*/; do
    name="$(basename "$dir")"
    rm -rf "$SKILL/examples/$name"
    cp -r "$dir" "$SKILL/examples/$name"
  done
  echo "synced scenes into $SKILL/examples"
}

sync
[ "${1:-}" = "--sync" ] && exit 0

if [ $# -gt 0 ]; then
  scenes=("$@")
else
  scenes=()
  for dir in "$HERE"/scenes/*/; do
    name="$(basename "$dir")"
    [ -f "$dir/index.tsx" ] && scenes+=("$name")
  done
fi

mkdir -p "$OUT"
cd "$SKILL"
status=0
for s in "${scenes[@]}"; do
  url="http://127.0.0.1:$PORT/?capture=$s"
  for width in 1280 390; do
    suffix=""; [ "$width" = 390 ] && suffix="-390"
    node scripts/film.mjs "$url" --select '#example' --still --reduced --width "$width" --out "$OUT/$s$suffix.png" >/dev/null 2>&1 || true
    printf '%-16s %4spx  ' "$s" "$width"
    if ! node scripts/film.mjs "$url" --select '#example' --states --gate --width "$width" --out "$OUT/$s$suffix-states.png" 2>&1 | tail -1; then
      status=1
    fi
  done
done
exit $status
