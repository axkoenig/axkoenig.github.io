#!/bin/sh
# Build site, run checks, then stage built HTML.
# Install: cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e
cd "$(git rev-parse --show-toplevel)"

# Use phd venv if present (has requests for check_links --check-external)
if [ -x "$HOME/venvs/phd/bin/python3" ]; then
  PYTHON="$HOME/venvs/phd/bin/python3"
else
  PYTHON=python3
fi

echo "Building..."
"$PYTHON" scripts/build.py

echo "Formatting HTML..."
if command -v npx >/dev/null 2>&1; then
  npx --yes prettier --write index.html art.html research.html about.html
else
  echo "  Skipping (npx not found; install Node to format HTML)."
fi

git add index.html art.html research.html about.html

echo "Checking case (asset path casing)..."
"$PYTHON" scripts/check_case.py

echo "Checking links (internal only; use scripts/check_links.py --check-external to audit external)..."
"$PYTHON" scripts/check_links.py

echo "Checking media sizes (images <= 2 MB, videos <= 10 MB)..."
"$PYTHON" scripts/check_media_size.py
