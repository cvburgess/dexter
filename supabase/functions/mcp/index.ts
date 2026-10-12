import "@supabase/functions-js/edge-runtime.d.ts";

import { createHandler } from "./handler.ts";

Deno.serve(createHandler());
