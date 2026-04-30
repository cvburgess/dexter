// deno-lint-ignore no-import-prefix no-unversioned-import
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() =>
  new Response(JSON.stringify({ ok: true, service: "dexter-hello" }), {
    headers: { "Content-Type": "application/json" },
  })
);
