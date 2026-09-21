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

## Operational Verification & Security

- **Environment & Secrets:** Production credentials are managed exclusively via Vercel environment variables. No secrets or `.env` files are committed to source control.
- **Data Integrity:** Database seeding (`npm run seed`), classification (`npm run classify`), and comparison execution (`npm run compare`) have been executed and verified against the full dataset in the Supabase production environment.
- **Export Verification:** The `/api/export/submission` endpoint has been validated to return a fully compliant `submission.json` schema.
- **Access & UI:** The production Vercel instance, review queue, and analytics pages have been verified for public access and real-time data rendering.

## Containerized Deployment (Optional)

For container-based environments (such as GCP Cloud Run, AWS ECS, or Render), Next.js natively supports a standalone build target.

To build a minimal Docker container:

1. Add `output: "standalone"` to `next.config.js`.
2. Build the production output via `npm run build`.
3. Package the standalone bundle into a lightweight Node.js Docker container.
