import { redirect } from "next/navigation";
import { currentContext } from "@/lib/api";
import { PageHeader } from "@/components/ui/primitives";
import { AiAssistant } from "@/features/ai/ai-assistant";

export default async function AiPage() {
  const context = await currentContext();
  if (!context.permissions.includes("alert.read")) redirect("/access-denied");
  return (
    <>
      <PageHeader
        title="Trợ lý AI"
        description="Hỏi nhanh về cảnh báo, báo cáo và xe còn trống. Câu trả lời dựa trên dữ liệu hiện có, kèm nguồn và giới hạn."
      />
      <AiAssistant key={context.business.id} />
    </>
  );
}
