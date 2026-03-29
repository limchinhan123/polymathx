# Polymath X — agent & contributor notes

## Stack
- **Next.js 14** (App Router), React 18, Tailwind  
- **Convex** — debates history + client in `components/ConvexClientProvider.tsx`  
- **API routes** — `app/api/*` call **OpenRouter** (Claude, Gemini, clarify, moderate, summarize) and **OpenAI** (GPT stream in `app/api/debate/route.ts`)

## Secrets & env
- **Never commit** `.env`, `.env.local`, or real keys. Repo only ships **`.env.example`** (placeholders + comments).  
- **Production secrets** live in **Vercel → Environment Variables** (not in GitHub).  
- **`NEXT_PUBLIC_*`** is exposed in the browser bundle — including **`NEXT_PUBLIC_ACCESS_PASSWORD`** (optional gate). That is not full API protection; combine with Vercel deployment protection and provider spend limits for real risk reduction.

## No hardcoded production URLs
- Do **not** embed public deployment hostnames in source or docs meant to stay public.  
- **OpenRouter `HTTP-Referer`**: use **`lib/openrouter-referer.ts`** — `OPENROUTER_HTTP_REFERER` → else `https://${VERCEL_URL}` on Vercel → else `http://localhost:3000`.

## Build vs runtime
- **Do not** construct **`new OpenAI({ apiKey })` at module top level** in API routes — Next can evaluate modules at build time without secrets. Use **lazy init** (see `app/api/debate/route.ts`).

## Convex URLs
- **Local:** `.env.local` → dev Convex URL.  
- **Vercel:** `NEXT_PUBLIC_CONVEX_URL` must point at **production** deployment after `npx convex deploy`; redeploy Next when it changes.

## Deploy flow (summary)
- GitHub → Vercel project linked to repo; push `main` triggers deploy.  
- Full human checklist: **`docs/runbook.md`**.

## Scripts
- `npm run dev` / `build` / `lint` / `typecheck`  
- `npm run convex:dev` — local Convex sync  
- Optional: `scripts/deploy-polymathx.sh` — local machine with Vercel CLI
