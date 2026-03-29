# Polymath X

**Xpand your perspective** — a focused web app where **Claude**, **GPT-4o**, and **Gemini** debate a topic you choose, with **DeepSeek**-powered moderation and summaries. Built with **Next.js 14**, **Convex**, and **OpenRouter** / **OpenAI**.

---

### Suggested GitHub “About” description (copy-paste)

> Multi-model AI debates on any topic — Claude, GPT-4o & Gemini with DeepSeek moderation. Next.js App Router + Convex + OpenRouter.

---

## Features

- **Three-model debates** with streaming responses and configurable personas / debate style  
- **Clarifying questions** before round 1  
- **Round 2** with moderator follow-up  
- **AI summary** export-friendly markdown  
- **History** per device, persisted in Convex  
- **Optional password gate** (`NEXT_PUBLIC_ACCESS_PASSWORD`) to limit casual traffic  
- **PWA-friendly** shell (manifest + service worker)

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js](https://nextjs.org/) 14 (App Router) |
| UI | React 18, Tailwind CSS |
| Backend data | [Convex](https://www.convex.dev/) |
| Models | OpenRouter (Claude, Gemini, moderator, summarizer, clarify) + OpenAI (GPT stream) |

## Security & API keys

- **Never commit** `.env`, `.env.local`, or any file containing real keys. This repo only ships **`.env.example`** (placeholders).
- **Server-only secrets** — set on **Vercel → Settings → Environment Variables** (Production):
  - `OPENROUTER_API_KEY`
  - `OPENAI_API_KEY`
- **`NEXT_PUBLIC_*` variables are exposed to the browser** in the built client bundle. That includes:
  - `NEXT_PUBLIC_CONVEX_URL` — normal for Convex; scope access in Convex functions / rules as needed.
  - `NEXT_PUBLIC_ACCESS_PASSWORD` — **not** a substitute for full auth. It deters drive-by use; anyone can still call your API routes directly. Combine with **Vercel Deployment Protection**, **OpenRouter / OpenAI usage limits**, and **Convex** rules for real protection.
- **Rotate keys** if they were ever pasted in chat, issues, or a leaked commit.

## Prerequisites

- Node.js 18+  
- npm  
- [Convex](https://dashboard.convex.dev/) project  
- [OpenRouter](https://openrouter.ai/) API key  
- [OpenAI](https://platform.openai.com/) API key (for GPT in `/api/debate`)

## Local development

```bash
git clone https://github.com/limchinhan123/polymathx.git
cd polymathx
cp .env.example .env.local
# Edit .env.local with your keys and Convex dev URL

npm install
npx convex dev   # terminal 1 — syncs functions to dev deployment
npm run dev      # terminal 2 — http://localhost:3000
```

## Environment variables

| Variable | Scope | Purpose |
|----------|--------|---------|
| `OPENROUTER_API_KEY` | Server | OpenRouter calls (Claude, Gemini, moderator, summarize, clarify) |
| `OPENAI_API_KEY` | Server | GPT-4o streaming in debate route |
| `NEXT_PUBLIC_CONVEX_URL` | Client + build | Convex client URL (dev vs prod) |
| `NEXT_PUBLIC_ACCESS_PASSWORD` | Client | Optional; if set, password screen before app |

## Deploy (Vercel + Convex)

1. Push this repo to GitHub and **import** it in [Vercel](https://vercel.com/) (or link an existing project to the repo).  
2. Add the **environment variables** above for **Production** (and Preview if you use previews).  
3. Deploy. Ensure **`NEXT_PUBLIC_CONVEX_URL`** points at your **production** Convex deployment after `npx convex deploy`.  
4. Optional: **Settings → Domains** — e.g. `polymathx.vercel.app`.  
5. From the project root:

   ```bash
   npx convex deploy
   ```

   Update `NEXT_PUBLIC_CONVEX_URL` on Vercel with the printed production URL, then **Redeploy**.

A helper script (local machine, interactive login) lives at `scripts/deploy-polymathx.sh`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run convex:dev` | Convex dev sync |

## Project layout (high level)

- `app/` — App Router pages and `app/api/*` route handlers  
- `components/` — UI  
- `convex/` — Convex schema, queries, mutations  
- `lib/` — Debate state, streaming, idle suggestions, device id  

## License

All rights reserved — private project unless you add a `LICENSE` file.

---

**Live:** [polymathx.vercel.app](https://polymathx.vercel.app) · **Repo:** [github.com/limchinhan123/polymathx](https://github.com/limchinhan123/polymathx)
