#!/bin/sh
set -e

if [ "$1" = "generate-keys" ]; then
  echo "========================================================="
  printf 'Please add the following values to your .env file:\n\nAUTH_SECRET="%s"\nCREDENTIALS_ENCRYPTION_KEY="%s"\n' \
    "$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")" \
    "$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  exit 0
fi

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_MAX_RETRIES="${DB_MAX_RETRIES:-30}"
DB_RETRY_INTERVAL="${DB_RETRY_INTERVAL:-2}"

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."

retries=0
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ "${retries}" -ge "${DB_MAX_RETRIES}" ]; then
    echo "Error: PostgreSQL not ready after ${DB_MAX_RETRIES} retries. Exiting."
    exit 1
  fi
  echo "Waiting for database... (attempt ${retries}/${DB_MAX_RETRIES})"
  sleep "${DB_RETRY_INTERVAL}"
done

echo "PostgreSQL is ready. Running migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Starting application..."
exec "$@"
