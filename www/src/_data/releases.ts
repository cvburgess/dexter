/**
 * Reads release notes from the repo's CHANGELOG.md.
 *
 * Each entry is a `## vX.Y.Z` heading. Everything below the `---` rule inside an
 * entry is the internal PR list (DEX ticket numbers, PR links) and is dropped —
 * only the user-facing bullets above it are published. Older entries predate the
 * rule and have no `---` at all, in which case the whole body is user-facing.
 *
 * The heading format is load-bearing elsewhere: `.github/scripts/tag-and-release.sh`
 * matches `^## vX.Y.Z$` anchored, so nothing (a date, say) may be appended to it.
 * That is why releases here carry no date.
 */
interface Release {
  version: string;
  notes: string;
}

const CHANGELOG = new URL("../../../CHANGELOG.md", import.meta.url);

const parseChangelog = (markdown: string): Release[] =>
  markdown
    .split(/^## (?=v\d)/m)
    .slice(1) // drop everything before the first version heading
    .map((section) => {
      const newline = section.indexOf("\n");
      const version = section.slice(0, newline).trim();
      const body = section.slice(newline + 1);

      return {
        version,
        // `---` on its own line separates user-facing notes from the PR list
        notes: body.split(/^---$/m)[0].trim(),
      };
    })
    .filter((release) => release.notes.length > 0);

const releases = parseChangelog(await Deno.readTextFile(CHANGELOG));

export default releases;
