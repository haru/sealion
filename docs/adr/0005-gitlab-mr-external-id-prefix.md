# ADR 0005: GitLab MR `externalId` を `mr-` プレフィックス付きで保存する

## Context

仕様 043 (`specs/043-reviewer-assignee/`) で、レビュー担当者として指定された GitLab マージリクエスト (MR) を担当 issue 一覧に取り込む拡張を行う。これに伴い、GitLab adapter は従来の `/projects/:id/issues` に加えて `/projects/:id/merge_requests` を呼ぶようになる。

`Issue` テーブルには `@@unique([projectId, externalId])` のユニーク制約があり、各レコードは `externalId` で一意に識別される。

GitLab API の特性として:

- Issue の `id` (global ID) と MR の `id` (global ID) は **別々のシーケンスから採番される** ため、同一 project 内で同じ整数値が issue と MR の両方に割り当てられる可能性がある (例: issue `id=12345` と MR `id=12345` が共存しうる)。
- 既存実装では `externalId = String(issue.id)` として保存されている (例: `"12345"`)。MR にも同じ規約 (`String(mr.id)`) を適用すると、ユニーク制約違反、あるいは upsert が意図しないレコードを更新するという致命的なバグになる。
- 既存 GitLab issue データの `externalId` 値を変更すると、全レコードの再同期 / マイグレーションが必要になる。これは破壊的変更であり、現在運用中のユーザに影響する。

GitHub 側は本問題の影響を受けない。GitHub では issue と PR が同一の番号空間 (`/repos/:o/:r/issues/:n` で PR にもアクセス可能) を共有しており、衝突が原理的に発生しない。

## Decision

GitLab adapter において、MR を `Issue` テーブルに保存する際の `externalId` は **`mr-{globalId}`** 形式 (例: `"mr-12345"`) を用いる。GitLab issue の `externalId` は従来どおり `{globalId}` (例: `"12345"`) のまま変更しない。

この規約に伴い、GitLab adapter 内の以下のメソッドが externalId のプレフィックスを判別ロジックとして利用する:

- `closeIssue(projectExternalId, issueExternalId)`: `mr-` で始まる場合は MR endpoint (`PUT /projects/:id/merge_requests/:iid`) を、そうでなければ既存の issue endpoint (`PUT /projects/:id/issues/:iid`) を呼ぶ。
- `addComment(projectExternalId, issueExternalId, comment)`: 同様に MR notes endpoint と issue notes endpoint を分岐する。

プレフィックス規約の適用範囲は **GitLab adapter のみ** に限定する。他プロバイダ (GitHub / Jira / Redmine / Linear / Asana / Trello / Backlog) の `externalId` 形式には影響しない。

## Status

Accepted

## Consequences

### Positive

- GitLab issue と MR の global ID が衝突しても、`Issue` テーブルのユニーク制約は安全に維持される。
- 既存 GitLab issue データ (`externalId` が数値文字列のみ) は無変更のままで前方互換が保たれる。マイグレーションスクリプトや一括 re-sync は不要。
- 規約が文字列の頭 3 文字 (`mr-`) のみで判別可能なため、コード上の分岐ロジックは極めて単純 (`externalId.startsWith("mr-")`)。
- 将来 MR 専用の機能 (例: approval rule 連携、MR ステータス badge) を追加する際にも、`externalId` から MR と判定できる。

### Negative

- GitLab に関しては「externalId = プロバイダ側 ID の単純な文字列化」という不変条件が崩れる。adapter 外のコードで `externalId` を URL に直接埋め込む / プロバイダ API に投げる、といった用途では `mr-` プレフィックスの剥がし忘れがバグになる可能性がある。
  - 緩和: `externalId` のパース処理は **GitLab adapter 内に閉じる** (Constitution Principle III: Provider type encapsulation)。adapter 外から `externalId` をプロバイダ API に渡すコードは禁止 — adapter のメソッド (`closeIssue`, `addComment` 等) 経由でのみ操作する。
- GitHub と GitLab で `externalId` の形式規約が異なる (GitHub は常に数値文字列、GitLab は数値文字列 or `mr-` 付き)。adapter 横断で `externalId` の値ドメインを比較・正規化したい場合に注意が必要。
  - 緩和: adapter 横断で `externalId` を比較する必要があるユースケースは現状存在しない。各 issue は `(projectId, externalId)` で識別され、project が provider に紐付くため、provider をまたいだ比較は概念的にも発生しない。
- ドキュメント (`specs/043-reviewer-assignee/data-model.md`, adapter の TSDoc) で規約を明示的に説明する必要がある。

### Alternatives considered (採用しなかった案)

1. **`Issue` テーブルに `issueKind ENUM ('ISSUE', 'PR', 'MR')` カラムを追加し、`(projectId, externalId, issueKind)` を複合キーにする**: スキーマ migration + 全 adapter (Jira / Redmine 等を含む) の挙動修正が必要。Principle V (YAGNI) に反する。本機能で必要なのは「衝突回避」のみで、種別を ENUM で持つ必然性はない。
2. **GitHub にも一貫して `pr-` / `issue-` プレフィックスを付ける**: GitHub では衝突しないため必要性なし。既存データの破壊変更となり、URL 構築の全箇所改修が発生。コスト過大。
3. **`externalId` を変えず `web_url` で判別**: ユニーク制約違反の根本原因を解決しない。

## Date

2026-05-28
