#!/usr/bin/env bash
# Resolve the Supabase preview branch for the current git branch and print its
# connection values, one per line:
#
#   PREVIEW_REF=<project ref>
#   PREVIEW_URL=https://<project ref>.supabase.co
#   PREVIEW_KEY=sb_publishable_...
#
# Fails with an actionable message when the branch has no preview branch.
# Never prints anon, service_role, or sb_secret_ keys.
set -euo pipefail

PROD_REF="isreileykodwkyedcewv"

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "error: detached HEAD; check out a branch first" >&2
  exit 1
fi

BRANCHES_JSON="$(npx supabase branches list --project-ref "$PROD_REF" -o json)"
REF="$(BRANCHES_JSON="$BRANCHES_JSON" GIT_BRANCH="$BRANCH" node -e '
  const branches = JSON.parse(process.env.BRANCHES_JSON);
  const match = branches.find((b) => b.git_branch === process.env.GIT_BRANCH);
  if (match) process.stdout.write(match.project_ref);
')"
if [[ -z "$REF" ]]; then
  echo "error: no Supabase preview branch for git branch \"$BRANCH\"." >&2
  echo "Preview branches are only created when the PR touches supabase/migrations/, so there may be none for this branch." >&2
  exit 1
fi

KEYS_JSON="$(npx supabase projects api-keys --project-ref "$REF" -o json)"
KEY="$(KEYS_JSON="$KEYS_JSON" node -e '
  const keys = JSON.parse(process.env.KEYS_JSON);
  const match = keys.find((k) => typeof k.api_key === "string" && k.api_key.startsWith("sb_publishable_"));
  if (match) process.stdout.write(match.api_key);
')"
if [[ -z "$KEY" ]]; then
  echo "error: no sb_publishable_ key found for preview ref $REF" >&2
  exit 1
fi

echo "PREVIEW_REF=$REF"
echo "PREVIEW_URL=https://$REF.supabase.co"
echo "PREVIEW_KEY=$KEY"
