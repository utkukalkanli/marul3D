import { tool } from "@opencode-ai/plugin"
import path from "node:path"

export default tool({
  description: "Validate the pending proposal with the local CadQuery B-rep engine.",
  args: {},
  async execute(_args, context) {
    const operation = await Bun.file(path.join(context.directory, ".marul-agent-context.json")).json()
    const response = await fetch(`${process.env.MARUL3D_AGENT_BASE_URL}/api/internal/agent/${operation.operation_id}/tools/build_preview`, {
      method: "POST", headers: { "content-type": "application/json", "x-marul-agent-token": process.env.MARUL3D_AGENT_TOKEN ?? "" }, body: "{}"
    })
    if (!response.ok) throw new Error(await response.text())
    return JSON.stringify(await response.json())
  },
})
