import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { TenantContext } from '../auth/guards.js';
import { aiConfig, type AiConfig } from './ai-config.js';
import { factsFrom, summaryText, type Fact } from './ai-facts.js';
import {
  AiToolError,
  AiTools,
  type AiSourceReference,
  type AiToolResult,
} from './ai-tools.js';
import {
  createProvider,
  type ModelProvider,
  type ToolRun,
} from './model-provider.js';

const MAX_ROUNDS = 4;
const MAX_TOOL_CALLS = 4;

export const AI_CONFIG = Symbol('AI_CONFIG');
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiAnswer = {
  status: 'ANSWERED' | 'CLARIFICATION_NEEDED' | 'NO_DATA';
  answer: string;
  facts: Fact[];
  sourceReferences: AiSourceReference[];
  asOf: string | null;
  limitations: string[];
  toolsUsed: { name: string; traceId: string; status: 'OK' | 'ERROR' }[];
  diagnostics: { provider: string; latencyMs: number; toolCalls: number };
};

@Injectable()
export class AiService {
  private readonly windows = new Map<string, number[]>();

  constructor(
    @Inject(AiTools) private readonly tools: AiTools,
    @Inject(AI_CONFIG) private readonly config: AiConfig = aiConfig(),
    @Inject(AI_PROVIDER)
    private readonly provider: ModelProvider | undefined = createProvider(
      config,
    ),
  ) {}

  private admit(userId: string) {
    const now = Date.now();
    const recent = (this.windows.get(userId) ?? []).filter(
      (at) => now - at < 60_000,
    );
    if (recent.length >= this.config.ratePerMinute)
      throw new HttpException(
        { code: 'AI_RATE_LIMITED', message: 'Too many AI requests' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    recent.push(now);
    this.windows.set(userId, recent);
  }

  async query(context: TenantContext, question: string): Promise<AiAnswer> {
    if (!this.config.enabled || !this.provider)
      throw new ServiceUnavailableException({
        code: 'AI_UNAVAILABLE',
        message: 'AI assistant is not enabled',
      });
    if (context.role !== 'OWNER') throw new ForbiddenException();
    this.admit(context.userId);

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    timer.unref();
    const runs: ToolRun[] = [];
    const results: AiToolResult[] = [];
    const toolsUsed: AiAnswer['toolsUsed'] = [];
    let text = '';
    let clarification = false;
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const step = await this.provider.next(
          question,
          runs,
          controller.signal,
        );
        if (step.kind === 'clarify') {
          text = step.text;
          clarification = true;
          break;
        }
        if (step.kind === 'answer') {
          text = step.text;
          break;
        }
        for (const call of step.calls) {
          if (runs.length >= MAX_TOOL_CALLS) break;
          try {
            const result = await this.tools.execute(
              context,
              call.name,
              call.input,
            );
            results.push(result);
            toolsUsed.push({
              name: call.name,
              traceId: result.traceId,
              status: 'OK',
            });
            runs.push({ ...call, output: result });
          } catch (error) {
            const code =
              error instanceof AiToolError ? error.code : 'AI_TOOL_UNAVAILABLE';
            if (code === 'AI_TOOL_DENIED') throw new ForbiddenException();
            toolsUsed.push({
              name: call.name,
              traceId: randomUUID(),
              status: 'ERROR',
            });
            runs.push({ ...call, output: { error: code } });
          }
        }
        if (runs.length >= MAX_TOOL_CALLS) {
          // Budget reached: ask for the final answer once, with no more calls.
          const last = await this.provider.next(
            question,
            runs,
            controller.signal,
          );
          text = last.kind === 'call' ? '' : last.text;
          break;
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({
        code: 'AI_UNAVAILABLE',
        message: 'AI assistant is temporarily unavailable',
      });
    } finally {
      clearTimeout(timer);
    }

    const sourceMap = new Map<string, AiSourceReference>();
    for (const result of results)
      for (const source of result.sourceReferences)
        sourceMap.set(source.id, source);
    const limitations = [
      ...new Set(results.flatMap((result) => result.limitations)),
    ];
    const asOfs = results.map((r) => r.asOf ?? r.readAt).sort();
    const facts = results.flatMap(factsFrom);
    const diagnostics = {
      provider: this.config.provider,
      latencyMs: Date.now() - started,
      toolCalls: runs.length,
    };
    if (clarification)
      return {
        status: 'CLARIFICATION_NEEDED',
        answer: text,
        facts: [],
        sourceReferences: [],
        asOf: null,
        limitations: [],
        toolsUsed,
        diagnostics,
      };
    if (!results.length)
      return {
        status: 'NO_DATA',
        answer:
          'Không lấy được dữ liệu phù hợp để trả lời. Vui lòng thử lại hoặc hỏi cụ thể hơn.',
        facts: [],
        sourceReferences: [],
        asOf: null,
        limitations: [],
        toolsUsed,
        diagnostics,
      };
    return {
      status: 'ANSWERED',
      // An answer is never delivered without grounded facts; fall back to a
      // deterministic summary when the model returns no usable text.
      answer: text.trim() || summaryText(results),
      facts,
      sourceReferences: [...sourceMap.values()],
      asOf: asOfs[0] ?? null,
      limitations,
      toolsUsed,
      diagnostics,
    };
  }
}
