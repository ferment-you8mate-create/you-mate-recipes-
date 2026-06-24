# 発酵ごはん レシピ帳

静的HTMLのレシピサイトです。

## レシピを追加する場所

`recipes.js` の `window.RECIPES = [...]` に、以下の形式で1件追加します。

```js
{
  name: "提出者名",
  title: "料理名",
  ferment: "使用する麹調味料や発酵",
  category: "main",
  labels: ["主菜", "肉", "野菜", "塩麹"],
  materials: "材料",
  steps: "作り方",
  point: "工夫したポイントや意図",
  consent: "問題ありません",
  imageId: "Google Driveの画像ファイルID"
}
```

`category` は `main`, `side`, `sweets`, `drink` のいずれかを使います。

`labels` には、検索・絞り込みに使いたい言葉を入れます。例: `肉`, `魚`, `野菜`, `前菜`, `スープ`, `サラダ`, `デザート`, `飲み物`, `醤油麹`, `塩麹`。

Google Drive画像は、画像ファイルまたは格納フォルダを「リンクを知っている全員が閲覧可」にしてください。

## GitHub Pagesへ自動公開

初回だけ、GitHubのFine-grained Personal Access TokenをmacOSキーチェーンへ登録します。

```bash
./setup-github-pat.sh
```

PATは対象リポジトリを `you-mate-recipes-` のみに限定し、Repository permissionsの `Contents` を `Read and write` にします。PATは画面に表示されず、ファイルやGit履歴には保存されません。

レシピ追加後は次のコマンドで公開します。

```bash
./publish-recipes.sh
```

このスクリプトは `recipes.js` と `index.html` だけを対象に、キャッシュ番号更新、コミット、リモートの最新化、`main` ブランチへのpushを行います。別のリポジトリやブランチでは停止します。
