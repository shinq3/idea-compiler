# CaseNurture - Project Nurturing OS

## Overview
A web application that helps nurture business projects from RFP to kickoff. Projects grow through meetings and inputs, with AI-powered analysis, structured data extraction, and automatic document generation.

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js (Node/TypeScript)
- **Database**: PostgreSQL (via Drizzle ORM)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 for analysis/generation)
- **File Processing**: pdf-parse for PDF text extraction, multer for file uploads

## Key Features
1. **Project Dashboard** - Overview of all projects with filtering/search
2. **Project Creation** - Title-only or with RFP PDF upload
3. **Common Input UI** - Text, meeting notes, and file uploads
4. **AI Analysis** - Automatic structured data extraction from inputs
5. **Auto-Summary** - AI generates and versions project summaries
6. **Document Generation** - Kickoff documents and feature proposals
7. **Confidence Gauges** - Budget/timeline/requirement confidence tracking

## Data Flow
Input (text/file) → PDF extraction (if PDF) → AI structured extraction → Summary update → DB save

## Data Models
- `projects` - Core project entity with confidence scores
- `inputs` - All project inputs (text, meeting notes, PDF, files)
- `structured_items` - AI-extracted structured data (requirements, decisions, constraints, etc.)
- `summaries` - Versioned project summaries (JSON)
- `documents` - Generated documents (kickoff, feature proposals)

## i18n (Internationalization)
- **Languages**: Japanese (ja, default), English (en), Vietnamese (vi)
- **System**: Custom React context-based i18n (`client/src/i18n/`)
- **Files**: Separate JSON locale files in `client/src/i18n/locales/{ja,en,vi}.json`
- **Usage**: `const { t } = useI18n()` then `t("key.path")` with optional params `t("key", { count: 5 })`
- **Switcher**: Language dropdown in header, persisted to localStorage

## File Structure
```
client/src/
  i18n/
    index.tsx                 - I18nProvider context + useI18n hook
    locales/ja.json           - Japanese translations (default)
    locales/en.json           - English translations
    locales/vi.json           - Vietnamese translations
  pages/dashboard.tsx         - Project list with filters
  pages/project-detail.tsx    - Full project view with tabs
  components/layout.tsx       - App layout wrapper + language switcher
  components/language-switcher.tsx - Language selector dropdown
  components/create-project-dialog.tsx
  components/input-panel.tsx  - Common input UI
  components/summary-display.tsx
  components/structured-items-panel.tsx
  components/documents-panel.tsx
  components/inputs-history.tsx
  components/summary-history.tsx
  components/confidence-gauge.tsx

server/
  db.ts         - Database connection
  storage.ts    - Data access layer (IStorage)
  routes.ts     - API routes
  openai.ts     - AI service (extraction, summary, document gen)
  seed.ts       - Seed data

shared/
  schema.ts     - Drizzle schema + Zod types
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-set by Replit AI Integrations

## API Endpoints
- `GET/POST /api/projects` - List/create projects
- `GET/PATCH/DELETE /api/projects/:id` - Get/update/delete project
- `GET/POST /api/projects/:id/inputs` - List/add inputs (supports multipart file upload)
- `GET /api/projects/:id/structured-items` - Extracted data
- `GET /api/projects/:id/summaries` - Summary history
- `GET /api/projects/:id/summary/latest` - Latest summary
- `GET /api/projects/:id/documents` - Generated documents
- `POST /api/projects/:id/documents/generate` - Generate document (body: {type: "kickoff" | "feature_proposal"})
