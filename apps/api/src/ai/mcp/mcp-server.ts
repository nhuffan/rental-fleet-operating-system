import { McpServer } from '@modelcontextprotocol/server';
import type { TenantContext } from '../../auth/guards.js';
import { AI_TOOL_DEFINITIONS, type AiToolName } from '../ai-tool-contract.js';
import { AiToolError, type AiToolResult } from '../ai-tools.js';

export type McpToolRunner = {
  execute(
    context: TenantContext,
    name: string,
    input: unknown,
  ): Promise<AiToolResult>;
};

// Every tool is a bounded read over existing tenant-scoped services. The
// principal is resolved by the host process, never by tool arguments, and each
// call is re-verified by AiTools (active Owner/business/profile + permission).
export function createMcpServer(
  runner: McpToolRunner,
  principal: () => Promise<TenantContext>,
) {
  const server = new McpServer({ name: 'carbase-operations', version: '1.0.0' });
  for (const name of Object.keys(AI_TOOL_DEFINITIONS) as AiToolName[]) {
    const definition = AI_TOOL_DEFINITIONS[name];
    server.registerTool(
      name,
      {
        title: name,
        description: definition.description,
        inputSchema: definition.inputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args: unknown) => {
        try {
          const result = await runner.execute(await principal(), name, args);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            structuredContent: result as unknown as Record<string, unknown>,
          };
        } catch (error) {
          // Stable code only; never provider, SQL or token details.
          const code =
            error instanceof AiToolError ? error.code : 'AI_TOOL_UNAVAILABLE';
          return {
            isError: true,
            content: [{ type: 'text' as const, text: code }],
          };
        }
      },
    );
  }
  return server;
}
