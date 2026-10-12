import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { Database } from "@src/types/database.types.ts";
import type { ToolResult } from "./helpers.ts";

export interface ToolContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

// Both MCP SDK generations implement this seam; tools never see a transport
// or an admin client, and their parsed arguments retain schema inference.
export interface ToolRegistrar {
  registerTool<Shape extends Record<string, z.ZodType> = Record<never, never>>(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: Shape;
      annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
      };
    },
    handler: (args: z.output<z.ZodObject<Shape>>) => Promise<ToolResult>,
  ): void;
}
