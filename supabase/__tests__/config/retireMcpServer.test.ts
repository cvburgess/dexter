import { assertEquals } from "@std/assert";

const script =
  new URL("../../../.github/scripts/retire-mcp-server.sh", import.meta.url)
    .pathname;

type Options = { listExit?: number; deleteExit?: number };

async function retire(functions: unknown, options: Options = {}) {
  const directory = await Deno.makeTempDir();
  const log = `${directory}/deleted`;
  try {
    await Deno.writeTextFile(
      `${directory}/supabase`,
      `#!/bin/sh
case "$1:$2" in
  functions:list)
    [ "$3:$4:$5:$6" = "--project-ref:test-project:--output:json" ] || exit 9
    printf '%s' "$FUNCTIONS_JSON"
    exit "$LIST_EXIT"
    ;;
  functions:delete)
    [ "$3:$4:$5:$6" = "mcp-server:--project-ref:test-project:--yes" ] || exit 9
    printf '%s' "$3" > "$DELETE_LOG"
    exit "$DELETE_EXIT"
    ;;
  *) exit 9 ;;
esac
`,
    );
    await Deno.chmod(`${directory}/supabase`, 0o755);
    const output = await new Deno.Command("sh", {
      args: [script, "test-project"],
      env: {
        PATH: `${directory}:${Deno.env.get("PATH") ?? "/usr/bin:/bin"}`,
        FUNCTIONS_JSON: JSON.stringify(functions),
        LIST_EXIT: String(options.listExit ?? 0),
        DELETE_EXIT: String(options.deleteExit ?? 0),
        DELETE_LOG: log,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const deleted = await Deno.readTextFile(log).catch((error: unknown) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
      return null;
    });
    return { code: output.code, deleted };
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

Deno.test("DEX-228: retirement deletes only the old MCP function in the requested project", async () => {
  assertEquals(await retire([{ slug: "mcp" }, { slug: "mcp-server" }]), {
    code: 0,
    deleted: "mcp-server",
  });
});

Deno.test("DEX-228: retirement is safe when the legacy function is already absent", async () => {
  for (const functions of [[], [{ slug: "mcp" }, { slug: "ics-proxy" }]]) {
    assertEquals(await retire(functions), { code: 0, deleted: null });
  }
});

Deno.test("DEX-228: failed listing or malformed metadata never triggers deletion", async () => {
  assertEquals(await retire([{ slug: "mcp-server" }], { listExit: 7 }), {
    code: 7,
    deleted: null,
  });
  const malformed = await retire("not a function list");
  assertEquals(malformed.deleted, null);
  assertEquals(malformed.code === 0, false);
});

Deno.test("DEX-228: retirement failures fail deployment rather than silently keeping the endpoint", async () => {
  assertEquals(await retire([{ slug: "mcp-server" }], { deleteExit: 8 }), {
    code: 8,
    deleted: "mcp-server",
  });
});
