#!/bin/zsh
# Double-click in Finder to open the solo game on this Mac.
set -eu
cd "${0:A:h}"
if [[ -x "$HOME/.local/node22/bin/node" ]]; then
  export PATH="$HOME/.local/node22/bin:$PATH"
fi
if [[ -x ../.planb-tools/node_modules/.bin/npm ]]; then
  export PATH="$PWD/../.planb-tools/node_modules/.bin:$PATH"
fi
if [[ ! -x node_modules/.bin/vite ]]; then
  print -u2 'Install this project’s dependencies with npm ci, then open this launcher again.'
  exit 1
fi

first_free=''
for port in 5173 5174 5175; do
  address="http://127.0.0.1:$port"
  if /usr/sbin/lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    status_json=$(/usr/bin/curl --noproxy '*' --fail --silent --max-time 2 "$address/api/local-ai/status" || true)
    if print -r -- "$status_json" | node -e 'try { const s = JSON.parse(require("node:fs").readFileSync(0,"utf8")); process.exit(s.available === true && typeof s.model === "string" ? 0 : 1) } catch { process.exit(1) }'; then
      /usr/bin/open "$address/?cue=1"
      exit 0
    fi
  elif [[ -z "$first_free" ]]; then
    first_free="$port"
  fi
done
if [[ -z "$first_free" ]]; then
  print -u2 'Ports 5173–5175 are occupied. Run npm run practice:ai with a free loopback port.'
  exit 1
fi
print 'Keep this terminal window open while you play. Press Control-C to close the rehearsal.'
exec npm run practice:ai -- --port "$first_free" --open '/?cue=1'
