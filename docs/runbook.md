# Polymath X — operations runbook

Human-facing steps and checklists. For short agent-oriented rules, see **`AGENTS.md`** at the repo root.

---

## 1. Prerequisites
- Node 18+, npm  
- Convex account + project  
- OpenRouter API key  
- OpenAI API key (GPT path in `/api/debate`)  
- Vercel account (if hosting there)

---

## 2. First-time production setup

### 2.1 Vercel
1. Import the GitHub repo (or connect Git on an existing project).  
2. **Settings → Environment Variables** — add for **Production** (and **Preview** if you use previews):

| Variable | Notes |
|----------|--------|
| `OPENROUTER_API_KEY` | Server only |
| `OPENAI_API_KEY` | Server only |
| `NEXT_PUBLIC_CONVEX_URL` | Use **production** Convex URL (after step 2.2) |
| `NEXT_PUBLIC_ACCESS_PASSWORD` | Optional; gate is client-side only |
| `OPENROUTER_HTTP_REFERER` | Optional; override OpenRouter referer (default: `https://$VERCEL_URL`) |

3. Deploy (or push `main` if auto-deploy is on).

### 2.2 Convex production
```bash
cd /path/to/polymath-x
npx convex deploy
```
Copy the **production** deployment URL, set **`NEXT_PUBLIC_CONVEX_URL`** on Vercel to that value, then **Redeploy** the Vercel project.

### 2.3 Domain (optional)
- Vercel → **Settings → Domains** — attach your hostname or use the default `*.vercel.app` URL Vercel assigns.  
- Do not rely on publishing that URL in the repo if you want lower casual discovery; share the link only where you intend.

---

## 3. Day-to-day changes
- Merge to **`main`** → Vercel rebuilds if Git integration is enabled.  
- After **any** env var change on Vercel → **Redeploy** so the new values apply.

---

## 4. Rotating API keys
1. Generate new keys in OpenRouter / OpenAI dashboards.  
2. Update values in **Vercel** (same variable names).  
3. Redeploy.  
4. Revoke old keys at the provider.  
5. If a key ever appeared in chat, a ticket, or a commit, **assume compromise** and rotate.

---

## 5. Local development
```bash
cp .env.example .env.local
# Fill .env.local (dev Convex URL, keys, optional password)

npm install
npx convex dev    # terminal 1
npm run dev       # terminal 2 → http://localhost:3000
```

---

## 6. Troubleshooting

| Symptom | Things to check |
|---------|------------------|
| Build fails on “Missing … OPENAI_API_KEY” during collect page data | Ensure OpenAI client is **not** constructed at module load in new API routes; use lazy init. |
| OpenRouter errors / attribution | `HTTP-Referer` comes from **`lib/openrouter-referer.ts`**. Set **`OPENROUTER_HTTP_REFERER`** on Vercel if you need a fixed public URL for policy reasons. |
| History empty or wrong environment | Client **`NEXT_PUBLIC_CONVEX_URL`** must match the Convex deployment you expect (dev vs prod). |
| Surprise API cost | OpenRouter + OpenAI **usage / spend limits**; optional Vercel **Deployment Protection**; optional in-app password (`NEXT_PUBLIC_ACCESS_PASSWORD`). |

---

## 7. Backups & repo hygiene (optional)
- **Private fork** of the repo for a spare copy.  
- **Branch protection** on `main` (no force-push, no branch delete) via GitHub **Settings → Branches**.  
- GitHub **About** description: keep it factual; avoid pasting a secret production URL if you prefer obscurity.

---

## 8. Helper script
- **`scripts/deploy-polymathx.sh`** — intended to run on **your machine** (Vercel login, `npx vercel`, optional env sync from `.env.local`). Cursor sandboxes often cannot complete interactive deploys; use your terminal.
