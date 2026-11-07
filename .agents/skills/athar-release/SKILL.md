source /tmp/env.sh   # ANON key is required for prerender
sed -i "43s/const nextConfig = {/const nextConfig = { typescript: { ignoreBuildErrors: true }, experimental: { cpus: 1, workerThreads: false, webpackBuildWorker: false }, webpack: (c) => { c.cache = false; c.parallelism = 1; return c; },/" next.config.js
rm -rf .next && NODE_OPTIONS=--max-old-space-size=1150 NEXT_TELEMETRY_DISABLED=1 npx next build > /tmp/build.log 2>&1; echo BUILD_EXIT=$?
cp /tmp/nc.js next.config.js; cp /tmp/tsconfig.pristine.json tsconfig.json   # always restore
