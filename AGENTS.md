# Polymath X — agent & contributor notes

## Overview
- **Next.js** (App Router) + **Convex** for debate history; UI in `app/page.tsx` with `ChatThread`, `InputRow`, `SettingsTab`.
- **API routes** (`app/api/*/route.ts`): **`/api/debate`** streams **NDJSON** (Claude + GPT-4o + Gemini in parallel; OpenRouter for non-OpenAI models, **OpenAI** for GPT stream). **`/api/moderate`**, **`/api/summarize`**, **`/api/clarify`** use OpenRouter as needed.
- **Gemini** defaults to `google/gemini-2.0-flash-001`; settings also offer `google/gemini-flash-1.5-8b`. **Black Hat mode** swaps Gemini’s persona for a dedicated stress-test lens (`app/api/debate/route.ts`).

## Dev commands
- `npm run dev` / `build` / `lint` / `typecheck`
- `npm run convex:dev` — local Convex sync
- Optional: `scripts/deploy-polymathx.sh` (Vercel CLI on your machine)
- Human deploy checklist: **`docs/runbook.md`**

## Environment variables
- **`OPENROUTER_API_KEY`** — Claude, Gemini, moderator, summarizer, clarify (server-only).
- **`OPENAI_API_KEY`** — GPT-4o stream in `/api/debate` (server-only); lazy-init only (see below).
- **`NEXT_PUBLIC_CONVEX_URL`** — Convex HTTP URL (dev locally, prod on Vercel).
- Optional: **`OPENROUTER_HTTP_REFERER`**, **`NEXT_PUBLIC_ACCESS_PASSWORD`** (client-exposed gate — not full API protection).

Details and placeholders: **`.env.example`**. Never commit `.env` / `.env.local`.

## Key files
| Area | Path |
|------|------|
| Debate stream + personas / Black Hat | `app/api/debate/route.ts` |
| Moderator / summarizer / clarify | `app/api/moderate/route.ts`, `summarize/route.ts`, `clarify/route.ts` |
| Client state, rounds, moderation flow | `lib/debate-store.tsx` |
| Settings → OpenRouter model ids | `lib/openrouter-models.ts` (`toOpenRouterModeratorModel`, `toOpenRouterSummarizerModel`) |
| Types + reducer actions | `lib/types.ts` |
| Error UI (dismissible banner) | `components/ChatThread.tsx` |
| Voice input (Web Speech API) | `components/InputRow.tsx` |
| Convex provider | `components/ConvexClientProvider.tsx` |
| OpenRouter Referer helper | `lib/openrouter-referer.ts` |

## UX / state conventions
- **`runModeration`** returns **`{ ok, nextQuestion }`**; callers branch on `ok` before continuing the round.
- Reducer actions include **`REMOVE_EMPTY_STREAMING_FOR_ROUND`** (clean empty partial streams) and **`RESTORE_STATUS_AFTER_MOD_FAILED`** (revert UI when moderation fails).

## Secrets & platform rules
- **Never commit** real keys; production secrets live in **Vercel → Environment Variables**.
- **No hardcoded production hostnames** in source or public docs. OpenRouter `HTTP-Referer`: use **`lib/openrouter-referer.ts`** (`OPENROUTER_HTTP_REFERER` → else `https://${VERCEL_URL}` on Vercel → else `http://localhost:3000`).
- **Do not** construct `new OpenAI({ apiKey })` at module top level in API routes — Next may load modules at build time without secrets. Use **lazy init** (pattern in `app/api/debate/route.ts`).
- **Convex:** local `.env.local` uses dev URL; Vercel **`NEXT_PUBLIC_CONVEX_URL`** must match **production** after `npx convex deploy`; redeploy Next when it changes.

## Transcript index
- No incremental agent-transcript index file is maintained in this repo (nothing under `.cursor` beyond `rules/polymathx-context.mdc`). Skip unless you add one and link it here.
