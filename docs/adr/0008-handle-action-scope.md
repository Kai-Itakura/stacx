# `handleAction` は同一 action 内の intent 分岐にのみ使う

`app/lib/action-dispatcher.server.ts` の `handleAction` は、**1 つの action に責務の違う処理が
同居している場合**（例: 編集と削除が同じ画面から飛ぶ）の intent 分岐にだけ使う。
URL が分かれている resource route（`app/resources/create-memo.ts` など）を 1 つの intent 付き
action にまとめることはしない。責務が 1 つの action は `handleAction` を使わず素の
`parseWithZod` で書く。

## Considered Options

- **resource route も 1 つの intent 付き action に集約する**: ルートファイルが減り、
  ディスパッチの書き方が 1 通りになる。ただし戻り値の型は「その action が返しうるものすべて」の
  union になる。`useFetcher<typeof action>()` の型は「このフェッチャーが送った intent の結果」
  ではなくその union なので、消費側は実行時に起きない分岐を型のために書く羽目になる。
  試作時に消費側 3 箇所で計 6 件の TS2339 が出た。さらに `create-tag` の `{ ok, tagId }` と
  `create-memo` / `create-project` の `SubmissionResult` は戻り値の形から区別できず、
  `ActionResult = Response | SubmissionResult` に載せると「catch で `undefined` を返す」を
  型で禁止できていた網も緩む。
- **同一 action 内の分岐に限定する（採用）**: 責務が同居する画面（メモ編集 + 削除、
  プロジェクト編集 + 削除、タグのリネーム + 削除）だけが対象。戻り値の union は
  その画面が扱う分岐の和で閉じ、消費側は `useActionData` で受ける 1 画面に限られる。
  resource route は URL ごとに 1 責務・1 戻り値型のままなので `useFetcher<typeof action>()` が
  そのまま絞れる。

## Consequences

- resource route が増えても `handleAction` に寄せない。散らかるならディレクトリ整理で対処する。
- `memos.$id.star.tsx` の `mode` のように「schema の出し分け」であって責務の分岐でないものも対象外。
- `handleAction` を使う action は、戻り値が `Response | SubmissionResult` に収まることを
  型で強制される（ハンドラが `undefined` を返せない）。
