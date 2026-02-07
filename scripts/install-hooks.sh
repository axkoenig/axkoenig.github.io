#!/bin/sh
# Install git hooks (run from repo root).
# After this, every commit will run the build and stage updated HTML.

set -e
cd "$(git rev-parse --show-toplevel)"
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "Installed pre-commit hook. It will run the build and stage index.html, art.html, research.html, about.html on each commit."
