#!/bin/zsh

set -euo pipefail

EXPECTED_REMOTE="https://github.com/ferment-you8mate-create/you-mate-recipes-.git"
PUBLIC_URL="https://ferment-you8mate-create.github.io/you-mate-recipes-/"
SCRIPT_DIR="${0:A:h}"
COMMIT_MESSAGE="${1:-Update student recipes $(date '+%Y-%m-%d %H:%M')}"

cd "$SCRIPT_DIR"

if [[ "$(git remote get-url origin)" != "$EXPECTED_REMOTE" ]]; then
  print -u2 "エラー: originがyou-mate-recipes-ではありません。処理を中止します。"
  exit 1
fi

if [[ "$(git branch --show-current)" != "main" ]]; then
  print -u2 "エラー: mainブランチではありません。処理を中止します。"
  exit 1
fi

git add -- recipes.js index.html

if ! git diff --quiet; then
  print -u2 "エラー: recipes.js / index.html以外にも未コミット変更があります。"
  print -u2 "内容を確認してから再実行してください。"
  exit 1
fi

staged_files=("${(@f)$(git diff --cached --name-only)}")
for file in "${staged_files[@]}"; do
  if [[ -n "$file" && "$file" != "recipes.js" && "$file" != "index.html" ]]; then
    print -u2 "エラー: 公開対象外のファイルがステージされています: $file"
    exit 1
  fi
done

if ! git diff --cached --quiet; then
  git commit -m "$COMMIT_MESSAGE"
else
  print "新しいレシピ変更はありません。未pushコミットの確認へ進みます。"
fi

git pull --rebase origin main
git push origin main

print "公開用mainブランチへpushしました。"
print "$PUBLIC_URL"
