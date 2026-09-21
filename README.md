# ClearPort

ClearPort is a shipping-document verification system built for the Averis x Monash Hackathon 2026. It reads shipping-operations emails, classifies them, extracts the seven scored fields from Shipping Instruction (SI) and Bill of Lading (BL) attachments, flags mismatches, and routes anything uncertain to a human review queue — with every decision traced back to source evidence.

## What it does

- **Classifies** every inbound email into one of five categories (comparison request, new SI request, invoice query, general, spam) using a deterministic rule pass first, falling back to Gemini only when the rules genuinely can't tell.
- **Extracts** the seven scored fields (shipper, consignee, notify party, port of loading, port of discharge, container count, gross weight) from SI/BL attachments across `.txt`, `.xlsx`, `.docx`, and `.pdf` formats, with label-synonym matching (e.g. "port of loading" = "load port" = "POL").
- **Compares** SI against BL and reports `OK`, `MISMATCH` (with the exact differing fields shown side by side), or `NEEDS_REVIEW` (with a specific reason: unreadable, missing attachment, wrong document type, or missing value).
- **Escalates** anything the system can't confidently resolve to a human review queue, rather than guessing.
- **Exports** results in the exact JSON shape required for organiser self-evaluation.

## Tech stack

- **Next.js** (App Router) — UI, server components, and API routes in a single deployable
- **Supabase** — Postgres (with Row Level Security), private Storage bucket for source documents, audit logging
- **Gemini** — low-confidence classification fallback only; most emails are classified for free by deterministic rules

See [Architecture](docs/ARCHITECTURE.md) for how these fit together.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Gemini values
npm run dev
```

Open `http://localhost:3000`.

## Processing the dataset

Run in this exact order — each stage depends on the previous one having finished:

```bash
npm run seed        # 1. Upload emails and attachments to Supabase
npm run classify     # 2. Classify every email
npm run compare       # 3. Extract and compare SI/BL pairs for BL_COMPARISON emails
```

See [Pipeline](docs/PIPELINE.md) for what each stage does and why the order matters.

## Checks

```bash
npm run typecheck
npm run test
npm run build
```

## Challenges Faced

1.  **Heterogeneous & Unstructured Document Formats**
    
    *   _Challenge:_ Shipping documents arrive in multi-format variations (.pdf, .docx, .xlsx, .txt) with inconsistent layouts, missing headers, or varying table structures.
        
    *   _Solution:_ Built modular format-specific parsers wrapped in standardized text-cleaning layers that normalize documents into clean text strings prior to extraction.
        
2.  **Noise and False Positives in Field Matching**
    
    *   _Challenge:_ Trivial formatting discrepancies—such as string case ("CONTAINER #123" vs "Container 123"), company suffix variations ("LLC" vs "Limited"), or differing weight units—frequently triggered false-positive mismatches.
        
    *   _Solution:_ Implemented a deterministic field normalization engine (lib/pipeline/normalize.ts) that standardizes legal entity names, strips punctuation noise, resolves port codes, and converts weights (e.g., lbs to kg) before evaluating field equality.
        
3.  **Latency, Rate Limits, and LLM Cost Boundaries**
    
    *   _Challenge:_ Routing every email through Large Language Models introduced execution latency, potential API rate-limiting issues, and unnecessary API costs.
        
    *   _Solution:_ Designed a rule-first hybrid architecture. Fast keyword/regex logic handles standard structured messages instantaneously at zero cost, reserving Gemini API calls strictly for ambiguous edge cases.
        

## Future Potential & Roadmap

*   **Optical Character Recognition (OCR) Engine Integration**
    
    *   Expand document ingestion pipelines with OCR engines (e.g., Tesseract / Vision AI) to extract structured fields from scanned image-only PDFs and physical paper document photos.
        
*   **Enterprise ERP & Port Authority Connectors**
    
    *   Integrate directly with logistics platforms and port gateways (such as CargoWise or SAP) via webhook endpoints to trigger automated customs approvals upon zero-mismatch verification.
        
*   **Multilingual Support**
    
    *   Extend string normalization and field-parsing rules to support multi-language global shipping documentation (e.g., Mandarin and Malay).

## Documentation Index

- [Architecture](docs/ARCHITECTURE.md) — system design, data flow, tiers
- [Pipeline](docs/PIPELINE.md) — classification, extraction, and comparison in detail
- [Deployment](docs/DEPLOYMENT.md) — Vercel setup, environment variables, security checklist
- [Phase 1 — Data Foundation](docs/PHASE-1.md) — ingestion, Supabase setup walkthrough
- [Phase 2 — Classification](docs/PHASE-2.md) — rule design and verification results