# Personal second brain — Polymath X

*Capture from build & deploy work. No secrets or production URLs belong here.*

---

## One-line summary

**Polymath X** — Next.js + Convex app where Claude, GPT-4o, and Gemini debate a user topic; DeepSeek-style flows for clarify / moderate / summarize. Deployed on Vercel; optional client password gate; OpenRouter + OpenAI for APIs.

---

## What we did (timeline)

1. **Security baseline** — `.env.local` gitignored; `.env.example` placeholders only; removed `node_modules` / `.next` from history (GitHub 100MB limit); clean orphan commit + push.
2. **Build fix** — Lazy-init OpenAI in `app/api/debate/route.ts` so `next build` does not require `OPENAI_API_KEY` at module load.
3. **UI** — Removed idle logo; headline **Xpand your perspective** (amber X); session-scoped random topic chips (`lib/idle-suggestions.ts` + `sessionStorage`); copy aligned app-wide.
4. **Access control** — `PasswordGate` + `NEXT_PUBLIC_ACCESS_PASSWORD` (client-only; not a substitute for API hardening).
5. **Repo hygiene** — README, `poweredByHeader: false`, deploy script env sync.
6. **Privacy** — Removed public Vercel hostname from repo; `lib/openrouter-referer.ts` uses `VERCEL_URL` / optional `OPENROUTER_HTTP_REFERER`.
7. **Knowledge for agents** — `AGENTS.md`, `docs/runbook.md`, `.cursor/rules/polymathx-context.mdc`.

---

## Decisions worth remembering

| Topic | Choice | Why |
|-------|--------|-----|
| OpenRouter referer | Env-driven, not hardcoded URL | Avoid advertising prod URL in GitHub; Vercel sets `VERCEL_URL`. |
| Suggestion topics | `sessionStorage` + clear on login / New topic | Fresh picks per session without reshuffling every idle return. |
| Secrets | Vercel dashboard + local `.env.local` | Never commit keys; `NEXT_PUBLIC_*` is public in bundle. |
| Docs split | `AGENTS.md` vs `runbook.md` | Short agent context vs human ops steps. |

---

## Ops checklist (copy to recurring task)

- [ ] Vercel Production env: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_CONVEX_URL`, optional `NEXT_PUBLIC_ACCESS_PASSWORD`, optional `OPENROUTER_HTTP_REFERER`
- [ ] After `npx convex deploy` (prod): update `NEXT_PUBLIC_CONVEX_URL` → Redeploy Vercel
- [ ] OpenRouter + OpenAI usage / spend limits enabled
- [ ] GitHub: branch protection on `main` if solo/small team still wants safety

---

## Where things live (repo)

| Item | Path |
|------|------|
| Agent / contributor rules | `AGENTS.md` |
| Human runbook | `docs/runbook.md` |
| Cursor always-on rule | `.cursor/rules/polymathx-context.mdc` |
| OpenRouter referer helper | `lib/openrouter-referer.ts` |
| Idle topic pool + session cache | `lib/idle-suggestions.ts` |
| Deploy helper (local terminal) | `scripts/deploy-polymathx.sh` |

---

## Troubleshooting (quick)

- Build fails on missing OpenAI key during “Collecting page data” → ensure no `new OpenAI()` at top level in API routes.
- OpenRouter oddities → set `OPENROUTER_HTTP_REFERER` on Vercel if needed.
- Wrong Convex data → `NEXT_PUBLIC_CONVEX_URL` must match dev vs prod intent.

---

## External references (no secrets)

- [Convex docs — hosting](https://docs.convex.dev/hosting)
- [Vercel docs — env vars](https://vercel.com/docs/projects/environment-variables)
- [OpenRouter](https://openrouter.ai/) — keys & usage limits

---

## GitHub

- Repo: `https://github.com/limchinhan123/polymathx`  
- *(Do not paste private deployment URLs here if you want lower casual discovery.)*

---

## Linking this file to Notion

See **`docs/notion-second-brain-setup.md`** in the same folder for import steps and how to keep Notion + repo in sync.
