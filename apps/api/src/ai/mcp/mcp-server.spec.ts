import { PassThrough } from 'node:stream';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../auth/guards.js';
import { AI_TOOL_DEFINITIONS } from '../ai-tool-contract.js';
import { AiToolError, type AiToolResult } from '../ai-tools.js';
import { assertLocalMcpAllowed } from './mcp-principal.js';
import { createMcpServer } from './mcp-server.js';

const owner: TenantContext = {
  role: 'OWNER',
  businessId: '20000000-0000-4000-8000-000000000002',
  membershipId: '20000000-0000-4000-8000-000000000003',
  userId: '20000000-0000-4000-8000-000000000004',
  businessName: 'Synthetic business',
  email: 'owner@example.invalid',
};

type Rpc = {
  error?: unknown;
  result?: { isError?: boolean; content?: { text: string }[]; tools?: unknown[] };
};

async function host(
  execute: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<AiToolResult>>>,
) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const server = createMcpServer({ execute }, () => Promise.resolve(owner));
  await server.connect(new StdioServerTransport(stdin, stdout));
  const pending = new Map<number, (message: Rpc) => void>();
  let buffer = '';
  stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    for (let i = buffer.indexOf('\n'); i >= 0; i = buffer.indexOf('\n')) {
      const line = buffer.slice(0, i);
      buffer = buffer.slice(i + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line) as Rpc & { id: number };
      pending.get(message.id)?.(message);
    }
  });
  let id = 0;
  const rpc = (method: string, params: unknown = {}) =>
    new Promise<Rpc>((resolve) => {
      id += 1;
      pending.set(id, resolve);
      stdin.write(
        JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n',
      );
    });
  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  stdin.write(
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) +
      '\n',
  );
  return { rpc, close: () => server.close() };
}

const fresh = () => vi.fn<(...args: unknown[]) => Promise<AiToolResult>>();

describe('local MCP server', () => {
  it('lists exactly the read-only allowlist with truthful annotations', async () => {
    const { rpc, close } = await host(fresh());
    const { result } = await rpc('tools/list');
    const tools = result?.tools as { name: string; annotations: object }[];
    expect(tools.map((t) => t.name).sort()).toEqual(
      Object.keys(AI_TOOL_DEFINITIONS).sort(),
    );
    for (const tool of tools)
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
    await close();
  });

  it('runs tools as the pinned principal and rejects tenant arguments and unknown tools', async () => {
    const execute = fresh().mockResolvedValue({
      tool: 'get_business_report',
    } as unknown as AiToolResult);
    const { rpc, close } = await host(execute);
    const ok = await rpc('tools/call', {
      name: 'get_business_report',
      arguments: {},
    });
    expect(execute).toHaveBeenCalledWith(owner, 'get_business_report', {});
    expect(ok.result?.isError).toBeFalsy();
    const attack = await rpc('tools/call', {
      name: 'get_business_report',
      arguments: { businessId: '30000000-0000-4000-8000-000000000001' },
    });
    expect(attack.error ?? attack.result?.isError).toBeTruthy();
    const unknown = await rpc('tools/call', {
      name: 'run_sql',
      arguments: { sql: 'select 1' },
    });
    expect(unknown.error ?? unknown.result?.isError).toBeTruthy();
    expect(execute).toHaveBeenCalledTimes(1);
    await close();
  });

  it('returns only a stable error code when a tool fails', async () => {
    const execute = fresh().mockRejectedValue(new AiToolError('AI_TOOL_DENIED'));
    const { rpc, close } = await host(execute);
    const denied = await rpc('tools/call', {
      name: 'get_fleet_vehicles',
      arguments: {},
    });
    expect(denied.result?.isError).toBe(true);
    expect(denied.result?.content?.[0]?.text).toBe('AI_TOOL_DENIED');
    await close();
  });

  it('refuses to start unless enabled, non-production and pinned to UUIDs', () => {
    const ids = {
      MCP_USER_ID: owner.userId,
      MCP_BUSINESS_ID: owner.businessId,
    };
    expect(() => assertLocalMcpAllowed({ ...ids })).toThrow('disabled');
    expect(() =>
      assertLocalMcpAllowed({ ...ids, MCP_ENABLED: 'true', APP_ENV: 'production' }),
    ).toThrow('staging/production');
    expect(() =>
      assertLocalMcpAllowed({
        MCP_ENABLED: 'true',
        MCP_USER_ID: 'x',
        MCP_BUSINESS_ID: owner.businessId,
      }),
    ).toThrow('UUID');
    expect(
      assertLocalMcpAllowed({ ...ids, MCP_ENABLED: 'true', APP_ENV: 'development' }),
    ).toEqual({ userId: owner.userId, businessId: owner.businessId });
  });
});
