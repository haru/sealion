[![CI](https://github.com/haru/sealion/actions/workflows/ci.yml/badge.svg)](https://github.com/haru/sealion/actions/workflows/ci.yml)
[![Maintainability](https://qlty.sh/badges/14808c46-bf1a-4aaa-b3cc-788ee066fd9c/maintainability.svg)](https://qlty.sh/gh/haru/projects/sealion)

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
- **UI**: MUI (Material UI) v7 + Material Icons
- **Auth**: Auth.js v5 (NextAuth)
- **Database**: PostgreSQL 16 via Prisma 7
- **Encryption**: AES-256-GCM for stored credentials
- **i18n**: next-intl v4
- **Testing**: Jest + Playwright

---

## Quick Start — Docker Compose

The fastest way to run the app with no local setup required.

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose plugin)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/sealion.git
cd sealion

cp docker/.env.example docker/.env
```

Generate the required secrets in your shell:

```bash
openssl rand -base64 32
# → paste this output as AUTH_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → paste this output as CREDENTIALS_ENCRYPTION_KEY
```

Then edit `docker/.env` with the generated values:

```dotenv
DATABASE_URL="postgresql://postgres:password@db:5432/sealion_dev"
AUTH_SECRET="<paste openssl output here>"
CREDENTIALS_ENCRYPTION_KEY="<paste node output here>"
NEXTAUTH_URL="http://localhost:3000"
```

### 2. Build and start

```bash
docker compose -f docker/docker-compose.yml up --build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Stop

```bash
docker compose -f docker/docker-compose.yml down
```

> **Note**: `docker/.env` is for Docker only. The workspace root `.env` is used for local development without Docker — the two files are independent.

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- (Recommended) VSCode with Dev Containers extension

### 1. Clone and install

```bash
git clone https://github.com/your-org/sealion.git
cd sealion
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate the required secrets in your shell:

```bash
openssl rand -base64 32
# → paste this output as AUTH_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → paste this output as CREDENTIALS_ENCRYPTION_KEY
```

Then edit `.env` with the generated values:

```dotenv
DATABASE_URL="postgresql://postgres:password@localhost:5432/sealion_dev"
AUTH_SECRET="<paste openssl output here>"
CREDENTIALS_ENCRYPTION_KEY="<paste node output here>"
NEXTAUTH_URL="http://localhost:3000"
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

---

## Development Commands

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm test         # Run unit & integration tests
npm test -- --coverage          # With coverage report (target: 95% line)
npm test -- --testPathPattern=<path>  # Single test file
npx playwright test             # Run E2E tests (requires dev server running)
```

---

## Project Structure

```
docker/
├── Dockerfile          # Production image
├── docker-compose.yml  # Local full-stack orchestration
├── entrypoint.sh       # DB wait + migrate + app start
└── .env.example        # Docker env template

src/
├── app/                # Next.js App Router pages & API routes
│   ├── (auth)/         # Login/signup pages
│   ├── (dashboard)/    # Main app pages (TODO list, settings)
│   ├── admin/          # Admin-only pages
│   └── api/            # REST API route handlers
├── components/         # Reusable React components
├── lib/                # Shared utilities (auth, db, encryption)
├── messages/           # i18n strings (en.json, ja.json)
└── services/           # Business logic
    ├── issue-provider/ # GitHub, Jira, Redmine adapters
    └── sync.ts         # Issue sync service
```

### Domain Model

```
User
└── IssueProvider (GitHub | Jira | Redmine)
    └── Project
        └── Issue (normalized TODO unit)
```

---

## Testing

### Unit & Integration Tests

```bash
npm test                              # Run all tests
npm test -- --coverage                # With coverage report
npm test -- --testPathPattern=unit    # Unit tests only
npm test -- --testPathPattern=integration  # Integration tests (requires DATABASE_URL)
```

### E2E Tests

```bash
npx playwright install      # Install browsers (first time)
npx playwright test         # Run all E2E tests
npx playwright test --ui    # Interactive UI mode
```

---

## CI/CD

Pushing a Git tag triggers GitHub Actions to build and publish multi-architecture images (amd64 + arm64) to DockerHub:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Required repository secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD` (DockerHub access token).

See [`docker/docker-compose.yml`](docker/docker-compose.yml) and [`.github/workflows/container.yml`](.github/workflows/container.yml) for details.

---

## Security

- Credentials for external services are stored encrypted (AES-256-GCM) in the database
- API routes enforce session-based authorization — users can only access their own data
- Admin routes require `ADMIN` role, enforced in middleware and route handlers
- Passwords hashed with bcrypt

---

## Contributing

1. Fork the repository and create a feature branch
2. Follow TDD: write tests before implementation (RED → GREEN → REFACTOR)
3. Run `npm run lint` and `npm test` before submitting
4. Open a pull request with a clear description of changes

## License

MIT
