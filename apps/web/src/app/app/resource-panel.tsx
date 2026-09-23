"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Branch,
  Business,
  Me,
  Membership,
  Page,
  Settings,
} from "@rental-fleet/contracts";
import { browserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
type Section = "business" | "users" | "branches" | "settings";
type Props = {
  section: Section;
  context: Me;
  initial: Business | Page<Branch> | Page<Membership> | Settings;
};
export function ResourcePanel({ section, context, initial }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Branch | Membership | null>(null);
  const editable = context.permissions.includes(
    {
      business: "business.update",
      users: "user.manage",
      branches: "branch.manage",
      settings: "settings.update",
    }[section],
  );
  async function send(path: string, body: object, method = "PATCH") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const {
        data: { session },
      } = await browserClient().auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const response = await fetch(`${publicEnv().api}/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Business-Id": context.business.id,
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setError(
          payload.code === "LAST_OWNER"
            ? "Doanh nghiệp phải có ít nhất một Owner hoạt động."
            : payload.code === "ROLE_CHANGE_DENIED"
              ? "Chỉ Owner được thay đổi quyền Admin hoặc Owner."
              : payload.code === "USER_NOT_FOUND"
                ? "Không tìm thấy tài khoản Auth. Hãy tạo tài khoản trước và nhập đúng User ID."
                : payload.code === "MEMBERSHIP_EXISTS"
                  ? "Người dùng đã có membership. Hãy cập nhật membership hiện tại."
                  : response.status === 403
                    ? "Bạn không có quyền thực hiện thao tác này."
                    : `Không thể lưu (${payload.code ?? response.status}). Mã yêu cầu: ${payload.requestId ?? "—"}`,
        );
        return;
      }
      setEditing(null);
      setMessage("Đã lưu thay đổi.");
      router.refresh();
    } catch {
      setError("Không thể kết nối API. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  const notice = (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
    </>
  );
  if (section === "business") {
    const b = initial as Business;
    return (
      <section className="card">
        <h2>Thông tin doanh nghiệp</h2>
        {notice}
        <form
          key={b.updatedAt}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send("/businesses/current", {
              name: f.get("name"),
              timezone: f.get("timezone"),
              currency: f.get("currency"),
            });
          }}
        >
          <div className="form-grid">
            <label>
              Tên doanh nghiệp
              <input
                name="name"
                defaultValue={b.name}
                maxLength={120}
                required
                disabled={!editable}
              />
            </label>
            <label>
              Múi giờ
              <input
                name="timezone"
                defaultValue={b.timezone}
                required
                disabled={!editable}
              />
            </label>
            <label>
              Tiền tệ
              <input
                name="currency"
                defaultValue={b.currency}
                pattern="[A-Z]{3}"
                maxLength={3}
                required
                disabled={!editable}
              />
            </label>
          </div>
          {editable && <button disabled={busy}>Lưu thông tin</button>}
        </form>
        <p className="hint">
          ID doanh nghiệp: <code>{b.id}</code>
        </p>
      </section>
    );
  }
  if (section === "settings") {
    const s = initial as Settings;
    return (
      <section className="card">
        <h2>Cài đặt chung</h2>
        {notice}
        <form
          key={s.updatedAt}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send("/settings", {
              config: {
                locale: f.get("locale"),
                dateFormat: f.get("dateFormat"),
              },
            });
          }}
        >
          <label>
            Ngôn ngữ ưu tiên
            <select
              name="locale"
              defaultValue={s.config.locale ?? "vi"}
              disabled={!editable}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Định dạng ngày
            <select
              name="dateFormat"
              defaultValue={s.config.dateFormat ?? "DMY"}
              disabled={!editable}
            >
              <option value="DMY">Ngày / Tháng / Năm</option>
              <option value="ISO">Năm - Tháng - Ngày</option>
            </select>
          </label>
          <p className="hint">
            Lưu tùy chọn cho doanh nghiệp; giao diện hiện tại sử dụng tiếng
            Việt.
          </p>
          {editable && <button disabled={busy}>Lưu cài đặt</button>}
        </form>
      </section>
    );
  }
  const list = initial as Page<Branch | Membership>;
  return (
    <>
      {notice}
      <section className="card">
        <div className="inline">
          <h2>
            {section === "branches"
              ? "Danh sách chi nhánh"
              : "Danh sách thành viên"}
          </h2>
          <span className="badge">{list.total}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  {section === "branches" ? "TÊN CHI NHÁNH" : "THÀNH VIÊN"}
                </th>
                <th>{section === "branches" ? "ĐỊA CHỈ" : "VAI TRÒ"}</th>
                <th>TRẠNG THÁI</th>
                {editable && <th>THAO TÁC</th>}
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    {"name" in row ? row.name : row.displayName}
                    <br />
                    {"userId" in row && (
                      <code className="quiet">{row.userId}</code>
                    )}
                  </td>
                  <td>{"address" in row ? row.address : row.roleKey}</td>
                  <td>
                    {row.status === "ACTIVE" ? "Hoạt động" : "Đã vô hiệu hóa"}
                  </td>
                  {editable && (
                    <td>
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditing(row);
                          setMessage("");
                          setError("");
                        }}
                      >
                        Chỉnh sửa
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!list.data.length && <p className="muted">Chưa có dữ liệu.</p>}
        </div>
        <div className="pagination">
          <button
            className="secondary"
            disabled={list.page <= 1}
            onClick={() => router.push(`/app/${section}?page=${list.page - 1}`)}
          >
            ← Trước
          </button>
          <span>Trang {list.page}</span>
          <button
            className="secondary"
            disabled={list.page * list.limit >= list.total}
            onClick={() => router.push(`/app/${section}?page=${list.page + 1}`)}
          >
            Sau →
          </button>
        </div>
      </section>
      {editable && (
        <section className="card">
          <h2>
            {editing
              ? "Chỉnh sửa"
              : section === "branches"
                ? "Thêm chi nhánh"
                : "Thêm thành viên"}
          </h2>
          {section === "users" && !editing && (
            <p className="muted">
              Nhập User ID của tài khoản đã được tạo trong Supabase Auth. Thao
              tác này không gửi thư mời.
            </p>
          )}
          <form
            key={editing?.id ?? "new"}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body =
                section === "branches"
                  ? {
                      name: f.get("name"),
                      address: f.get("address"),
                      ...(editing ? { status: f.get("status") } : {}),
                    }
                  : {
                      ...(editing
                        ? { status: f.get("status") }
                        : { userId: f.get("userId") }),
                      roleKey: f.get("roleKey"),
                    };
              void send(
                `/${section === "users" ? "memberships" : "branches"}${editing ? "/" + editing.id : ""}`,
                body,
                editing ? "PATCH" : "POST",
              );
            }}
          >
            <div className="form-grid">
              {section === "branches" ? (
                <>
                  <label>
                    Tên chi nhánh
                    <input
                      name="name"
                      defaultValue={
                        editing && "name" in editing ? editing.name : ""
                      }
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Địa chỉ
                    <input
                      name="address"
                      defaultValue={
                        editing && "address" in editing ? editing.address : ""
                      }
                      maxLength={500}
                    />
                  </label>
                </>
              ) : (
                <>
                  {!editing && (
                    <label>
                      User ID
                      <input
                        name="userId"
                        required
                        placeholder="UUID từ Supabase Auth"
                      />
                    </label>
                  )}
                  <label>
                    Vai trò
                    <select
                      name="roleKey"
                      defaultValue={
                        editing && "roleKey" in editing
                          ? editing.roleKey
                          : "OPERATIONS"
                      }
                    >
                      {(context.role === "OWNER"
                        ? ["OWNER", "ADMIN", "OPERATIONS"]
                        : ["OPERATIONS"]
                      ).map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {editing && (
                <label>
                  Trạng thái
                  <select name="status" defaultValue={editing.status}>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="DISABLED">Vô hiệu hóa</option>
                  </select>
                </label>
              )}
            </div>
            <div className="inline">
              <button disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
              {editing && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                >
                  Hủy
                </button>
              )}
            </div>
          </form>
        </section>
      )}
    </>
  );
}
