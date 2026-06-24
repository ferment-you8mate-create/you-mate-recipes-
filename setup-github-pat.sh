#!/bin/zsh

set -euo pipefail

EXPECTED_REMOTE="https://github.com/ferment-you8mate-create/you-mate-recipes-.git"
SCRIPT_DIR="${0:A:h}"

cd "$SCRIPT_DIR"

if [[ "$(git remote get-url origin)" != "$EXPECTED_REMOTE" ]]; then
  print -u2 "エラー: originがyou-mate-recipes-ではありません。処理を中止します。"
  exit 1
fi

credential_helper="$(git --exec-path)/git-credential-osxkeychain"
if [[ ! -x "$credential_helper" ]]; then
  print -u2 "エラー: macOSキーチェーン用のGitヘルパーが見つかりません。"
  exit 1
fi

print "GitHubユーザー名を入力してください。"
read "github_user?ユーザー名 [ferment-you8mate-create]: "
github_user="${github_user:-ferment-you8mate-create}"

print "Fine-grained Personal Access Tokenを入力してください。"
print "入力内容は画面に表示されず、ファイルやGit履歴にも保存されません。"
read -s "github_token?PAT: "
print

if [[ -z "$github_token" ]]; then
  print -u2 "エラー: PATが空です。"
  exit 1
fi

git config --local credential.helper osxkeychain
git config --local credential.useHttpPath true

printf 'url=%s\nusername=%s\npassword=%s\n\n' \
  "$EXPECTED_REMOTE" "$github_user" "$github_token" | git credential approve

unset github_token

if ! git ls-remote origin HEAD >/dev/null 2>&1; then
  printf 'url=%s\nusername=%s\n\n' \
    "$EXPECTED_REMOTE" "$github_user" | git credential reject
  print -u2 "認証に失敗しました。PATの対象リポジトリとContents権限を確認してください。"
  exit 1
fi

print "PATをmacOSキーチェーンへ保存しました。"
print "今後は ./publish-recipes.sh で自動コミット・pushできます。"
