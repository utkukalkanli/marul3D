import { tool } from "@opencode-ai/plugin"
import path from "node:path"

export default tool({
  description: "Ask the user one focused clarification question before CAD work.",
  args: { question: tool.schema.string(), options: tool.schema.array(tool.schema.string()).optional() },
  async execute(args, context) {
    const operation = await Bun.file(path.join(context.directory, ".marul-agent-context.json")).json()
    const response = await fetch(`${process.env.MARUL3D_AGENT_BASE_URL}/api/internal/agent/${operation.operation_id}/tools/ask_clarification`, {
      method: "POST", headers: { "content-type": "application/json", "x-marul-agent-token": process.env.MARUL3D_AGENT_TOKEN ?? "" }, body: JSON.stringify(args)
    })
    if (!response.ok) throw new Error(await response.text())
    return JSON.stringify(await response.json())
  },
})
