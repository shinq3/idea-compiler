# IdeaCompiler - Project Nurturing OS

## Overview
A web application that helps nurture business projects from RFP to kickoff. Projects grow through meetings and inputs, with AI-powered analysis, structured data extraction, and automatic document generation. Features JWT-based authentication, organization management, and role-based access control (RBAC).

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js (Node/TypeScript)
- **Database**: PostgreSQL (via Drizzle ORM)
- **AI**: OpenAI API (o4-mini for extraction/summaries, gpt-4o-mini for slides/translations)
- **Auth**: JWT (jsonwebtoken + bcrypt), stored in localStorage
- **File Processing**: pdf-parse for PDF text extraction, multer for file uploads

## Authentication & RBAC
- **JWT Auth**: Token stored in localStorage as `ideacompiler_token`
- **Default credentials**: username=`admin`, password=`admin123`, role=`system_admin`
- **Roles**:
  - `system_admin`: All projects, all users, all orgs
  - `org_admin`: Org projects, manage org users (pm/member)
  - `pm`: Org projects, create/manage projects, manage members
  - `member`: Invited projects only (read + input)
- **Login**: Accepts username OR email
- **Middleware**: `requireAuth`, `requireRole(...roles)`, `requireProjectAccess`

## Routes
- `/` - Landing page (public LP with AI demo; redirects to /dashboard if logged in)
- `/login` - Login page
- `/dashboard` - Project dashboard (protected)
- `/projects/:id` - Project detail (protected)
- `/users` - User management (protected, admin/org_admin/pm)
- `/organizations` - Organization management (protected, admin/org_admin)
- `/profile` - User profile (protected)

## Key Features
1. **Landing Page** - Service overview with live AI demo (no auth required)
2. **Project Dashboard** - Overview of all projects with filtering/search
2. **Project Creation** - Title-only or with RFP PDF upload
3. **Project Deletion** - Delete project with confirmation dialog (cascades to all related data)
4. **Common Input UI** - Text, meeting notes, and file uploads
5. **Input Editing** - Edit input text in history tab; triggers re-extraction and summary regeneration
6. **Input Deletion** - Delete individual inputs; triggers summary regeneration from remaining inputs
7. **AI Analysis** - Automatic structured data extraction from inputs
8. **Auto-Summary** - AI generates and versions project summaries
9. **Document Generation** - Kickoff documents and feature proposals
10. **Confidence Gauges** - Budget/timeline/requirement confidence tracking
11. **Slide Generation** - Convert docs to HTML slides, viewable in-app and downloadable
12. **PWA Support** - Installable as native app on mobile/desktop
13. **Voice Input** - Browser recording → Whisper transcription → text insertion
14. **Multilingual AI Content** - ja/en/vi simultaneous output
15. **User Management** - CRUD users with role-based visibility
16. **Organization Management** - CRUD organizations (system_admin creates/deletes)
17. **Project Member Management** - Add/remove members to projects
18. **Profile Page** - Edit display name, email, and password

## Data Flow
Input (text/file) → PDF extraction (if PDF) → AI structured extraction (multilingual) → Summary update (multilingual) → DB save

## Auto-Polling (refetchInterval)
- Project detail page polls every 5s for project data, summary, and structured items until AI processing completes
- Polling stops automatically once data is available (confidence > 0, summary exists, items exist)
- This ensures the UI updates after background AI processing finishes (typically 30-120s)

## PDF Re-upload
- If PDF extraction failed (rawText starts with "["), a "Re-upload PDF" button appears in input history
- `POST /api/projects/:id/inputs/:inputId/reupload` replaces the file, re-extracts text, and triggers AI processing
- This is needed because deployment restarts may lose uploaded files from local filesystem
- Reprocess endpoint now returns specific error message when PDF files are missing from server

## Multilingual Content Format
- **Structured Items**: `valueJson.title` and `valueJson.description` are `{ ja, en, vi }` objects
- **Summaries**: `summaryJson` is `{ ja: { overview, ... }, en: { ... }, vi: { ... } }`
- **Documents**: `contentJson` is `{ ja: "markdown", en: "markdown", vi: "markdown" }` (fallback: `contentMd`)
- **Project Names**: `titleJson` and `customerNameJson` JSONB columns on `projects` table; `{ ja, en, vi }` objects
- **Input Text**: `translatedJson` JSONB column on `inputs` table; `{ ja, en, vi }` objects
- **Backward Compatibility**: `pickLang()` helper handles both old (single string) and new (multilingual object) formats

## Data Models
- `organizations` - Organization entity (name, slug)
- `users` - User entity (username, email, passwordHash, displayName, role, organizationId)
- `project_members` - Many-to-many project ↔ user mapping with role (viewer/editor)
- `projects` - Core project entity with confidence scores, organizationId
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
  lib/
    auth.tsx                  - AuthProvider, useAuth, getToken
    queryClient.ts            - TanStack Query client with auth headers
  pages/
    landing.tsx               - Public landing page with AI demo
    dashboard.tsx             - Project list with filters (route: /dashboard)
    project-detail.tsx        - Full project view with tabs
    login.tsx                 - Login page
    user-management.tsx       - User CRUD (role-scoped)
    org-management.tsx        - Organization CRUD
  components/
    layout.tsx                - App layout with nav, user info, logout
    language-switcher.tsx     - Language selector dropdown
    create-project-dialog.tsx
    input-panel.tsx           - Common input UI
    summary-display.tsx
    structured-items-panel.tsx
    documents-panel.tsx
    inputs-history.tsx
    summary-history.tsx
    confidence-gauge.tsx
    project-members-panel.tsx  - Member management in project detail
    slide-viewer.tsx

server/
  auth.ts       - JWT auth middleware (requireAuth, requireRole, requireProjectAccess)
  db.ts         - Database connection
  storage.ts    - Data access layer (IStorage) with user/org/member CRUD
  routes.ts     - API routes (all protected with auth)
  openai.ts     - AI service (extraction, summary, document gen)
  migrate-translations.ts - Data migration + default admin seeding

shared/
  schema.ts     - Drizzle schema + Zod types
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned)
- `OPENAI_API_KEY` - OpenAI API key (required)
- `SESSION_SECRET` - JWT signing secret

## API Endpoints
### Auth
- `POST /api/auth/login` - Login (username/email + password) → JWT token
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update own profile

### Organizations
- `GET /api/organizations` - List all orgs
- `POST /api/organizations` - Create org (system_admin only)
- `PATCH /api/organizations/:id` - Update org
- `DELETE /api/organizations/:id` - Delete org (system_admin only)

### Users
- `GET /api/users` - List users (filtered by role/org)
- `POST /api/users` - Create user (admin/org_admin/pm)
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Projects
- `GET /api/projects` - List projects (filtered by user permissions)
- `POST /api/projects` - Create project (admin/org_admin/pm)
- `GET/PATCH/DELETE /api/projects/:id` - Get/update/delete project
- `GET/POST/DELETE /api/projects/:id/members` - Project member management

### Demo (public, no auth)
- `POST /api/demo/analyze` - Analyze text and generate summary (landing page demo)
- `POST /api/demo/transcribe` - Transcribe audio file (landing page demo)

### Project Data
- `GET/POST /api/projects/:id/inputs` - List/add inputs
- `GET /api/projects/:id/structured-items` - Extracted data
- `GET /api/projects/:id/summaries` - Summary history
- `GET /api/projects/:id/summary/latest` - Latest summary
- `GET /api/projects/:id/documents` - Generated documents
- `POST /api/projects/:id/documents/generate` - Generate document
- `POST /api/transcribe` - Audio transcription (Whisper)
