"use client";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
export default function Login() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await browserClient().auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error) {
        setError(
          "Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được kích hoạt.",
        );
        return;
      }
      document.cookie = "current-business=; Path=/; Max-Age=0; SameSite=Lax";
      // A concurrent refresh can cancel this transition in Next 16.
      router.replace("/app");
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <div className="login-brand">
          <span className="brand-mark">
            <Icon name="car" size={23} />
          </span>
          <strong>
            Rental Fleet<span>Operating System</span>
          </strong>
        </div>
        <div className="login-story-copy">
          <span className="eyebrow">KHÔNG GIAN VẬN HÀNH</span>
          <h1>
            Cùng quản lý.
            <br />
            Cùng chuyển động.
          </h1>
          <p>
            Đội xe, hợp đồng và đội ngũ của bạn trong một không gian làm việc.
          </p>
          <div className="login-capabilities">
            <span>
              <Icon name="car" />
              Đội xe & thiết bị
            </span>
            <span>
              <Icon name="rental" />
              Lịch thuê & bàn giao
            </span>
            <span>
              <Icon name="users" />
              Phân quyền theo doanh nghiệp
            </span>
          </div>
        </div>
        <small>Rental Fleet OS · Dành cho đội ngũ vận hành</small>
      </section>
      <section className="login-form" aria-labelledby="login-title">
        <div className="login-card">
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2 id="login-title">Đăng nhập</h2>
          <p className="muted">
            Tiếp tục công việc trong doanh nghiệp của bạn.
          </p>
          <form method="post" onSubmit={submit} aria-busy={pending}>
            <label htmlFor="login-email">
              Email
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="ban@doanhnghiep.vn"
                autoComplete="username"
                required
                disabled={pending}
              />
            </label>
            <label htmlFor="login-password">
              Mật khẩu
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="Nhập mật khẩu của bạn"
                autoComplete="current-password"
                required
                disabled={pending}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button disabled={pending} type="submit">
              {pending ? "Đang đăng nhập…" : "Đăng nhập"}
              {!pending && <Icon name="arrow" size={16} />}
            </Button>
          </form>
          <p className="login-help">
            Chưa có tài khoản? Liên hệ quản trị viên doanh nghiệp để được cấp
            quyền truy cập.
          </p>
        </div>
      </section>
    </main>
  );
}
