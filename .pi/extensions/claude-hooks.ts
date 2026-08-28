import { spawn } from "node:child_process";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";

// Ports the Claude Code hooks in .claude/settings.json:
//   PostToolUse (Edit|Write) -> format-and-lint.sh (60s timeout)
//   Stop -> run-tests.sh (300s timeout)

declare const process: { env: Record<string, string | undefined> };

function runHook(
  script: string,
  timeoutMs: number,
  cwd: string,
  stdin?: string,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn("bash", [join(cwd, ".claude", "hooks", script)], {
      cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    });
    let stdout = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.on("error", () => {
      clearTimeout(timer);
      resolve(undefined);
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve(
        code === 0
          ? undefined
          : `${script} exited with code ${code}\n${stdout}`.trim(),
      );
    });
    child.stdin.end(stdin ?? "");
  });
}

export default function (pi: ExtensionAPI) {
  pi.on(
    "tool_result",
    async (event: ToolResultEvent, ctx: ExtensionContext) => {
      if (event.toolName !== "edit" && event.toolName !== "write") return;
      const filePath = (event.input as { file_path?: string }).file_path;
      if (!filePath) return;
      const error = await runHook(
        "format-and-lint.sh",
        60_000,
        ctx.cwd,
        JSON.stringify({ tool_input: { file_path: filePath } }),
      );
      if (error)
        return { isError: true, content: [{ type: "text", text: error }] };
    },
  );

  pi.on("turn_end", async (event: undefined, ctx: ExtensionContext) => {
    void event;
    const error = await runHook("run-tests.sh", 300_000, ctx.cwd);
    if (error && ctx.ui) await ctx.ui.notify(error, "error");
  });
}
