
[![CI](https://github.com/haru/sealion/actions/workflows/ci.yml/badge.svg)](https://github.com/haru/sealion/actions/workflows/ci.yml)
[![Maintainability](https://qlty.sh/badges/14808c46-bf1a-4aaa-b3cc-788ee066fd9c/maintainability.svg)](https://qlty.sh/gh/haru/projects/sealion)
[![codecov](https://codecov.io/gh/haru/sealion/graph/badge.svg?token=6bvf18kWxq)](https://codecov.io/gh/haru/sealion)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/haru/sealion)

# Sealion

<p align="center">
  <img src="public/sealion.svg" alt="Sealion" width="120" /><br/>
  <b>All Your TODOs, One Place.</b>
</p>


**Sealion is a self-hosted web app that aggregates issues from multiple issue trackers into a single TODO list.**

It collects all issues assigned to you into one unified view so you can focus on getting things done.

[日本語](README.ja.md)

![image](https://github.com/user-attachments/assets/557aae6d-8703-40fd-bda6-98ef5aa9fbb0)

## Supported Issue Trackers

The following issue trackers are currently supported:

- GitHub
- GitLab
- Jira
- Redmine
- Linear
- Asana
- Trello
- Backlog

---

## Features

| Feature | Description |
|---------|-------------|
| **Unified TODO list** | Automatically fetches and displays issues from each tracker in one place |
| **Today's Tasks** | Drag and drop issues into your daily plan |
| **Pin important tasks** | Pin tasks to the top of your list |
| **Complete tasks** | Mark an issue as done and it closes in the source tracker too (with optional comment) |
| **Multiple connections** | Connect multiple instances of the same service (e.g. work Redmine + client Redmine) |
| **Project selection** | Choose which projects/repos to sync per connection |
| **Board customization** | Configure which fields to show and how to sort your list |
| **Multi-user** | Each user manages their own connections, projects, and TODO list |
| **Internationalization** | English and Japanese UI |
| **Encrypted credentials** | API tokens are stored encrypted with AES-256-GCM |

---

## Requirements

An environment where docker compose is available

---

## Installation

### Create docker-compose.yml

Create a directory of your choice (e.g. `~/sealion`) and save a `docker-compose.yml` with the following content:

```yaml
name: sealion

services:
  sealion:
    image: haru/sealion
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-password}@db:5432/${POSTGRES_DB:-sealion_dev}"
      AUTH_SECRET: "${AUTH_SECRET}"
      AUTH_URL: "${AUTH_URL:-http://localhost:3000}"
      CREDENTIALS_ENCRYPTION_KEY: "${CREDENTIALS_ENCRYPTION_KEY}"
      DB_HOST: db
      AUTH_TRUST_HOST: "true"
    ports:
      - "${HOST_PORT:-3000}:3000"
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}
      POSTGRES_DB: ${POSTGRES_DB:-sealion_dev}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
volumes:
  postgres_data:
```

### 2. Configure environment variables

Create a `.env` file in the same directory as `docker-compose.yml` and set the required environment variables:

```dotenv
# Auth.js (generate with: openssl rand -base64 32)
AUTH_SECRET=""

# Credential encryption key — exactly 32 bytes hex = 64 hex chars
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CREDENTIALS_ENCRYPTION_KEY=""

# Server URL
# Change to your public URL in production
AUTH_URL="http://localhost:3000"

# Optional: DB variables 
# DB_HOST=db
# DB_PORT=5432
# DB_USER=postgres
# POSTGRES_PASSWORD=password
# DB_MAX_RETRIES=30
# DB_RETRY_INTERVAL=2
```

Next, generate the keys for authentication and encryption and paste them into `.env`:

```bash
docker compose run --rm --no-deps sealion generate-keys
```

Example output:

```
Please add the following values to your .env file:

AUTH_SECRET="<base64-encoded value>"
CREDENTIALS_ENCRYPTION_KEY="<64-char hex value>"
```

Copy the two lines and paste them into `.env`.

#### Alternative (if openssl is available on the host)

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate CREDENTIALS_ENCRYPTION_KEY (64 hex characters)
openssl rand -hex 32
```

### Start the app

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> To use a different port, set `HOST_PORT=8080` in `.env`.

### Create your first user

When you access the app for the first time, you will be prompted to create an admin user. Enter your email address and password to create an account.

### Stop the app

```bash
docker compose stop
```



## Updating

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically on container startup.

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | MUI (Material UI) v7 |
| Auth | Auth.js v5 |
| Database | PostgreSQL 16 + Prisma 7 |
| i18n | next-intl v4 |

---

## Contributing

This project uses git-flow. Please submit pull requests against the `develop` branch.

---

## License

[MIT](LICENSE)
