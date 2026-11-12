# Shared by pre-commit and pre-push. Sets $top, $GITLEAKS, $CONFIG and
# $TEMPLATE, and defines run_gitleaks. Anything missing exits non-zero, so the
# commit or push is blocked rather than going through unscanned.

top=$(git rev-parse --show-toplevel)
CONFIG="$top/.gitleaks.toml"
TEMPLATE="$top/.githooks/report.tmpl"

if [ -x "$top/.githooks/bin/gitleaks" ]; then
  GITLEAKS="$top/.githooks/bin/gitleaks"
elif command -v gitleaks >/dev/null 2>&1; then
  GITLEAKS=gitleaks
else
  echo "gitleaks not found, so this was blocked rather than left unchecked." >&2
  echo "Install it with:  sh .githooks/install.sh" >&2
  exit 1
fi

for f in "$CONFIG" "$TEMPLATE"; do
  if [ ! -f "$f" ]; then
    echo "Missing $f, so this was blocked rather than left unchecked." >&2
    exit 1
  fi
done

# run_gitleaks <gitleaks args...>
# Runs a scan and returns 0 if clean, 2 if it found secrets, or 1 if gitleaks
# itself failed. Findings are printed as file, line, rule and commit only; the
# report template never includes the matched text, so secrets stay off screen.
# Set STRIP to a path prefix to remove from reported file names.
run_gitleaks() {
  report=$(mktemp)
  log=$(mktemp)
  rc=0
  "$GITLEAKS" "$@" --config "$CONFIG" --redact --no-banner --exit-code 2 \
    --report-format template --report-template "$TEMPLATE" \
    --report-path "$report" >"$log" 2>&1 || rc=$?
  case "$rc" in
    0) ;;
    2)
      echo "gitleaks found possible secrets (values hidden):" >&2
      sed "s|${STRIP:-^}||" "$report" >&2
      ;;
    *)
      echo "gitleaks failed to run (exit $rc), so this was blocked rather than left unchecked:" >&2
      # gitleaks' own log; with --redact it doesn't contain secret values.
      sed 's/^/  /' "$log" >&2
      rc=1
      ;;
  esac
  rm -f "$report" "$log"
  return "$rc"
}
