#!/usr/bin/env bash
# Reply to a BugBot review comment and resolve its thread.
#
# Uses POST .../pulls/<pr>/comments with in_reply_to (the /replies sub-route
# often returns 404), then the resolveReviewThread GraphQL mutation.
#
# Usage: reply-and-resolve.sh <pr-number> <comment_id> <thread_id> <body>
set -euo pipefail

REPO="cvburgess/dexter"

PR="${1:-}"
COMMENT_ID="${2:-}"
THREAD_ID="${3:-}"
BODY="${4:-}"
if [[ ! "$PR" =~ ^[0-9]+$ || ! "$COMMENT_ID" =~ ^[0-9]+$ || -z "$THREAD_ID" || -z "$BODY" ]]; then
  echo "usage: reply-and-resolve.sh <pr-number> <comment_id> <thread_id> <body>" >&2
  exit 2
fi

REPLY_URL="$(gh api "repos/$REPO/pulls/$PR/comments" \
  -f body="$BODY" -F in_reply_to="$COMMENT_ID" --jq '.html_url')"
echo "replied: $REPLY_URL"

RESOLVED="$(gh api graphql \
  -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }' \
  -F threadId="$THREAD_ID" --jq '.data.resolveReviewThread.thread.isResolved')"
if [[ "$RESOLVED" != "true" ]]; then
  echo "error: thread $THREAD_ID did not resolve (isResolved=$RESOLVED)" >&2
  exit 1
fi
echo "resolved thread $THREAD_ID"
