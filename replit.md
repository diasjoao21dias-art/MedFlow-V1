# replit.md

## Overview



## Environment Variables (recommended)

- `DB_PATH` (optional): path for SQLite database file. Default: `./data/sqlite.db`.
- `UPLOAD_DIR` (optional): directory for uploaded files (logos, etc). Default: `./uploads`.
- `SESSION_SECRET` (required in production): secret used to sign session cookies.
- `SESSION_STORE` (optional): set to `sqlite` to persist sessions on disk (recommended for production).

## Password hashing

Passwords are stored using **bcrypt** (`bcryptjs`). Existing plain-text passwords (legacy) are auto-migrated on successful login.
This is a **Clinic Management System (Single-tenant)** (Gestão de Clínica) built for medical clinics in Brazil. It handles the full patient care workflow — from scheduling appointments to check-in, nursing triage, and doctor consultations. The system is designed as a single-tenant system (one clinic per installation), with role-based access control (RBAC) for three user types: **Admin**, **Operator/Reception**, and **Doctor**. Patients do not have direct system access; all operations are performed by staff.

The interface is in Portuguese (Brazilian), and the system uses Brazilian conventions (CPF for patient IDs, etc.).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure

The project follows a **monorepo** pattern with three main directories:

- **`client/`** — React frontend (SPA)
- **`server/`** — Express.js backend (API server)
- **`shared/`** — Shared code between client and server (schema definitions, API route contracts, types)

### Frontend

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state; no global client state library
- **UI Components**: Shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation via `@hookform/resolvers`
- **Charts**: Recharts (via shadcn chart component)
- **Styling**: Tailwind CSS with CSS custom properties for theming (medical blue/teal palette). Fonts: Inter (body) and Outfit (display headings)
- **Build Tool**: Vite with path aliases (`@/` → `client/src/`, `@shared/` → `shared/`)

### Backend

- **Framework**: Express.js 5 running on Node.js with TypeScript (executed via `tsx`)
- **Authentication**: Passport.js with Local Strategy, using cookie-based sessions (express-session) with MemoryStore
- **Password Hashing**: Node.js built-in `bcrypt (bcryptjs)`
- **API Design**: REST API with all routes prefixed `/api/`. Route contracts are defined in `shared/routes.ts` with Zod schemas for input validation and response typing
- **Authorization**: Role-based middleware (`requireAuth`) checks `req.isAuthenticated()`. Route-level role checks enforce RBAC (admin, operator, doctor)

### Database

- **Database**: SQLite (file-based, stored as `sqlite.db` in project root)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-Zod type generation
- **Schema Location**: `shared/schema.ts` — defines all tables and relations using `drizzle-orm/sqlite-core`
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)
- **Key Tables**:
  - `clinics` — Multi-tenant clinic entities with subscription status
  - `users` — Staff accounts with role (admin/operator/doctor), linked to a clinic
  - `patients` — Patient records linked to a clinic (name, CPF, birth date, contact info)
  - `appointments` — Scheduled visits with status workflow (agendado → confirmado → presente → em_atendimento → finalizado/cancelado)
  - `medicalRecords` — Clinical records (JSONB for vitals, diagnosis, prescriptions) linked to patient and doctor

### API Contract Pattern

The `shared/routes.ts` file defines a typed API contract object (`api`) that both the frontend and backend reference. Each endpoint specifies method, path, input schema, and response schemas. This ensures type safety across the full stack without code generation.

### Build & Deploy

- **Development**: `npm run dev` — runs the Express server with Vite middleware for HMR
- **Production Build**: `npm run build` — Vite builds the client to `dist/public/`, esbuild bundles the server to `dist/index.cjs`
- **Production Run**: `npm start` — runs the bundled server which serves static files from `dist/public/`

### Storage Layer

The `server/storage.ts` file implements a `DatabaseStorage` class conforming to an `IStorage` interface. This abstraction layer sits between routes and the database, making it possible to swap storage implementations. All database queries go through this layer.

## External Dependencies

### Required Services

- **SQLite Database**: File-based, no external provisioning needed (`sqlite.db` in project root)
- **Session Secret**: `SESSION_SECRET` environment variable (falls back to a hardcoded default for development)

### Key npm Packages

| Package | Purpose |
|---------|---------|
| `express` (v5) | HTTP server framework |
| `drizzle-orm` + `drizzle-kit` | SQLite ORM and schema management |
| `passport` + `passport-local` | Authentication |
| `express-session` + `memorystore` | Session management with in-memory store |
| `@tanstack/react-query` | Server state management on frontend |
| `wouter` | Client-side routing |
| `zod` + `drizzle-zod` | Schema validation and type derivation |
| `recharts` | Dashboard analytics charts |
| `react-hook-form` | Form state management |
| Radix UI / shadcn components | Full UI component library |
| `vite` | Frontend build tool and dev server |
| `esbuild` | Server bundling for production |

### No External API Integrations

The current codebase has no third-party API integrations (no payment processing, no email sending in active use, no external auth providers), though packages like `stripe`, `nodemailer`, and `openai` are listed in the build allowlist suggesting planned future integrations.