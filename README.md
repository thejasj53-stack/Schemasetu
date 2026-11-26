# SchemeSetu

SchemeSetu is a source-traceable scholarship discovery application for Indian students. The workspace includes a responsive React/TypeScript frontend, a Java Spring Boot API, and Supabase schema and RLS policies.

The bundled catalog includes a small starter set based on National Scholarship Portal listings. It is not a complete directory: check the linked official source for current eligibility and deadlines. The Spring Boot API uses Supabase for public catalog reads when configured, then falls back to the bundled local data. It uses NVIDIA for assistant answers when configured and otherwise answers from the local catalog.

## Setup

Requirements: Java 17+, Node.js 20+, and npm. The Maven Wrapper downloads Maven on first use. The public catalog works without a database or AI provider.

1. Run `npm install` at the repository root.
2. Copy `.env.example` to `.env` if you want Supabase catalog reads or NVIDIA assistant answers, then fill in the keys. Keep `SUPABASE_SERVICE_ROLE_KEY` backend-only; account, admin, document, and notification routes still need their Java migration.
3. Run `npm run dev`.

Frontend: http://localhost:3000. API: http://localhost:4000/api/health.

## Java API

The backend is in `backend/src/main/java/in/schemesetu/api`. It uses Spring Boot and a small controller that reads `data/local-schemes.json`. Run it directly with `backend/mvnw.cmd -f backend/pom.xml spring-boot:run` on Windows, or `./backend/mvnw -f backend/pom.xml spring-boot:run` on macOS/Linux.

The Java API keeps the public catalog routes and response shapes used by the frontend. Supabase-backed public catalog reads and live NVIDIA answers are supported when configured. Account deletion, document OCR, admin management, and push/email reminders still need Java implementations.

## Current modules

- Scholarship browsing, search, details, and eligibility use Supabase when configured, with the bundled local catalog as a fallback.
- Saved items and profile details remain in browser local storage for guest use.
- The assistant uses NVIDIA with catalog records when configured and returns local catalog suggestions as a fallback.
- The existing React interface and styling are unchanged. Supabase sign-in remains configured in the frontend when its public settings are provided.
- Supabase-backed public catalog reads and NVIDIA answers are supported. Account deletion, OCR document analysis, admin writes/imports, and notification delivery still need Java implementations.

## API

- `GET /api/health`
- `GET /api/scholarships?page=1&pageSize=20&q=&level=&state=&status=&education=&course=&category=&minAmount=&sort=deadline`
- `GET /api/scholarships/{id}`
- `GET /api/coverage`
- `GET /api/eligibility/schemes`
- `POST /api/assistant` (NVIDIA answers when configured, with local catalog fallback)

## Data accuracy and source coverage

The bundled catalog is a small starter set, not a complete directory. Check each linked official source for current eligibility and deadlines.

## Checks

- `npm run build`

