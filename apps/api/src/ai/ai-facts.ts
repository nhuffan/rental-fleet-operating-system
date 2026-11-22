import type { AiToolResult } from './ai-tools.js';

export type Fact = { label: string; value: string };

const kindLabels: Record<string, string> = {
  RENTAL_OVERDUE: 'Thuê quá hạn',
  RENTAL_DUE_SOON: 'Sắp đến hạn trả',
  GPS_STALE: 'GPS TEST chậm',
  VEHICLE_REGISTRATION_DUE: 'Đăng kiểm đến hạn',
  VEHICLE_INSURANCE_DUE: 'Bảo hiểm đến hạn',
  VEHICLE_MAINTENANCE_DUE: 'Bảo dưỡng đến hạn',
};

// Facts are computed deterministically from authoritative tool output; the
// model never supplies numbers, dates or money strings that reach this list.
export function factsFrom(result: AiToolResult): Fact[] {
  switch (result.tool) {
    case 'get_operational_alerts': {
      const { items, total } = result.data;
      const facts: Fact[] = [{ label: 'Tổng cảnh báo', value: String(total) }];
      const byKind = new Map<string, number>();
      for (const item of items)
        byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
      for (const [kind, count] of byKind)
        facts.push({
          label: `${kindLabels[kind] ?? kind} (trang này)`,
          value: String(count),
        });
      for (const item of items.slice(0, 5))
        facts.push({
          label: `${item.licensePlate} · ${kindLabels[item.kind] ?? item.kind}`,
          value: `${item.severity}${item.dueAt ? ` · hạn ${item.dueAt}` : ''}${item.sourceMode ? ` · ${item.sourceMode}` : ''}`,
        });
      return facts;
    }
    case 'get_business_report': {
      const d = result.data;
      return [
        { label: 'Khoảng thời gian', value: `${d.from} → ${d.until}` },
        { label: 'Doanh thu ghi nhận', value: `${d.recordedRevenue} ${d.currency}` },
        { label: 'Tiền đã thu', value: `${d.cashReceived} ${d.currency}` },
        { label: 'Chi phí vận hành', value: `${d.operatingExpenses} ${d.currency}` },
        { label: 'Lợi nhuận ước tính', value: `${d.estimatedProfit} ${d.currency}` },
        { label: 'Tỷ lệ sử dụng (ước tính)', value: `${d.fleetUtilizationPercent}%` },
        { label: 'Xe đang hoạt động', value: String(d.activeVehicles) },
        ...d.rentalsByStatus.map(({ status, count }) => ({
          label: `Hợp đồng ${status}`,
          value: String(count),
        })),
      ];
    }
    case 'get_vehicle_availability':
      return [
        { label: 'Khoảng kiểm tra', value: `${result.data.startAt} → ${result.data.endAt}` },
        { label: 'Xe còn trống', value: String(result.data.total) },
        ...result.data.items
          .slice(0, 10)
          .map((v) => ({ label: v.licensePlate, value: 'Còn trống (tham khảo)' })),
      ];
    case 'get_rental_overview':
      return [
        { label: 'Tổng hợp đồng', value: String(result.data.total) },
        {
          label: 'Quá hạn (trang này)',
          value: String(result.data.items.filter((r) => r.isOverdue).length),
        },
      ];
    case 'get_fleet_vehicles':
      return [{ label: 'Tổng số xe', value: String(result.data.total) }];
    case 'get_vehicle_details':
      return [
        { label: result.data.licensePlate, value: result.data.status },
        { label: 'Đăng kiểm hết hạn', value: String(result.data.registrationExpiresOn ?? 'Chưa có') },
        { label: 'Bảo hiểm hết hạn', value: String(result.data.insuranceExpiresOn ?? 'Chưa có') },
      ];
  }
}

export function summaryText(results: AiToolResult[]): string {
  const lines: string[] = [];
  for (const result of results) {
    if (result.tool === 'get_operational_alerts') {
      lines.push(
        result.data.total
          ? `Có ${result.data.total} cảnh báo vận hành cần chú ý.`
          : 'Hiện không có cảnh báo vận hành nào.',
      );
    } else if (result.tool === 'get_business_report') {
      lines.push(
        `Báo cáo từ ${result.data.from} đến ${result.data.until}: doanh thu ghi nhận ${result.data.recordedRevenue} ${result.data.currency}, tỷ lệ sử dụng ước tính ${result.data.fleetUtilizationPercent}%.`,
      );
    } else if (result.tool === 'get_vehicle_availability') {
      lines.push(
        result.data.total
          ? `Có ${result.data.total} xe còn trống trong khoảng đã chọn (chỉ để tham khảo, chưa giữ chỗ).`
          : 'Không có xe trống trong khoảng đã chọn.',
      );
    } else if (result.tool === 'get_rental_overview') {
      lines.push(`Có ${result.data.total} hợp đồng thuê khớp bộ lọc.`);
    } else if (result.tool === 'get_fleet_vehicles') {
      lines.push(`Đội xe có ${result.data.total} xe khớp bộ lọc.`);
    } else {
      lines.push(`Thông tin xe ${result.data.licensePlate}: ${result.data.status}.`);
    }
  }
  return lines.join(' ');
}
