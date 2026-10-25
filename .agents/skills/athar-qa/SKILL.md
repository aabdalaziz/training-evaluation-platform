name: athar-qa
description: Quality gate for the Athar repo — TypeScript check, node:test suite, Next build, mock Supabase server with fixtures/RPCs, Playwright E2E screenshots, and byte-level verification of files pushed through the GitHub website. Use before delivering any change to github.com/aabdalaziz/training-evaluation-platform.
Athar — QA & delivery verification
Local setup (fresh sandbox)
Bash

git clone --depth 1 https://github.com/aabdalaziz/training-evaluation-platform /tmp/tep && cd /tmp/tep
cp -r /home/user/dashboard-redesign/tools .          # mock + shot scripts (if available)
npm install --no-audit --no-fund                        # ~15–55 s
pip install playwright pglast pymupdf && python3 -m playwright install chromium && sudo -n python3 -m playwright install-deps chromium
Gate (all must pass, in this order)
./node_modules/.bin/tsc --noEmit --skipLibCheck (never npx tsc — it resolves a bogus package).
npx tsx tests/index.ts → # fail 0 (Node 20 ignores .ts with node --test).
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJdummy npx next build then git checkout -- tsconfig.json next-env.d.ts (build mutates them; never deliver them).
Mock + app: python3 tools/mock-supabase.py (port 54321) and SUPABASE_SERVICE_ROLE_KEY=svc NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100 ... npx next start -p 3100 -H 0.0.0.0 as background processes (restart next start after every rebuild — stale chunks).
Playwright script tools/shot-pN.py: login admin@upm.edu.sa / any password; collect pageerror + console errors and assert the list is empty; screenshot every new screen at 1366×860 full_page=True; exercise downloads (accept_downloads=True, expect_download, assert %PDF- header / xlsx size); page.on('dialog', accept).
Visually inspect key screenshots and PDF previews (pymupdf → PNG) before packaging.
Mock server rules (tools/mock-supabase.py)
In-memory; re-seed by restarting between stateful E2E runs. Duplicate table keys override fixtures. Unknown tables POST → [] (add an explicit insert branch per new table). RPCs are explicit branches under /rest/v1/rpc/<name>. HEAD must not write a body. No RLS/triggers → emulate in RPC branches.
Fixture ids must look like what the code expects (UUID-like when parsed; option values must exist in lib/portal/* catalogs).
Add 2–3 realistic fixtures per state (new/in-progress/done; ar + en) so screenshots double as documentation.
Delivery verification
Bash

R=https://raw.githubusercontent.com/aabdalaziz/training-evaluation-platform/main
curl -sg "$R/app/x/%5Bid%5D/page.tsx?nocache=$RANDOM" | cmp - 3NN-page.tsx && echo OK   # -g for [id] paths
curl -s https://api.github.com/repos/aabdalaziz/training-evaluation-platform/commits/<sha>/status  # Vercel state
Vercel Hobby: 100 deployments/day; a rate-limited commit needs a NEW commit after reset. NEXT_PUBLIC_* changes require Redeploy.
A deploy failing in ~10 s = type error from a missing imported file → the owner skipped a file; re-send its link.
Production smoke: curl -s -o /dev/null -w "%{http_code}" https://athar-portal.vercel.app/<path> for every new route.
Known environment quirks
pkill -f/pgrep -f can kill the agent shell — use process tools. Server-side fetch to the public sandbox URL returns 403 — build against 127.0.0.1. Playwright class-scoped :has-text(); set_input_files for uploads; real console messages only via next dev.
