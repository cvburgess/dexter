#!/usr/bin/env bash
# Fetch the latest BugBot review's comments for a PR, merged with their
# GraphQL review-thread ids, as one JSON array on stdout:
#
#   [{ "comment_id", "thread_id", "path", "line", "body", "resolved" }, ...]
#
# Handles the author-name discrepancy: the app is "cursor[bot]" on the REST
# reviews API but "cursor" on GraphQL review-thread comments.
#
# Usage: fetch-bugbot-threads.sh <pr-number>
set -euo pipefail

REPO="cvburgess/dexter"
OWNER="cvburgess"
NAME="dexter"

PR="${1:-}"
if [[ ! "$PR" =~ ^[0-9]+$ ]]; then
  echo "usage: fetch-bugbot-threads.sh <pr-number>" >&2
  exit 2
fi

REVIEW_ID="$(gh api "repos/$REPO/pulls/$PR/reviews?per_page=100" \
  --jq '[.[] | select(.user.login == "cursor[bot]" or .user.login == "cursor")] | last | .id // empty')"
if [[ -z "$REVIEW_ID" ]]; then
  echo "no BugBot review found on PR #$PR" >&2
  exit 1
fi

COMMENTS_JSON="$(gh api "repos/$REPO/pulls/$PR/reviews/$REVIEW_ID/comments" \
  --jq '[.[] | {id: .id, path: .path, line: (.line // .original_line), body: .body}]')"

THREADS_JSON="$(gh api graphql \
  -F owner="$OWNER" -F repo="$NAME" -F number="$PR" \
  -f query='
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              id
              comments(first: 5) {
                nodes {
                  databaseId
                  author { login }
                }
              }
            }
          }
        }
      }
    }
  ' --jq '
    [.data.repository.pullRequest.reviewThreads.nodes[]
     | {threadId: .id, resolved: .isResolved, comments: [.comments.nodes[] | {id: .databaseId, author: .author.login}]}
     | select(.comments | any(.author == "cursor" or .author == "cursor[bot]"))]
  ')"

COMMENTS_JSON="$COMMENTS_JSON" THREADS_JSON="$THREADS_JSON" node -e '
  const comments = JSON.parse(process.env.COMMENTS_JSON);
  const threads = JSON.parse(process.env.THREADS_JSON);
  const rows = comments.map((c) => {
    const thread = threads.find((t) => t.comments.some((tc) => tc.id === c.id));
    return {
      comment_id: c.id,
      thread_id: thread ? thread.threadId : null,
      path: c.path,
      line: c.line,
      body: c.body,
      resolved: thread ? thread.resolved : null,
    };
  });
  console.log(JSON.stringify(rows, null, 2));
'
