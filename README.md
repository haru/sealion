
[![CI](https://github.com/haru/sealion/actions/workflows/ci.yml/badge.svg)](https://github.com/haru/sealion/actions/workflows/ci.yml)
[![Maintainability](https://qlty.sh/badges/14808c46-bf1a-4aaa-b3cc-788ee066fd9c/maintainability.svg)](https://qlty.sh/gh/haru/projects/sealion)
[![codecov](https://codecov.io/gh/haru/sealion/graph/badge.svg?token=6bvf18kWxq)](https://codecov.io/gh/haru/sealion)

<p align="center">
  <img src="public/sealion.svg" alt="Sealion" width="120" />
</p>


# Sealion

**A self-hosted app that brings GitHub, Jira, and Redmine issues into a single TODO list.**

Stop switching between issue trackers. Sealion aggregates all your assigned issues into one unified view so you can focus on getting things done. Deploy with Docker Compose in minutes.

<!-- TODO: Add screenshot
![Dashboard screenshot](docs/images/screenshot.png)
-->

---

## Features

| Feature | Description |
|---------|-------------|
| **Unified TODO list** | Automatically fetches and displays issues from GitHub, Jira, and Redmine in one place |
| **Today's Tasks** | Drag and drop issues into your daily plan |
| **Pin important tasks** | Pin tasks to the top of your list |
| **Complete tasks** | Mark an issue as done and it closes in the source tracker too (with optional comment) |
| **Multiple connections** | Connect multiple instances of the same service (e.g. work Redmine + client Redmine) |
| **Project selection** | Choose which projects/repos to sync per connection |
| **Board customization** | Configure which fields to show and how to sort your list |
| **Multi-user** | Each user manages their own connections, projects, and TODO list |
| **Admin panel** | Create users, enable/disable accounts, assign roles |
| **Internationalization** | English and Japanese UI |
| **Encrypted credentials** | API tokens are stored encrypted with AES-256-GCM |
| **Proxy support** | Access external APIs through HTTP/HTTPS proxies |

---

## Requirements

- **Docker Desktop** (or Docker Engine + Docker Compose plugin)

> You do not need Node.js or PostgreSQL installed — everything runs inside Docker containers.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/haru/sealion.git
cd sealion
```

### 2. Configure environment variables

```bash
cp docker/.env.example docker/.env
```

Open `docker/.env` and generate the two required secrets:

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate CREDENTIALS_ENCRYPTION_KEY (64 hex characters)
openssl rand -hex 32
```

Paste the generated values into `docker/.env`:

```dotenv
AUTH_SECRET="<paste value here>"
CREDENTIALS_ENCRYPTION_KEY="<paste value here>"
```

> The other settings (`POSTGRES_USER`, etc.) work fine with their defaults.

### 3. Start the app

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> To use a different port, set `HOST_PORT=8080` in `docker/.env`.

### 4. Create your first user

Go to the signup page (`/signup`) and create an account.

To seed an admin user from the command line instead:

```bash
docker compose -f docker/docker-compose.yml exec app npx prisma db seed
```

### 5. Stop the app

```bash
docker compose -f docker/docker-compose.yml down
```

Data is persisted in a Docker volume (`postgres_data`). To remove everything including data:

```bash
docker compose -f docker/docker-compose.yml down -v
```

---

## Usage

### Connect an issue tracker

1. After logging in, open **Settings** → **Issue Tracker Settings** from the sidebar
2. Click **Add Issue Tracker** and choose GitHub, Jira, or Redmine
3. Enter the server URL and API token (or email + API key for Jira)
4. Click **Test Connection** to verify, then save

### Select projects to sync

1. Open **Project Management** from the sidebar
2. Pick a connection and check the projects/repos you want to sync
3. Click **Sync Now** to fetch issues

### Work with your TODO list

- **Pin**: Keep important tasks at the top
- **Today's Tasks**: Drag and drop tasks into your daily list and reorder them
- **Complete**: Mark a task as done — the source issue is closed too (you can add a comment)
- **External link**: Jump to the original issue page with one click

### Customize board settings

1. Open **Board Settings** from the sidebar
2. Toggle display fields (created date, updated date, etc.)
3. Drag and drop to change the sort order

---

## Updating

```bash
cd sealion
git pull
docker compose -f docker/docker-compose.yml up --build -d
```

Database migrations run automatically on container startup.

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `POSTGRES_USER` | | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | | PostgreSQL password | `password` |
| `POSTGRES_DB` | | Database name | `sealion_dev` |
| `AUTH_SECRET` | ✅ | Session encryption key | — |
| `CREDENTIALS_ENCRYPTION_KEY` | ✅ | Credential encryption key (64 hex chars) | — |
| `HOST_PORT` | | Host-side port mapping | `3000` |

---

## Security

- External service credentials are encrypted at rest with **AES-256-GCM**
- Passwords are hashed with **bcrypt**
- API-level authorization ensures users can only access their own data
- Admin routes are protected by both middleware and route handler checks

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | MUI (Material UI) v7 |
| Auth | Auth.js v5 |
| Database | PostgreSQL 16 + Prisma 7 |
| i18n | next-intl v4 |
| Testing | Jest + Playwright |

---

## Contributing

1. Fork the repository and create a feature branch
2. Follow TDD: write tests first (RED → GREEN → REFACTOR)
3. Make sure `npm run lint` and `npm test` pass
4. Open a pull request with a clear description of your changes

---

## License

[MIT](LICENSE)
