#!/bin/bash
set -e

cd $(dirname "$0")/..

npm ci

if [ ! -f .env.local ]; then
    auth_secret=$(openssl rand -base64 32)
    credentials_encryption_key=$(openssl rand -hex 32)

    cat <<EOF > .env.local
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres

# Auth.js
AUTH_SECRET=${auth_secret}

# Credentials encryption (64 hex chars = 32 bytes)
CREDENTIALS_ENCRYPTION_KEY=${credentials_encryption_key}
EOF
fi

set -a
source .env.local
set +a

npx prisma migrate deploy
npx prisma generate

curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://claude.ai/install.sh | bash
curl -fsSL https://opencode.ai/install | bash
type -p curl >/dev/null || sudo apt install curl -y
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && sudo apt update \
    && sudo apt install gh -y
npm install -g @github/copilot
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
