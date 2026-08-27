import { assert, assertEquals } from "@std/assert";

// DEX-86: `.env.preview` and config.toml's `[edge_runtime.secrets]` must
// agree, or a secret is silently absent from every preview branch.

const envPreview = await Deno.readTextFile(
  new URL("../../.env.preview", import.meta.url),
).catch((error: unknown) => {
  // Say what to do about the exact failure this suite exists to prevent;
  // anything else surfaces as-is rather than mislabelled as "missing".
  if (!(error instanceof Deno.errors.NotFound)) throw error;
  throw new Error(
    'supabase/.env.preview is missing. Recreate it with `npx @dotenvx/dotenvx set DEMO_OTP "<value>" -f supabase/.env.preview` — without it, preview branches receive empty Edge Function secrets.',
  );
});
const configToml = await Deno.readTextFile(
  new URL("../../config.toml", import.meta.url),
);

// Ignores a trailing `# comment` (dotenvx writes one after the public key
// line) — an unparsed line would silently drop the key from these checks.
const ASSIGNMENT = /^([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#\s]*))/;

/** Every `KEY="value"` assignment in `.env.preview`, comments stripped. */
function envAssignments(source: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(ASSIGNMENT);
    if (match) entries.set(match[1], match[2] ?? match[3] ?? match[4] ?? "");
  }
  return entries;
}

/** The `KEY = "env(KEY)"` mappings under `[edge_runtime.secrets]`. */
function edgeRuntimeSecrets(source: string): Map<string, string> {
  const section = source.split("\n[edge_runtime.secrets]\n")[1];
  if (section === undefined) return new Map();
  const entries = new Map<string, string>();
  // Stop at the next TOML table header.
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) break;
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Same tolerance as `.env.preview`: a TOML inline comment after the value
    // must not stop the mapping from being seen.
    const match = trimmed.match(ASSIGNMENT);
    if (match) entries.set(match[1], match[2] ?? match[3] ?? match[4] ?? "");
  }
  return entries;
}

const assignments = envAssignments(envPreview);
// dotenvx writes the public key alongside the encrypted values; it is not a
// secret and is not applied to preview branches.
const secretKeys = [...assignments.keys()].filter(
  (key) => key !== "DOTENV_PUBLIC_KEY_PREVIEW",
);
const mapped = edgeRuntimeSecrets(configToml);

Deno.test("every .env.preview secret is encrypted, never plaintext", () => {
  assert(
    secretKeys.length > 0,
    ".env.preview must declare at least one secret",
  );

  for (const key of secretKeys) {
    const value = assignments.get(key)!;
    assert(
      value.startsWith("encrypted:"),
      `${key} in .env.preview is not encrypted — re-run \`npx @dotenvx/dotenvx set ${key} "<value>" -f supabase/.env.preview\` instead of editing the file by hand`,
    );
  }
});

Deno.test("every .env.preview secret is mapped in [edge_runtime.secrets]", () => {
  for (const key of secretKeys) {
    assertEquals(
      mapped.get(key),
      `env(${key})`,
      `${key} is encrypted in .env.preview but not mapped as ${key} = "env(${key})" in config.toml, so preview branches never receive it`,
    );
  }
});

Deno.test("every [edge_runtime.secrets] entry has a .env.preview value", () => {
  for (const key of mapped.keys()) {
    assert(
      assignments.has(key),
      `${key} is mapped in config.toml but absent from .env.preview, so it resolves to empty on preview branches`,
    );
  }
});

Deno.test("DEMO_OTP is present", () => {
  // verify-demo-otp and seed-demo both derive from this value (see
  // functions/_shared/demoAuth.ts); this pins that the key never disappears.
  assert(secretKeys.includes("DEMO_OTP"), "DEMO_OTP must be in .env.preview");
});
