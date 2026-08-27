// Parses the root CHANGELOG.md. Only text above an entry's `---` is published
// (below is the PR list); `## vX.Y.Z` headings stay bare — tag-and-release.sh anchors on them.
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
