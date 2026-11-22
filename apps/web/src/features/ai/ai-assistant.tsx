"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/query";
import type { AiAnswer } from "./types";

const examples = [
  "Hôm nay xe nào cần xử lý?",
  "30 ngày gần đây đội xe hoạt động thế nào?",
  "Hợp đồng nào sắp đến hạn?",
  "GPS nào báo chậm?",
];
const errors: Record<string, string> = {
  AI_UNAVAILABLE:
    "Trợ lý AI chưa được bật hoặc tạm thời không khả dụng. Các trang vận hành khác vẫn hoạt động bình thường.",
  AI_RATE_LIMITED: "Bạn hỏi quá nhanh. Vui lòng đợi một chút rồi thử lại.",
};

export function AiAssistant() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/app/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: value }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code =
          body && typeof body === "object" && "code" in body
            ? String((body as { code: unknown }).code)
            : "";
        setAnswer(null);
        setError(errors[code] ?? "Không thể xử lý câu hỏi. Vui lòng thử lại.");
      } else setAnswer(body as AiAnswer);
    } catch {
      setAnswer(null);
      setError(errors.AI_UNAVAILABLE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-assistant" style={{ display: "grid", gap: 16 }}>
      <Panel>
        <PanelHeader
          title="Hỏi về vận hành"
          subtitle="Trợ lý chỉ đọc dữ liệu doanh nghiệp đang chọn. Không đặt xe, không gia hạn, không gửi thông báo."
          icon="search"
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
          style={{ display: "grid", gap: 12 }}
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            rows={3}
            aria-label="Câu hỏi"
            placeholder="Ví dụ: Hôm nay xe nào cần xử lý?"
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="submit" loading={busy} disabled={!question.trim()}>
              Hỏi
            </Button>
            {examples.map((example) => (
              <Button
                key={example}
                type="button"
                variant="secondary"
                size="small"
                disabled={busy}
                onClick={() => {
                  setQuestion(example);
                  void ask(example);
                }}
              >
                {example}
              </Button>
            ))}
          </div>
        </form>
      </Panel>
      {error && (
        <Panel>
          <p role="alert">{error}</p>
        </Panel>
      )}
      {answer ? (
        <Panel>
          <PanelHeader
            title={answer.status === "CLARIFICATION_NEEDED" ? "Cần thêm thông tin" : "Câu trả lời"}
            icon="search"
            action={
              answer.asOf ? <Badge tone="info">Dữ liệu lúc {formatDate(answer.asOf)}</Badge> : undefined
            }
          />
          <p>{answer.answer}</p>
          {answer.facts.length > 0 && (
            <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px" }}>
              {answer.facts.map((fact, index) => (
                <div key={`${fact.label}-${index}`} style={{ display: "contents" }}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {answer.limitations.length > 0 && (
            <ul>
              {answer.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {answer.sourceReferences.length > 0 && (
            <p>
              Nguồn:{" "}
              {answer.sourceReferences
                .filter((source) => source.path.startsWith("/app/"))
                .map((source) => (
                  <Link key={source.id} href={source.path} style={{ marginRight: 12 }}>
                    {source.label}
                  </Link>
                ))}
            </p>
          )}
          <small>
            Công cụ: {answer.toolsUsed.map((tool) => tool.name).join(", ") || "không"} ·{" "}
            {answer.diagnostics.latencyMs} ms
          </small>
        </Panel>
      ) : (
        !error && (
          <EmptyState
            title="Chưa có câu hỏi"
            description="Chọn một câu hỏi mẫu hoặc tự nhập câu hỏi về cảnh báo, báo cáo hoặc xe còn trống."
          />
        )
      )}
    </div>
  );
}
