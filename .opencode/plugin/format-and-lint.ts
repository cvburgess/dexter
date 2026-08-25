import type { Plugin } from "@opencode-ai/plugin"

export default (async ({ directory, $ }) => {
  const hooksDir = `${directory}/.claude/hooks`

  const runHook = async (script: string, stdin?: string) => {
    try {
      const command = stdin
        ? $`printf %s ${stdin} | bash ${hooksDir}/${script}`
        : $`bash ${hooksDir}/${script}`
      await command.quiet().nothrow()
    } catch {
      // a failing hook must never break the agent turn
    }
  }

  return {
    "tool.execute.after": async (input) => {
      if (input.tool === "edit" || input.tool === "write") {
        const filePath = input.args?.filePath
        if (typeof filePath === "string") {
          await runHook(
            "format-and-lint.sh",
            JSON.stringify({ tool_input: { file_path: filePath } })
          )
        }
      }
    },
    event: async (input) => {
      if (input.event.type === "session.idle") {
        await runHook("run-tests.sh")
      }
    },
  }
}) satisfies Plugin
