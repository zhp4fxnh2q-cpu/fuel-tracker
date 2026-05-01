#!/usr/bin/env bash
# Pulls MEALS_DATA / INGREDIENTS_DATA / SIDES_DATA from the meal planner repo
# and writes src/sharedMealData.js. Run after the meal planner adds new meals.
#
# Requires: GH_PAT exported in the environment.
set -euo pipefail

if [ -z "${GH_PAT:-}" ]; then
  echo "error: GH_PAT not set. Export your GitHub PAT and re-run." >&2
  exit 1
fi

REPO=zhp4fxnh2q-cpu/rogers-family-meal-planner
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

git clone --depth=1 "https://${GH_PAT}@github.com/${REPO}.git" "$TMP" >/dev/null 2>&1
SRC="$TMP/src/RogersFamilyMealPlanner.js"

MEALS_END=$(awk 'NR>=9 && /^];/ {print NR; exit}' "$SRC")
INGR_END=$(awk 'NR>=81 && /^};/ {print NR; exit}' "$SRC")
SIDES_END=$(awk 'NR>=154 && /^];/ {print NR; exit}' "$SRC")

OUT="$(dirname "$0")/../src/sharedMealData.js"
{
cat << 'HEADER'
/**
 * FUEL — copy of MEALS_DATA / INGREDIENTS_DATA / SIDES_DATA from the
 * meal planner repo. Kept in sync via scripts/sync-meal-data.sh.
 *
 * DO NOT EDIT BY HAND — run the sync script when the meal planner adds meals.
 */

export
HEADER
sed -n "9,${MEALS_END}p" "$SRC"
echo
echo "export"
sed -n "81,${INGR_END}p" "$SRC"
echo
echo "export"
sed -n "154,${SIDES_END}p" "$SRC"
} > "$OUT"

echo "wrote $OUT"
node --check "$OUT" && echo "OK"
