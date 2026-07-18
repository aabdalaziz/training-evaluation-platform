# Global Training Evaluation Platform — Next.js

## Local start
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Vercel environment variables
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Settings → API.
Never add `SUPABASE_SERVICE_ROLE_KEY` to the browser or commit it.
