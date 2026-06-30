# Googleフォーム → レシピ帳 自動連携

対象スプレッドシート:

`みんなのレシピ集（回答）` / `フォームの回答 1`

## 初回設定

1. 回答スプレッドシートを開き、`拡張機能` → `Apps Script` を開く。
2. `Code-for-copy.txt` を開き、その内容をApps Scriptの `Code.gs` へ貼り付ける。
3. Apps Scriptのプロジェクト設定で、`appsscript.json` の表示を有効にする。
4. `appsscript.json` を、このフォルダの同名ファイルの内容で置き換える。
5. プロジェクト設定の `スクリプト プロパティ` に次を登録する。

| プロパティ | 値 |
| --- | --- |
| `GITHUB_TOKEN` | `you-mate-recipes-` のContents書き込み権限を持つFine-grained PAT |
| `AUTO_PUBLISH` | `true` |

6. Apps Scriptエディタで `installAutomation` を選んで実行し、権限を許可する。
7. 次回のフォーム投稿後、`公開ステータス` が `公開済み` になることを確認する。

## 動作

- Googleフォーム送信時に回答行を読み取る。
- 料理の種類、材料、作り方からカテゴリと検索ラベルを自動生成する。
- Google Drive画像を「リンクを知っている全員が閲覧可」に変更する。
- 投稿ごとのIDで重複を防ぐ。
- GitHub APIで `recipes.js` に追記する。
- GitHub Pagesの更新後、サイトへ自動反映される。
- 回答シートの `公開ステータス` 列に結果を記録する。

## 承認制へ切り替える

Apps Scriptエディタで `enableApprovalMode` を1回実行する。

以後は新規投稿が `承認待ち` になり、シートの `公開ステータス` を `承認` に変更した時だけ公開される。

自動公開へ戻す場合は `enableAutoPublish` を実行する。

## 手動で再実行

- 選択中の行を公開: `publishActiveRow`
- 最終行を公開: `publishLatestRow`
- トリガーを再作成: `installAutomation`

過去に手動掲載済みの行は、投稿者名と料理名が一致する場合は重複登録されません。
