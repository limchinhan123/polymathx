#!/usr/bin/env bash
# Run from your Mac terminal (not the Cursor agent): full DNS + Vercel login required.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export XDG_CACHE_HOME="$ROOT/.xdg-cache"
export XDG_CONFIG_HOME="$ROOT/.xdg-config"
export XDG_DATA_HOME="$ROOT/.xdg-data"
export VERCEL=1
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$ROOT/.npm-cache}"
mkdir -p "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$NPM_CONFIG_CACHE" "$ROOT/.vercel-global-config"

GLOBAL=(--global-config "$ROOT/.vercel-global-config")
VC=(npx --yes vercel@latest "${GLOBAL[@]}")

echo "==> 1) GitHub: ensure repo exists at https://github.com/limchinhan123/polymathx"
if ! git remote get-url origin &>/dev/null; then
  git remote add origin https://github.com/limchinhan123/polymathx.git
fi
if command -v gh &>/dev/null; then
  if ! gh repo view limchinhan123/polymathx &>/dev/null; then
    echo "Creating public repo limchinhan123/polymathx ..."
    gh repo create limchinhan123/polymathx --public --source=. --remote=origin --push
  else
    git push -u origin main
  fi
else
  git push -u origin main || {
    echo "Create the empty public repo on GitHub, then re-run this script."
    exit 1
  }
fi

echo "==> 2) Vercel login (browser) — one-time"
"${VC[@]}" login

echo "==> 3) Production deploy (project name: polymathx)"
"${VC[@]}" --prod --yes --name polymathx

if [[ ! -f .env.local ]]; then
  echo "No .env.local — add env vars in Vercel Dashboard, then: ${VC[*]} --prod"
  exit 0
fi

echo "==> 4) Upload env vars to Vercel (production) from .env.local — values are not printed"
set -a
# shellcheck disable=SC1091
source .env.local
set +a

add_env() {
  local key="$1"
  local val="${!key-}"
  if [[ -z "$val" ]]; then
    echo "Skipping $key (empty in .env.local)"
    return
  fi
  printf '%s' "$val" | "${VC[@]}" env add "$key" production
}

add_env OPENROUTER_API_KEY
add_env OPENAI_API_KEY
add_env NEXT_PUBLIC_CONVEX_URL
add_env NEXT_PUBLIC_ACCESS_PASSWORD

echo "==> 5) Redeploy so new env applies"
"${VC[@]}" --prod --yes

echo "==> 6) Convex production (updates backend URL — copy prod URL into Vercel if it changed)"
npx convex deploy

echo "Done. In Vercel → polymathx → Settings → Domains → add polymathx.vercel.app if needed."
echo "If NEXT_PUBLIC_CONVEX_URL changed after convex deploy, update it in Vercel and redeploy again."
