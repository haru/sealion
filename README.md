# Sealion

An integrated personal TODO management app that aggregates issues from multiple issue trackers (GitHub, Jira, Redmine) into a unified list. Future versions will use LLM (via LangChain) to summarize issues and auto-assign priorities.

## Features

- **Unified TODO list** — aggregates issues from GitHub, Jira, and Redmine into one view
- **Multi-provider support** — connect multiple instances of each provider (e.g., multiple Redmine servers)
- **Status sync** — closing/reopening a TODO updates the issue in the source system
- **Priority & due date sorting** — issues sorted by priority with overdue items surfaced first
- **Multi-user** — each user manages their own providers, projects, and TODO list
- **Admin panel** — administrators can manage users and their roles
- **i18n** — UI supports English (default) and Japanese

## Tech Stack

- **Framework**: Next.js 16 + TypeScript (App Router)
- **UI**: MUI (Material UI) v6 + Material Icons
- **Auth**: Auth.js v5 (NextAuth)
- **Database**: PostgreSQL via Prisma 7
- **Encryption**: AES-256-GCM for stored credentials
- **HTTP**: axios (adapter layer)
- **i18n**: next-intl v4
- **Testing**: Jest + Playwright

## Prerequisites

- Node.js 20+
- PostgreSQL database
- (Optional) Docker / VSCode Dev Container

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/sealion.git
cd sealion
npm install
```

### 2. Configure environment variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sealion

# Auth.js
AUTH_SECRET=<generate with: openssl rand -base64 32>

# Credentials encryption (must be 64 hex chars = 32 bytes)
CREDENTIALS_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

### 3. Run database migrations

```bash
npx prisma migrate deploy
```

### 4. (Optional) Seed an admin user

```bash
npx prisma db seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npx jest --coverage          # Run unit & integration tests
npx playwright test          # Run E2E tests
```

### Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── (auth)/             # Login/signup pages
│   ├── (dashboard)/        # Main app pages (TODO list, settings)
│   ├── admin/              # Admin-only pages
│   └── api/                # REST API route handlers
├── components/             # Reusable React components
│   ├── providers/          # Provider list & form components
│   ├── todo/               # TODO list & item components
│   └── ui/                 # Generic UI components
├── lib/                    # Shared utilities (auth, db, encryption)
├── messages/               # i18n strings (en.json, ja.json)
└── services/               # Business logic
    ├── issue-provider/     # GitHub, Jira, Redmine adapters
    └── sync.ts             # Issue sync service
```

### Domain Model

```
User
└── IssueProvider (GithubProvider | JiraProvider | RedmineProvider)
    └── Project (repo / Jira project / Redmine project)
        └── Issue (normalized TODO unit)
```

### Adding a New Issue Provider

1. Implement the `IssueProviderAdapter` interface in `src/lib/types.ts`
2. Add the adapter to `src/services/issue-provider/` (e.g., `gitlab.ts`)
3. Register it in `src/services/issue-provider/factory.ts`
4. Add the new `ProviderType` enum value to the Prisma schema
5. Add credential fields to `ProviderForm` component and i18n messages

## Testing

### Unit & Integration Tests

```bash
npx jest                    # Run all tests
npx jest --coverage         # With coverage report (target: 95% line)
npx jest tests/unit/        # Unit tests only
npx jest tests/integration/ # Integration tests (requires DATABASE_URL)
```

### E2E Tests

```bash
npx playwright install      # Install browsers (first time)
npx playwright test         # Run all E2E tests
npx playwright test --ui    # Interactive UI mode
```

E2E tests use environment variables for credentials:

```env
E2E_USER_EMAIL=user@example.com
E2E_USER_PASSWORD=password123
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=password123
```

## Security

- Credentials for external services are stored encrypted (AES-256-GCM) in the database
- API routes enforce session-based authorization — users can only access their own data
- Admin routes require `ADMIN` role
- Passwords are hashed with bcrypt

## Contributing

1. Fork the repository and create a feature branch
2. Follow TDD: write tests before implementation (RED → GREEN → REFACTOR)
3. Run `npm run lint` and `npx jest --coverage` before submitting
4. Open a pull request with a clear description of changes

## License

MIT
