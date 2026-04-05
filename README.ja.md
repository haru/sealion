
[![CI](https://github.com/haru/sealion/actions/workflows/ci.yml/badge.svg)](https://github.com/haru/sealion/actions/workflows/ci.yml)
[![Maintainability](https://qlty.sh/badges/14808c46-bf1a-4aaa-b3cc-788ee066fd9c/maintainability.svg)](https://qlty.sh/gh/haru/projects/sealion)
[![codecov](https://codecov.io/gh/haru/sealion/graph/badge.svg?token=6bvf18kWxq)](https://codecov.io/gh/haru/sealion)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/haru/sealion)

# Sealion

<p align="center">
  <img src="public/sealion.svg" alt="Sealion" width="120" /><br/>
  <b>All Your TODOs, One Place.</b>
</p>


**Sealionは複数のIssue Tracker のIssueをひとつの TODO リストに集約するセルフホスト型Webアプリです。**

あなたにアサインされたすべてのIssueをひとつの統合ビューに集め、作業に集中できる環境を提供します。

![image](https://github.com/user-attachments/assets/557aae6d-8703-40fd-bda6-98ef5aa9fbb0)

## 対応するIssue Tracker

現在対応しているIssue Trackerは以下です。

- GitHub
- Jira
- Redmine
- GitLab

---

## 機能

| 機能 | 説明 |
|------|------|
| **統合 TODO リスト** | 各Issueトラッカーのイシューを自動取得して一か所に表示 |
| **今日のタスク** | Issueをドラッグ＆ドロップして今日のタスクに追加 |
| **重要タスクのピン留め** | タスクをリストの最上部に固定 |
| **タスクの完了** | 完了としてマークするとソーストラッカーのイシューもクローズ（コメント入力も可） |
| **複数接続** | 同じサービスの複数インスタンスに接続可能（例：会社の Redmine ＋ クライアントの Redmine） |
| **プロジェクト選択** | 同期するプロジェクト／リポジトリを選択 |
| **ボードのカスタマイズ** | 表示するフィールドやリストの並び順を設定 |
| **マルチユーザー** | 各ユーザーが自分の接続・プロジェクト・TODO リストを個別に管理 |
| **多言語対応** | 英語・日本語 UI |
| **認証情報の暗号化** | API トークンを AES-256-GCM で暗号化して保存 |

---

## 動作要件

docker compose を利用可能な環境

---

## インストール

### docker-compose.ymlを作成

適当なディレクトリ（例：`~/sealion`）を作成し、docker-compose.yml を以下の内容で保存します。

```yaml:docker-compose.yml
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
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
volumes:
  postgres_data:
```

### 2. 環境変数を設定

docker-compose.ymlと同じディレクトリに.env ファイルを作成し、必要な環境変数を設定します。

```dotenv:.env
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

次に、認証と暗号化用のキーを生成して.env に貼り付けます。

```bash
# AUTH_SECRET を生成
openssl rand -base64 32

# CREDENTIALS_ENCRYPTION_KEY を生成（64 文字の hex 文字列）
openssl rand -hex 32
```

生成した値を `.env` に貼り付けます。

```dotenv
AUTH_SECRET="<ここに貼り付け>"
CREDENTIALS_ENCRYPTION_KEY="<ここに貼り付け>"
```

### アプリを起動

```bash
docker compose up -d
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

> ポートを変更したい場合は `.env` で `HOST_PORT=8080` のように設定してください。

### 最初のユーザーを作成

初めてアクセスしたときに管理者ユーザーの作成を求められます。メールアドレスとパスワードを入力してアカウントを作成してください。

### アプリを停止

```bash
docker compose stop
```



## アップデート

```bash
docker compose pull
docker compose up -d
```

データベースのマイグレーションはコンテナ起動時に自動実行されます。

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) + TypeScript |
| UI | MUI (Material UI) v7 |
| 認証 | Auth.js v5 |
| データベース | PostgreSQL 16 + Prisma 7 |
| 多言語対応 | next-intl v4 |

---

## コントリビュート

git-flow を使用しています。プルリクエストは `develop` ブランチに対して行ってください。

---

## ライセンス

[MIT](LICENSE)
