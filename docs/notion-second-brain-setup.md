# Link this second brain to Notion

This project’s canonical notes live in **`second-brain-polymath-x.md`**. Use Notion as your dashboard; keep the markdown in git as the durable source.

**Existing Notion page (from MCP):** [Personal second brain — Polymath X](https://www.notion.so/33299bef333881878e5dc9ecdd2ad67a) — move it under your wiki / pin to sidebar as you like.

## Option A — Import once (fastest)

1. Open [Notion](https://notion.so) → workspace where you want the hub.
2. Create a top-level page, e.g. **“Second brain”** or **“Polymath X”**.
3. In that page: **`⋯` (menu) → Import → Markdown**.
4. Upload **`docs/second-brain-polymath-x.md`** from this repo (or paste its contents into a new page).
5. Fix heading hierarchy in Notion if the importer flattens anything.

**Link back to the repo:** Add a **Callout** or line at the top:  
`Source of truth (Git):` + link to your GitHub repo’s `docs/second-brain-polymath-x.md` (browse URL).

## Option B — Linked database (better for many notes later)

1. Create a **Full page database** in Notion, e.g. **“Knowledge”**.
2. Properties: **Name** (title), **Project** (select: Polymath X, …), **Type** (select: Runbook, Decision, Session, …), **Source** (URL → GitHub file), **Last synced** (date — manual).
3. Add a row: **Polymath X — second brain** with **Source** = link to the markdown file on GitHub.
4. In the row page body: paste key sections or embed a **Bookmark** to the GitHub file.

## Option C — Notion + GitHub (if you use the integration)

If your workspace has the **GitHub** connection: link the **polymathx** repository so you can paste issue/PR links into Notion pages; keep **`docs/second-brain-polymath-x.md`** updated via normal commits.

## Keeping Notion and git in sync

- **Git wins** for accuracy (env names, paths, commits). After big changes, re-import or paste updated sections into Notion.
- Or: treat Notion as **navigation + tasks** only; deep detail stays in **`AGENTS.md`** / **`docs/runbook.md`** / this file.

## Optional: Notion AI / Cursor together

- In Cursor: `.cursor/rules` already points agents at **`AGENTS.md`**.
- In Notion: pin the imported page to your sidebar for quick human access.

---

*If you use Cursor with **Notion MCP** enabled, you can ask to “create a Notion page from `docs/second-brain-polymath-x.md`” in a session where that MCP is available.*
