
[![CI](https://github.com/haru/sealion/actions/workflows/ci.yml/badge.svg)](https://github.com/haru/sealion/actions/workflows/ci.yml)
[![Maintainability](https://qlty.sh/badges/14808c46-bf1a-4aaa-b3cc-788ee066fd9c/maintainability.svg)](https://qlty.sh/gh/haru/projects/sealion)
[![codecov](https://codecov.io/gh/haru/sealion/graph/badge.svg?token=6bvf18kWxq)](https://codecov.io/gh/haru/sealion)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/haru/sealion)

<p align="center">
  <img src="public/sealion.svg" alt="Sealion" width="120" />
</p>


# Sealion

**All Your TODOs, One Place.**

**Sealionは複数のIssue Tracker のIssueをひとつの TODO リストに集約するセルフホスト型アプリです。**

あなたにアサインされたすべてのIssueをひとつの統合ビューに集め、作業に集中できる環境を提供します。

<!-- TODO: スクリーンショットを追加
![ダッシュボードのスクリーンショット](docs/images/screenshot.png)
-->

---

## 機能

| 機能 | 説明 |
|------|------|
| **統合 TODO リスト** | GitHub・Jira・Redmine のイシューを自動取得して一か所に表示 |
| **今日のタスク** | イシューをドラッグ＆ドロップして日次計画に追加 |
| **重要タスクのピン留め** | タスクをリストの最上部に固定 |
| **タスクの完了** | 完了としてマークするとソーストラッカーのイシューもクローズ（コメント入力も可） |
| **複数接続** | 同じサービスの複数インスタンスに接続可能（例：会社の Redmine ＋ クライアントの Redmine） |
| **プロジェクト選択** | 接続ごとに同期するプロジェクト／リポジトリを選択 |
| **ボードのカスタマイズ** | 表示するフィールドやリストの並び順を設定 |
| **マルチユーザー** | 各ユーザーが自分の接続・プロジェクト・TODO リストを個別に管理 |
| **管理パネル** | ユーザーの作成・有効化／無効化・ロール割り当て |
| **多言語対応** | 英語・日本語 UI |
| **認証情報の暗号化** | API トークンを AES-256-GCM で暗号化して保存 |
| **プロキシ対応** | HTTP/HTTPS プロキシ経由で外部 API にアクセス |

---

## 動作要件

- **Docker Desktop**（または Docker Engine + Docker Compose プラグイン）

> Node.js や PostgreSQL をインストールする必要はありません。すべて Docker コンテナ内で動作します。

---

## インストール

### 1. リポジトリをクローン

```bash
git clone https://github.com/haru/sealion.git
cd sealion
```

### 2. 環境変数を設定

```bash
cp docker/.env.example docker/.env
```

`docker/.env` を開き、必要な 2 つのシークレットを生成します。

```bash
# AUTH_SECRET を生成
openssl rand -base64 32

# CREDENTIALS_ENCRYPTION_KEY を生成（64 文字の hex 文字列）
openssl rand -hex 32
```

生成した値を `docker/.env` に貼り付けます。

```dotenv
AUTH_SECRET="<ここに貼り付け>"
AUTH_URL="http://localhost:3000"
CREDENTIALS_ENCRYPTION_KEY="<ここに貼り付け>"
```

> サーバーにデプロイする場合は、`AUTH_URL` をアプリの公開 URL（例：`https://todo.example.com`）に変更してください。
> その他の設定（`POSTGRES_USER` など）はデフォルト値のままで問題ありません。

### 3. アプリを起動

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

> ポートを変更したい場合は `docker/.env` で `HOST_PORT=8080` のように設定してください。

### 4. 最初のユーザーを作成

サインアップページ（`/signup`）にアクセスしてアカウントを作成してください。

コマンドラインから管理者ユーザーをシードすることも可能です。

```bash
docker compose -f docker/docker-compose.yml exec app npx prisma db seed
```

### 5. アプリを停止

```bash
docker compose -f docker/docker-compose.yml down
```

データは Docker ボリューム（`postgres_data`）に保持されます。データを含めてすべて削除するには：

```bash
docker compose -f docker/docker-compose.yml down -v
```

---

## 使い方

### イシュートラッカーを接続する

1. ログイン後、サイドバーから **設定** → **イシュートラッカー設定** を開く
2. **イシュートラッカーを追加** をクリックし、GitHub・Jira・Redmine のいずれかを選択
3. サーバー URL と API トークン（Jira の場合はメールアドレス＋ API キー）を入力
4. **接続テスト** で動作確認後、保存

### 同期するプロジェクトを選択する

1. サイドバーから **プロジェクト管理** を開く
2. 接続を選択し、同期したいプロジェクト／リポジトリにチェックを入れる
3. **今すぐ同期** をクリックしてイシューを取得

### TODO リストを操作する

- **ピン留め**: 重要なタスクを最上部に固定
- **今日のタスク**: タスクをドラッグ＆ドロップで日次リストに追加し、並び替え
- **完了**: タスクを完了としてマーク — ソースイシューもクローズされます（コメント入力も可）
- **外部リンク**: ワンクリックで元のイシューページへジャンプ

### ボード設定をカスタマイズする

1. サイドバーから **ボード設定** を開く
2. 表示フィールド（作成日・更新日など）のオン/オフを切り替え
3. ドラッグ＆ドロップで並び順を変更

---

## アップデート

```bash
cd sealion
git pull
docker compose -f docker/docker-compose.yml up --build -d
```

データベースのマイグレーションはコンテナ起動時に自動実行されます。

---

## 環境変数

| 変数名 | 必須 | 説明 | デフォルト |
|--------|------|------|-----------|
| `POSTGRES_USER` | | PostgreSQL ユーザー名 | `postgres` |
| `POSTGRES_PASSWORD` | | PostgreSQL パスワード | `password` |
| `POSTGRES_DB` | | データベース名 | `sealion_dev` |
| `AUTH_SECRET` | ✅ | セッション暗号化キー | — |
| `AUTH_URL` | ✅ | Auth.js のリダイレクト解決に使用するアプリの公開 URL | `http://localhost:3000` |
| `CREDENTIALS_ENCRYPTION_KEY` | ✅ | 認証情報暗号化キー（64 文字の hex 文字列） | — |
| `HOST_PORT` | | ホスト側のポートマッピング | `3000` |

---

## セキュリティ

- 外部サービスの認証情報は **AES-256-GCM** で保存時に暗号化
- パスワードは **bcrypt** でハッシュ化
- API レベルの認可により、ユーザーは自分のデータにのみアクセス可能
- 管理者ルートはミドルウェアとルートハンドラーの両方で保護

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) + TypeScript |
| UI | MUI (Material UI) v7 |
| 認証 | Auth.js v5 |
| データベース | PostgreSQL 16 + Prisma 7 |
| 多言語対応 | next-intl v4 |
| テスト | Jest + Playwright |

---

## コントリビュート

1. リポジトリをフォークし、フィーチャーブランチを作成
2. TDD に従ってください：先にテストを書く（RED → GREEN → REFACTOR）
3. `npm run lint` と `npm test` が通ることを確認
4. 変更内容を明確に説明したプルリクエストを開く

---

## ライセンス

[MIT](LICENSE)
