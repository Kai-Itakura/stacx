# Project の削除は配下の STAR をカスケード削除する

STAR は生成時に 1 つの Project へ固定的に属し、別の Project へ移動することはない（コンポジション）。よって Project を削除したとき配下の STAR を他へ退避する概念が存在せず、`stars.project_id → projects` の外部キーを `ON DELETE CASCADE` とし、Project 削除時に STAR も一緒に消す。

当初は Memo が対象だったが、ADR 0009 で記録の単位が STAR に移ったため対象を改めた。判断の理由は変わらない。

## Considered Options

- **`CASCADE`（採用）**: STAR はプロジェクト横断の意味を持たないため、親が消えれば子も消えるのが自然。STAR の移動機能・孤児 STAR の処理が一切不要になり、モデルが最小になる。
- **`RESTRICT`（STAR を持つ Project の削除をブロックし 409）**: アプリ中核資産である STAR の巻き添え消失を DB レベルで防げる。ただし「削除前に STAR を移動する」概念を要求するが、本ドメインに Project 間の STAR 移動は存在しないため、ユーザーには「全 STAR を個別削除してからでないと Project を消せない」という不毛な摩擦だけが残る。
- **Project の論理削除（アーカイブ）**: STAR を残したまま Project を隠せるが、「進行中/終了」とは別の状態管理を Phase 1 に持ち込むのは過剰。

## Consequences

- アプリ中核資産が FK cascade 配下に入るため、Project 削除 API は破壊範囲（配下 STAR 件数）を呼び出し側に明示し、UI で明確な確認を取る前提とする。「うっかり削除」を防ぐ責務はアプリ層に移る。
- `deleteProject` は所有者の Project を削除でき、SQLite の cascade で stars / star_tags も連鎖削除される（`star_tags → stars` も CASCADE 前提）。
