# ClearPort

ClearPort is a shipping-document verification workspace for the Averis x Monash Hackathon. It classifies incoming shipping emails, extracts SI and Bill of Lading values, and flags document mismatches for review.

## Architecture

- **Next.js** provides the web interface and server-side API routes.
- **Supabase** stores email records, comparison results, audit events, and source documents.
- **Gemini** provides the low-confidence classification fallback.

The browser only receives the UI. Database access, document processing, and API keys remain on the server.

## Local setup

1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env.local` and enter the Supabase and Gemini values.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

## Dataset processing

The source dataset remains in `inbox/` and `attachments/`. It is used locally to upload source documents into Supabase Storage; it is not shipped to the browser.

```bash
npm run seed              # Upload emails and attachments to Supabase
npm run classify          # Classify dataset emails
npm run compare           # Extract and compare SI/BL document pairs
```

Useful checks:

```bash
npm run test
npm run typecheck
npm run build
```

## Deploying to Vercel

Import the repository in Vercel and select the `feature/document-verification` branch. Add these environment variables in Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GEMINI_MODEL
```

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only secrets. Never give either a `NEXT_PUBLIC_` prefix.
