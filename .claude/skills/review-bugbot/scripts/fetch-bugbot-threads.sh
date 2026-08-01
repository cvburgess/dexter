#!/usr/bin/env bash
# Fetch every *unresolved* BugBot review thread on a PR — regardless of which
# review posted it — as one JSON array on stdout:
#
#   [{ "comment_id", "thread_id", "path", "line", "body", "resolved" }, ...]
#
# Driven entirely by the GraphQL reviewThreads query, so findings from an
# earlier review are not dropped when BugBot reviews a PR more than once.
# Threads the skill has already handled fall out on their own, because it
# resolves each thread as it goes.
#
# On GraphQL the app's author login is usually "cursor" but sometimes
# "cursor[bot]"; both are accepted.
#
# Prints an empty array (exit 0) when there is nothing unresolved to address.
#
# Usage: fetch-bugbot-threads.sh <pr-number>
set -euo pipefail

OWNER="cvburgess"
NAME="dexter"

PR="${1:-}"
if [[ ! "$PR" =~ ^[0-9]+$ ]]; then
  echo "usage: fetch-bugbot-threads.sh <pr-number>" >&2
  exit 2
fi

# reviewThreads is deliberately unpaginated: no PR in this repo has come near
# 100 review threads. Revisit if one does. comments(first: 1) is not a cap —
# the finding is always the thread's root comment; replies are not needed.
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
              comments(first: 1) {
                nodes {
                  databaseId
                  author { login }
                  path
                  line
                  originalLine
                  body
                }
              }
            }
          }
        }
      }
    }
  ' --jq '
    [.data.repository.pullRequest.reviewThreads.nodes[]
     | {threadId: .id, resolved: .isResolved, root: .comments.nodes[0]}
     | select(.root.author.login == "cursor" or .root.author.login == "cursor[bot]")]
  ')"

PR="$PR" THREADS_JSON="$THREADS_JSON" node -e '
  const threads = JSON.parse(process.env.THREADS_JSON);
  const rows = threads
    .filter((t) => !t.resolved)
    .map((t) => ({
      comment_id: t.root.databaseId,
      thread_id: t.threadId,
      path: t.root.path,
      line: t.root.line ?? t.root.originalLine,
      body: t.root.body,
      resolved: t.resolved,
    }));
  if (rows.length === 0) {
    console.error(
      threads.length
        ? `no unresolved BugBot threads on PR #${process.env.PR}`
        : `no BugBot threads found on PR #${process.env.PR}`,
    );
  }
  console.log(JSON.stringify(rows, null, 2));
'
