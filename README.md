# SchemeSetu

SchemeSetu is a source-traceable scholarship discovery application for Indian students. The workspace includes a responsive React/TypeScript app, Express/TypeScript API, Supabase schema and RLS policies, verified-only scholarship search, saved-scholarship storage in the browser, admin review tools, and NVIDIA assistant answers grounded in verified records.

The public catalog includes a small local starter set based on current National Scholarship Portal listings. It is not a complete directory: check the linked official source for current eligibility and deadlines. Supabase remains supported and is used for the main catalog whenever it has records; the local set keeps browse, search, details, saved items, and the eligibility checker usable without a configured database.

## Setup

Requirements: Node.js 20+ and npm. A Supabase project enables accounts, the full shared catalog, saved items, private documents, notifications, and administration. The local starter catalog works without Supabase. An NVIDIA API key is needed for live AI answers.

1. Run `npm install` at the repository root.
2. Follow [the Supabase setup guide](docs/supabase-setup.md) to create a database and connect sign-in. Supabase is the recommended choice here: it includes secure email/password accounts and a dashboard where you can inspect registered users.
3. Copy `.env.example` to `.env` at the repository root. Add `NVIDIA_API_KEY` only if you want live assistant answers. Keep the Supabase service role key and NVIDIA key backend-only; never set them in a `VITE_` variable.
4. Run `npm run dev`.

Frontend: http://localhost:3000. API: http://localhost:4000/api/health. Vite reads the root `.env`; the API loads it from the repository root when run through its workspace script.

## First administrator

Create a user through the app and confirm the account. Then, in the Supabase SQL editor, grant that exact account administrator access:

```sql
insert into public.admin_users(user_id, role)
select id, 'admin' from auth.users where email = 'admin@example.org'
on conflict (user_id) do update set role = excluded.role;
```

Only trusted operators should receive this role. The application has no public admin registration flow.

## Environment services

- NVIDIA assistant: set server-side `NVIDIA_API_KEY`. `NVIDIA_MODEL` defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`. The assistant uses NVIDIA's OpenAI-compatible chat endpoint and grounds answers in verified records found through database search. Set `GEMINI_API_KEY` only if you also want Gemini embeddings for semantic retrieval; full-text search remains available without it.
- Source checks: `SOURCES_CONTACT` identifies the crawler in its user-agent. Admins can register official sources and explicitly allow checks. The scheduled checker respects `robots.txt`, uses bounded requests, and marks linked records outdated when source content changes or is unavailable. It does not extract scholarship details or update records automatically.
- Email reminders: configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.
- Web push: generate VAPID keys (`npx web-push generate-vapid-keys`); set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the backend, and the same public key in `VITE_WEB_PUSH_PUBLIC_KEY`.
- Documents: the migration creates a private `student-documents` storage bucket limited to 8 MB PDFs, PNGs, and JPEGs. Images use Tesseract OCR; PDFs use their embedded text layer. Scanned PDFs do not currently receive OCR. OCR extracts masked identifiers and basic document type/readability only; it is not official identity verification and raw document text is not sent to Gemini.

## Current modules

- Scholarship search uses the full verified database with server-side pagination (20/50/100), full-text search, state/UT, level, education, category, course, amount, status, and sorting filters.
- No student account or sign-in is required. Profile details and saved scholarships stay in browser local storage on this device. Clearing browser storage removes them.
- Eligibility results compare required normalized rules. Missing facts remain `needs information`; a scholarship with no required rules is not reported as eligible.
- Saved scholarships are stored locally in the browser; cross-device sync and application progress tracking are not enabled in guest mode. Official links open with an external-site confirmation.
- AI responses are grounded in verified records and cite their source URL. Do not put identity document contents into prompts.
- Private document analysis masks Aadhaar/PAN-like patterns, lists readability warnings, and lets the student delete the file and analysis.
- The admin dashboard shows source/scheme counts for all 28 states and 8 UTs, source freshness, JSON/CSV import, duplicate detection, and pending verification. Imports remain pending until reviewed. Scholarship edits return the record to pending. Its source checker only flags changed sources for human review.
- The assistant UI supports English, Hindi, Kannada, Tamil, Telugu, Bengali, and Marathi. Voice input/output use browser speech features and depend on browser and system language support.
- Account-based deadline notifications and private document uploads are not exposed in the guest interface.

## API

- `GET /api/health`
- `GET /api/scholarships?page=1&pageSize=20&q=&level=&state=&status=&education=&course=&category=&minAmount=&sort=deadline`
- `GET /api/coverage`
- `POST /api/assistant`
- `POST /api/documents/analyze` and `DELETE /api/documents/:id` (bearer-authenticated)
- `/api/notifications/*` (bearer-authenticated)
- `/api/admin/*` (bearer-authenticated and requires an `admin_users` row)

## Data accuracy and source coverage

Add sources in the admin dashboard only after reviewing that they are official. Register the specific official state, UT, central department, or institutional source; do not use a generic URL to imply a verified scholarship portal. Import structured data from official sources only. Each imported scholarship must include an official application URL before it can be verified and displayed publicly. Unknown fields remain unknown. Expired records can remain in history.

The repository does not ship a fabricated sample list. It seeds the source registry with the five national/state/institutional portals named in the project brief, but it does not claim verified coverage or seed scholarship records. The source checker detects source changes; source-specific crawlers, PDF scheme extraction, and AI-assisted extraction review still need implementation for each source. Scanned-PDF OCR is not supported. Chat translations and browser voice quality depend on the selected browser speech services. Coverage is an honest count of records and registered sources, not a guarantee that all Indian scholarships are represented.

## Checks

- `npm run build`
- `npm --workspace frontend test`
- `npm --workspace backend test`
- `npm audit --omit=dev --audit-level=high`

Tests cover rule evaluation, pagination parameter validation, admin route authorization, source/import validation and duplicate keys, document masking, reminder planning, and setup fallbacks.

