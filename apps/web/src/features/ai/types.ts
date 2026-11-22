export type AiAnswer = {
  status: "ANSWERED" | "CLARIFICATION_NEEDED" | "NO_DATA";
  answer: string;
  facts: { label: string; value: string }[];
  sourceReferences: { id: string; label: string; path: string }[];
  asOf: string | null;
  limitations: string[];
  toolsUsed: { name: string; traceId: string; status: "OK" | "ERROR" }[];
  diagnostics: { provider: string; latencyMs: number; toolCalls: number };
};
