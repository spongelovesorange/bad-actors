#!/bin/bash
# Run from Finder or Terminal on the owner's Mac.
set -eu
set -o pipefail
cd "$(dirname "$0")"
export PATH="$PWD/../.planb-tools/node_modules/.bin:$HOME/.local/node22/bin:/opt/homebrew/bin:$PATH"
unset DEEPSPACE_ENV DEEPSPACE_AUTH_URL DEEPSPACE_DEPLOY_URL DEEPSPACE_API_URL DEEPSPACE_PLATFORM_URL
unset CLOUDFLARE_ENV CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH
ds=./node_modules/.bin/deepspace
old_id=app_01M7VM2D370D56YGWDQ6MV38H9
origin=https://github.com/spongelovesorange/bad-actors.git
fail() { echo "$*" >&2; exit 1; }

# The only edit the owner may already have made is the public ID written by app init.
check_checkout() {
  [[ "$(git branch --show-current)" == main && "$(git remote get-url origin)" == "$origin" &&
     "$(git remote get-url --push origin)" == "$origin" ]] || fail '请从 Bad Actors 的 GitHub main 工作树发布。'
  [[ -z "$(git status --porcelain -- . ':!wrangler.toml')" ]] || fail '工作树还有其他改动。请先提交准备发布的源码。'
  node - "$old_id" <<'JS'
const fs = require('node:fs'), { execFileSync } = require('node:child_process')
const tracked = execFileSync('git', ['show', 'HEAD:wrangler.toml'], { encoding: 'utf8' })
const current = fs.readFileSync('wrangler.toml', 'utf8')
const idLine = /^DEEPSPACE_APP_ID = "(app_[0-9A-HJKMNP-TV-Z]{26}|__APP_ID__)"$/m
const id = current.match(idLine)?.[1]
const identityOnly = tracked.replace(/^DEEPSPACE_APP_ID = "__APP_ID__"$/m, 'DEEPSPACE_APP_ID = "' + id + '"')
if (!id || id === process.argv[2] || !/^name = "bad-actors-shi"$/m.test(current) ||
    (current !== tracked && current !== identityOnly)) {
  console.error('请检查 wrangler.toml。发布器只会提交 Bad Actors 的注册 ID。'); process.exit(1)
}
JS
}
check_checkout
[[ -x "$ds" ]] || npm ci
git push --dry-run origin HEAD:refs/heads/main
npm run validate
npm run build:practice

umask 077
mkdir -p .deepspace
receipt=$(mktemp -d "$PWD/.deepspace/publish.XXXXXX")
echo "发布回执保存在 $receipt"
init_app() { "$ds" app init --json > "$receipt/init.json"; }
if ! init_app; then
  if ! node -e 'process.exit(require(process.argv[1]).code === "app_quota_exceeded" ? 0 : 1)' "$receipt/init.json"; then
    cat "$receipt/init.json" >&2
    fail 'Bad Actors 注册失败。若提示未登录，请在终端运行 npx deepspace auth login 后重试。'
  fi
  cp "$receipt/init.json" "$receipt/quota.json"
  "$ds" app list --json > "$receipt/apps.json"
  node - "$receipt/apps.json" "$old_id" <<'JS'
const result = require(process.argv[2]), id = process.argv[3]
const target = result.apps?.find(row => row.appId === id)
if (!result.ok || target?.role !== 'owner' || target.name !== 'planb-meet-qs26' ||
    target.status !== 'active' || !target.deployedAt) {
  console.error('账号清单未确认 Plan B 为你拥有且已上线的应用。已停止。'); process.exit(1)
}
console.log('占用名额的旧应用：' + target.name + ' (' + id + ')')
JS
  [[ -t 0 ]] || fail '下线需要在你自己的终端中确认。'
  echo '下一条是 DeepSpace 的下线确认。确认后 Plan B 的旧网址停止服务，线上房间和回应会被清除。此操作没有备份房间数据。'
  "$ds" app undeploy "$old_id"
  init_app || { cat "$receipt/init.json" >&2; fail '名额释放后注册仍未成功，请查看上面的回执。'; }
fi

app_id=$(node -e 'const r=require(process.argv[1]); if(!r.ok || !/^app_[0-9A-HJKMNP-TV-Z]{26}$/.test(r.appId)) process.exit(1); console.log(r.appId)' "$receipt/init.json")
check_checkout
[[ "$app_id" != "$old_id" ]] && grep -Fqx "DEEPSPACE_APP_ID = \"$app_id\"" wrangler.toml || fail '返回的应用 ID 与 Bad Actors 配置不符。'
"$ds" app source --json > "$receipt/source.json"
node - "$receipt/source.json" "$app_id" <<'JS'
const r = require(process.argv[2]), s = r.source
if (!r.ok || r.appId !== process.argv[3] || !r.registered ||
    (s !== null && (s?.provider !== 'github' || s.repository !== 'spongelovesorange/bad-actors'))) {
  console.error('Bad Actors 的注册信息或源码来源与 GitHub 仓库不符。'); process.exit(1)
}
JS
npm run build
check_checkout
if ! git diff --quiet HEAD -- wrangler.toml; then
  git commit --only -m "Record the registered Bad Actors app ID" -- wrangler.toml
fi
git push origin HEAD:refs/heads/main
remote_head=$(git ls-remote --exit-code origin refs/heads/main)
[[ "${remote_head%%[[:space:]]*}" == "$(git rev-parse HEAD)" && -z "$(git status --porcelain)" ]] || fail 'GitHub 与本地发布版本还未对齐。'

publish() { "$ds" deploy --json > "$receipt/deploy.json"; }
if ! publish; then
  if ! node -e 'process.exit(require(process.argv[1]).code === "secrets_config_missing" ? 0 : 1)' "$receipt/deploy.json"; then
    cat "$receipt/deploy.json" >&2; fail 'DeepSpace 部署失败。'
  fi
  cp "$receipt/deploy.json" "$receipt/config-missing.json"
  "$ds" app list --json > "$receipt/apps-before-config.json"
  node - "$receipt/apps-before-config.json" "$app_id" <<'JS'
const r = require(process.argv[2]), row = r.apps?.find(a => a.appId === process.argv[3])
if (!r.ok || row?.role !== 'owner' || row.status !== 'active' || row.deployedAt !== null ||
    (row.name != null && row.name !== 'bad-actors-shi')) {
  console.error('平台缺少 prd 配置，但无法确认本应用从未发布。请核对线上配置；如确需空配置，CLI 命令为 npx deepspace secrets configs create prd。')
  process.exit(1)
}
JS
  echo 'DeepSpace 要求首次发布先创建 prd 配置。正在创建空配置。'
  "$ds" secrets configs create prd --app "$app_id" --json > "$receipt/config-created.json"
  publish || { cat "$receipt/deploy.json" >&2; fail 'DeepSpace 部署失败。'; }
fi
url=$(node -e 'const r=require(process.argv[1]); if(!r.ok || r.appId!==process.argv[2] || !r.url) process.exit(1); const u=new URL(r.url); if(u.origin!=="https://bad-actors-shi.app.space") process.exit(1); console.log(u.href)' "$receipt/deploy.json" "$app_id")
echo "DeepSpace 返回的 Bad Actors 网址：$url"
curl --fail --silent --show-error --max-time 20 --retry 3 "$url" -o "$receipt/home.html"
grep -Fq 'data-testid="static-landing"' "$receipt/home.html" || fail '已收到部署回执，公开首页内容仍待核验。'
echo '公开游戏首页已能访问。打开上面的网址即可试玩。'
