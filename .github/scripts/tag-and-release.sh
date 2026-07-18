#!/usr/bin/env bash
set -euo pipefail

# Creates or updates a git tag and GitHub release for the given version.
# Reads the full release body from CHANGELOG.md.
#
# Usage: tag-and-release.sh <version>
# Example: tag-and-release.sh 2.0.0
#
# Requires: git, gh
# Environment: GH_TOKEN (set automatically in GitHub Actions)

VERSION="${1:?Usage: tag-and-release.sh <version>}"
TAG="v${VERSION}"
REPO="cvburgess/dexter"

# --- Git tag (idempotent: deletes existing, then creates on HEAD) ---

git tag -d "$TAG" 2>/dev/null || true
git push origin ":refs/tags/$TAG" 2>/dev/null || true
git tag "$TAG"
git push origin "$TAG"

# --- Extract release body from CHANGELOG.md ---

if [ -f CHANGELOG.md ]; then
  BODY=$(sed -n "/^## $TAG$/,/^## v/{/^## v[^$]/!p;}" CHANGELOG.md \
    | sed '1d' \
    | sed -e :a -e '/^\n*$/{$d;N;ba}')
fi
BODY="${BODY:-Release $TAG}"

# --- Create or update GitHub release ---

NOTES_FILE=$(mktemp)
echo "$BODY" > "$NOTES_FILE"

if gh release view "$TAG" --repo "$REPO" > /dev/null 2>&1; then
  gh release edit "$TAG" --repo "$REPO" --draft=false --notes-file "$NOTES_FILE"
  echo "Updated release $TAG"
else
  gh release create "$TAG" --repo "$REPO" --title "$TAG" --notes-file "$NOTES_FILE"
  echo "Created release $TAG"
fi
