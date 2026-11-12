#!/bin/sh
# Turns on the hooks in .githooks/ for this clone and downloads gitleaks into
# .githooks/bin/ (gitignored) if it isn't already on PATH. Safe to rerun.
#   sh .githooks/install.sh
set -eu

VERSION=8.30.1
top=$(git rev-parse --show-toplevel)
cd "$top"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/pre-push
echo "Hooks enabled (core.hooksPath=.githooks)."

if command -v gitleaks >/dev/null 2>&1 || [ -x .githooks/bin/gitleaks ]; then
  echo "gitleaks already available."
  exit 0
fi

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) echo "Unsupported OS $(uname -s); install gitleaks $VERSION yourself." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) echo "Unsupported CPU $(uname -m); install gitleaks $VERSION yourself." >&2; exit 1 ;;
esac

tarball="gitleaks_${VERSION}_${os}_${arch}.tar.gz"
base="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $tarball ..."
curl -fsSL -o "$tmp/$tarball" "$base/$tarball"
curl -fsSL -o "$tmp/checksums.txt" "$base/gitleaks_${VERSION}_checksums.txt"

expected=$(grep " $tarball\$" "$tmp/checksums.txt" | cut -d' ' -f1)
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$tmp/$tarball" | cut -d' ' -f1)
else
  actual=$(shasum -a 256 "$tmp/$tarball" | cut -d' ' -f1)
fi
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "Checksum mismatch for $tarball; not installing." >&2
  exit 1
fi

mkdir -p .githooks/bin
tar -xzf "$tmp/$tarball" -C "$tmp" gitleaks
mv "$tmp/gitleaks" .githooks/bin/gitleaks
chmod +x .githooks/bin/gitleaks
echo "Installed $(.githooks/bin/gitleaks version) to .githooks/bin/gitleaks."
