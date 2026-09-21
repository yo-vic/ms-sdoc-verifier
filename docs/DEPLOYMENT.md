[← Back to README](../README.md)

# Deployment

## Vercel

1. Import the repository in Vercel, select the branch to deploy.
2. Set these environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GEMINI_MODEL
```

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only secrets — never give either a `NEXT_PUBLIC_` prefix, or they ship to every visitor's browser.

3. Deploy. Vercel builds the Next.js app natively — no Dockerfile is used or required.

## Pre-submission checklist

- [ ] Confirm `.env` / `.env.local` are gitignored and no real credentials are committed anywhere in the repo history
- [ ] Rotate the Supabase service-role key if it was ever committed, and update it in Vercel
- [ ] Run `npm run seed`, `npm run classify`, `npm run compare` against the full dataset at least once against the deployed Supabase project
- [ ] Confirm `/api/export/submission` returns a complete, correctly-shaped `submission.json`
- [ ] Confirm the deployed Vercel URL is reachable and the review queue / insights pages render with real data

## Alternative: containerized deployment

Not required for this submission, but if a container is ever needed (Cloud Run, Render, etc.), Next.js supports a standard `output: "standalone"` build for a minimal Docker image. Not currently configured in this repo.