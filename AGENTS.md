# Polymath X — agent & contributor notes

## Overview
- **Next.js** (App Router) + **Convex** for debate history; UI in `app/page.tsx` with `ChatThread`, `InputRow`, `SettingsTab`.
- **API routes** (`app/api/*/route.ts`): **`/api/debate`** streams **NDJSON** (Claude + GPT-4o + Gemini in parallel; OpenRouter for non-OpenAI models, **OpenAI** for GPT stream). **`/api/moderate`**, **`/api/summarize`**, **`/api/clarify`** use OpenRouter as needed.
- **Gemini** defaults to `google/gemini-2.0-flash-001`; settings also offer `google/gemini-flash-1.5-8b`. **Black Hat mode** adds a fourth OpenRouter stream (`deepseek/deepseek-r1`) as a stress-test lens when `settings.blackHatMode` is true (`app/api/debate/route.ts`).

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

## Learned User Preferences

- Before pushing or production deploy, confirm env hygiene: `.env.local` is gitignored and not listed by `git ls-files .env.local`, and `.env.example` lists required keys with empty placeholders.
- Convex CLI: when asked about optional AI helper files, answer `n` if the goal is the smallest repo footprint.

## Learned Workspace Facts

- Git remote: `https://github.com/limchinhan123/polymathx` on `main`. Production: `https://polymathx.vercel.app` (Vercel project name `polymathx`).
- Automated quality gates are `npm run lint`, `npm run typecheck`, and `npm run build`; there is no `npm test` script unless one is added later.
- Black Hat mode sends `settings.blackHatMode` to `/api/debate`; the server adds a fourth OpenRouter stream using `deepseek/deepseek-r1` (not Grok).
- Default first Claude OpenRouter candidate in the debate route is `anthropic/claude-sonnet-4.6`, with legacy ids rewritten via `CLAUDE_MODEL_MAP` and Sonnet fallbacks in `streamClaudeDebate`.
- Debate history uses Convex (`debates` table, `by_device` index, `getDebates` / `saveDebate` / `deleteDebate`); the only debate-related `localStorage` key is `polymath-x-device-id`.

## Transcript index

- Incremental continual-learning state for this repo: `.cursor/hooks/state/continual-learning-index.json` (tracks processed **parent** agent `*.jsonl` files under `~/.cursor/projects/*/agent-transcripts/`, not `subagents/` files).
