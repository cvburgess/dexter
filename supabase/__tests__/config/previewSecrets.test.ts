import { assert, assertEquals } from "@std/assert";

// DEX-86: static guards over the dotenvx preview-secrets wiring.
//
// Preview branches get their Edge Function secrets from the committed,
// encrypted `.env.preview`, applied by the `[edge_runtime.secrets]` table in
// `config.toml`. Those two files have to agree: a secret encrypted but never
// mapped is silently absent from every preview (the DEX-86 incident — a
// missing DEMO_OTP made `verify-demo-otp` 500), and a secret mapped but never
// encrypted resolves to empty the same way. Backend CI has no Supabase
// project, so these assert over the committed text.

const envPreview = await Deno.readTextFile(
  new URL("../../.env.preview", import.meta.url),
).catch(() => {
  // Deleting this file while config.toml still maps secrets is the silent
  // failure mode these tests exist to prevent, so say what to do about it.
  throw new Error(
    'supabase/.env.preview is missing. Recreate it with `npx @dotenvx/dotenvx set DEMO_OTP "<value>" -f supabase/.env.preview` — without it, preview branches receive empty Edge Function secrets.',
  );
});
const configToml = await Deno.readTextFile(
  new URL("../../config.toml", import.meta.url),
);

/** Every `KEY="value"` assignment in `.env.preview`, comments stripped. */
function envAssignments(source: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*"?(.*?)"?$/);
    if (match) entries.set(match[1], match[2]);
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
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*"(.*)"$/);
    if (match) entries.set(match[1], match[2]);
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
  // The demo login this whole mechanism exists for: verify-demo-otp reads
  // DEMO_OTP, and seed-demo derives the demo user's password from the same
  // value (see functions/_shared/demoAuth.ts). The generic tests above already
  // assert its encryption and its config.toml mapping; this only pins that the
  // key itself never quietly disappears.
  assert(secretKeys.includes("DEMO_OTP"), "DEMO_OTP must be in .env.preview");
});
