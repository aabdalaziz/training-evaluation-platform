---
name: athar-release
description: Release recipe for the Athar repo when the owner deploys through the GitHub website and the Supabase dashboard only — SQL first with expected counts, low‑memory Next build, mock + Playwright QA, zip whose root is the repo tree, Arabic click‑by‑click steps with verified plain URLs, and post‑«تم» verification (commit sha, byte‑compare of every pushed file, Vercel chunk check).
---

# Athar — release recipe (owner deploys via GitHub web UI)

## Order
1. **Proposal** `.txt` (Arabic, numbered sections, naming rationale) → wait for «موافق».
2. **SQL first**: `supabase/migrations/<date>_<phase>.sql`, idempotent (`if not exists`, `drop policy if exists`), RLS self‑read, comments, and a trailing diagnostic `select` block with the **expected numbers written as comments**. Present the file; give the editor link `https://supabase.com/dashboard/project/nybinzuqwhcctgwcimru/sql/new`; wait for «تم» / screenshot.
3. **Build while waiting** (pure core → glue → UI → tests → docs), mirroring every edited file into `dashboard-redesign/phaseNN-pXX/src/` immediately (sandbox is volatile).
4. **QA gate**: unit (`timeout 900 npx tsx tests/index.ts` → `# fail 0`), scoped tsc (`/tmp/tsconfig.lib.json` + new files, heap 1500), low‑mem build (below), mock + `next start -p 3100`, `tools/shot-pNN.py` → all PASS, regressions of the touched phases, visual check of screenshots.
5. **Docs**: `docs/RELEASE-PNN-…-AR.md` + `.txt` twin; update `AGENTS.md` «Shipped» line and skills if a pattern changed.
6. **Zip**: root = repo tree (only changed/new files; never `package-lock.json`, `next-env.d.ts`, a mutated `tsconfig.json`). The owner **enters the extracted folder and drags the top‑level folders** onto `https://github.com/aabdalaziz/training-evaluation-platform/upload/main`. One commit per phase.
7. **After «تم»**: GitHub API `commits/main` → sha + `files[]`; `cmp` every pushed file against `raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>`; Vercel: old chunk 404 + new chunk hash present (lazy `next/dynamic` chunks via the webpack runtime map); then write the LIVE line in `BACKLOG-AR.txt`.

## Low‑memory build (2 GB sandbox)
```bash
source /tmp/env.sh   # ANON key is required for prerender
sed -i "43s/const nextConfig = {/const nextConfig = { typescript: { ignoreBuildErrors: true }, experimental: { cpus: 1, workerThreads: false, webpackBuildWorker: false }, webpack: (c) => { c.cache = false; c.parallelism = 1; return c; },/" next.config.js
rm -rf .next && NODE_OPTIONS=--max-old-space-size=1150 NEXT_TELEMETRY_DISABLED=1 npx next build > /tmp/build.log 2>&1; echo BUILD_EXIT=$?
cp /tmp/nc.js next.config.js; cp /tmp/tsconfig.pristine.json tsconfig.json   # always restore
```
Stop mock/server before building; free `/tmp` (tmpfs); run via a background process and wait on `RESTORED`.

## Messages to the owner (Arabic)
- Numbered click‑by‑click steps; every link a plain clickable URL (never in backticks), verified before sending.
- State honestly what was not built/tested (e.g. sandbox wiped, feature deferred) and why.
- Close with: (أ) docs → (ب) next 2030 phase proposal → (ج) ops decisions pending the owner (domain `athar-portal.sa`, Resend, Strix pentest).
