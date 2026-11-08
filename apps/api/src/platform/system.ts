import { GPS_INGRESS_LIMITS } from '../telematics/gps/ingress.js';
import { evidenceLimits } from '../evidence/config.js';

export type SystemStatus = 'CONFIGURED' | 'NOT_CONFIGURED' | 'TEST_ONLY' | 'PUBLIC';
export type FeatureStatus = 'AVAILABLE' | 'TEST' | 'NOT_IMPLEMENTED';
type Env = Record<string, string | undefined>;

// Only booleans, host names and fixed limits are derived here. Secret values,
// database URLs, keys and tokens are never returned or logged.
export function integrationStatus(env: Env) {
  const supabaseHost = (() => {
    try {
      return new URL(env.SUPABASE_URL ?? '').hostname;
    } catch {
      return null;
    }
  })();
  const traccar = (env.GPS_TRACCAR_TOKEN ?? '').length >= 32;
  const secret = Boolean(env.SUPABASE_SECRET_KEY);
  const deleteEnabled = env.EVIDENCE_RETENTION_DELETE_ENABLED === 'true';
  return [
    {
      key: 'supabase_auth_db',
      label: 'Supabase Auth và PostgreSQL',
      status: (supabaseHost ? 'CONFIGURED' : 'NOT_CONFIGURED') as SystemStatus,
      detail: supabaseHost
        ? `Máy chủ ${supabaseHost}; kết nối cơ sở dữ liệu yêu cầu xác minh TLS.`
        : 'Chưa cấu hình địa chỉ Supabase.',
    },
    {
      key: 'supabase_admin',
      label: 'Supabase Auth Admin (cấp link Owner)',
      status: (secret ? 'CONFIGURED' : 'NOT_CONFIGURED') as SystemStatus,
      detail: secret
        ? 'Khóa server-only đã cấu hình; không gửi email tự động.'
        : 'Chưa có khóa server-only: không thể cấp link đặt mật khẩu hay xử lý ảnh/video.',
    },
    {
      key: 'evidence_storage',
      label: 'Supabase Storage cho ảnh/video biên bản',
      status: (secret ? 'CONFIGURED' : 'NOT_CONFIGURED') as SystemStatus,
      detail: deleteEnabled
        ? 'Xóa vật lý theo chính sách lưu giữ đang được bật.'
        : 'Xóa vật lý theo chính sách lưu giữ đang tắt (chỉ dry-run).',
    },
    {
      key: 'traccar_gps',
      label: 'Traccar GPS',
      status: (traccar ? 'TEST_ONLY' : 'NOT_CONFIGURED') as SystemStatus,
      detail: traccar
        ? 'Nhận bản tin TEST qua webhook có token; chưa xác nhận thiết bị vật lý.'
        : 'Token webhook chưa đủ 32 ký tự: việc nhận bản tin GPS đang tắt.',
    },
    {
      key: 'osm_tiles',
      label: 'Bản đồ OpenStreetMap',
      status: 'PUBLIC' as SystemStatus,
      detail:
        'Tile công cộng, phù hợp tải nhỏ; tải lớn cần dịch vụ tile phù hợp.',
    },
  ];
}

const feature = (
  key: string,
  label: string,
  status: FeatureStatus,
  description: string,
) => ({ key, label, status, description });

export const FEATURE_CATALOG = [
  feature('fleet', 'Xe, thiết bị GPS và lịch sử gắn', 'AVAILABLE', 'Đăng kiểm, bảo hiểm, bảo dưỡng và lịch sử dịch vụ đi kèm.'),
  feature('rentals', 'Khách hàng, đặt xe, bàn giao và trả xe', 'AVAILABLE', 'Có biên bản kiểm tra và ảnh/video riêng tư.'),
  feature('pricing', 'Bảng giá và báo giá VND', 'AVAILABLE', 'Giá đã xác nhận được giữ nguyên.'),
  feature('contracts', 'Hợp đồng và biên bản in A4', 'AVAILABLE', 'Điều khoản mẫu cần luật sư rà soát trước khi dùng thương mại.'),
  feature('commercial', 'Thu chi, cọc và phí đường bộ CSV', 'AVAILABLE', 'Chưa kết nối VETC, cổng thanh toán hay hóa đơn.'),
  feature('reports', 'Báo cáo và xuất CSV', 'AVAILABLE', 'Từ giao dịch đã ghi nhận; không phải báo cáo kế toán.'),
  feature('alerts', 'Cảnh báo vận hành', 'AVAILABLE', 'Chỉ hiển thị trong ứng dụng; chưa gửi email/push.'),
  feature('gps', 'GPS và hành trình', 'TEST', 'Chỉ nguồn Traccar TEST; chưa có thiết bị vật lý.'),
  feature('platform', 'Superadmin: doanh nghiệp, Owner và nhật ký', 'AVAILABLE', 'Quyền nền tảng độc lập với quyền doanh nghiệp.'),
  feature('customer_portal', 'Cổng khách thuê xe', 'AVAILABLE', 'Khách xem hợp đồng và in hợp đồng đã phát hành; chưa đặt xe, thanh toán hay thông báo.'),
  feature('online_payments', 'Thanh toán online và hóa đơn', 'NOT_IMPLEMENTED', 'Chưa tích hợp cổng thanh toán, hóa đơn hay VAT.'),
  feature('notifications', 'Thông báo email/push', 'NOT_IMPLEMENTED', 'Chưa có dịch vụ gửi thông báo.'),
  feature('billing', 'Gói dịch vụ và thanh toán nền tảng', 'NOT_IMPLEMENTED', 'Chưa có quyền lợi theo gói hay thanh toán.'),
] as const;

export function systemLimits() {
  const evidence = evidenceLimits();
  return {
    gpsRequestsPerMinute: GPS_INGRESS_LIMITS.globalRequests,
    gpsDeviceRequestsPerMinute: GPS_INGRESS_LIMITS.deviceRequests,
    gpsMaxBodyBytes: GPS_INGRESS_LIMITS.bodyBytes,
    evidenceMaxImages: evidence.maxImages,
    evidenceMaxVideos: evidence.maxVideos,
    evidenceMaxTenantBytes: evidence.maxTenantBytes,
    reportMaxDays: 366,
    reportMaxRows: 10_000,
  };
}
