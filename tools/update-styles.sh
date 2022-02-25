#!/bin/sh
set -e

# Terminate with an error message
# shellcheck disable=SC2059
die()(printf >&2 "$1\n"; exit 2)

# Switch to script's directory and run some sanity checks
set -- "${0%/*}" extract-themes.mjs
cd "$1"      || die "Failed to switch directory to $1"
test -f "$2" || die "Expected file '$2' to exist in $1"

# Ensure that runtime dependencies are installed
for cmd in curl geckodriver jq node; do
	command -v "$cmd" >/dev/null 2>&1 || die "Required command '$cmd' not found"
done


host='127.0.0.1'
port='4444'

geckodriver --port="$port" --host="$host" &

# Initialise a new browsing session
session_id=`curl -qsSH "Content-Type: application/json" -d'{
	"capabilities": {
		"alwaysMatch": {
			"acceptInsecureCerts": true
		}
	}
}' "http://$host:$port/session" | jq -r .value.sessionId`

# Navigate to the scope-previews list on GitHub
curl -qsSH "Content-Type: application/json" \
	-d'{"url": "https://git.io/Jf1IY"}' \
	"http://$host:$port/session/$session_id/url" \
	>/dev/null

echo Asserting URL...
curl -qsS "http://$host:$port/session/$session_id/url" \
| grep 'scope-previews\.nanorc'

# Execute `extract-themes.mjs` in the browser window's context
curl -qsSH "Content-Type: application/json" -d "`node ./$2`" \
	"http://$host:$port/session/$session_id/execute/async" \
	| jq -r .value > ../styles/syntax.less

# Disconnect
curl -qsSX DELETE "http://$host:$port/session/$session_id" >/dev/null
kill $!
