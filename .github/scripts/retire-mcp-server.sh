#!/bin/sh
set -eu

project_ref=${1:?Supabase project ref is required}
functions=$(supabase functions list --project-ref "$project_ref" --output json)
legacy=$(printf '%s' "$functions" | jq -r '.[] | select(.slug == "mcp-server") | .slug')

# Deploying the replacement does not delete removed functions; absent is safe
# on fresh previews and subsequent production deploys.
if [ -n "$legacy" ]; then
  supabase functions delete mcp-server --project-ref "$project_ref" --yes
fi
