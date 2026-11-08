"use client";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { Button, Input } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client";
export function LoginForm({
  destination,
  initialError = "",
}: {
  destination: string | null;
  initialError?: string;
}) {
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { data, error } = await browserClient().auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error || !data.session) {
        setError(
          "Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được kích hoạt.",
        );
        return;
      }
      document.cookie = "current-business=; Path=/; Max-Age=0; SameSite=Lax";
      const query = destination
        ? `?${new URLSearchParams({ next: destination })}`
        : "";
      // Verify grants on the server after the browser has persisted Auth cookies.
      window.location.replace(`/auth/continue${query}`);
    } catch {
      setError("Không thể xác minh quyền truy cập. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <div className="login-brand">
          <BrandLockup tagline />
        </div>
        <div className="login-story-copy">
          <span className="eyebrow">CARBASE</span>
          <h1>All Your Fleet Operations. One Platform.</h1>
          <p>
            Manage vehicles, rentals, customers, and GPS tracking from one
            connected workspace.
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
              Quản lý doanh nghiệp
            </span>
          </div>
        </div>
        <small>One connected workspace for smarter fleet operations.</small>
      </section>
      <section className="login-form" aria-labelledby="login-title">
        <div className="login-card">
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2 id="login-title">Đăng nhập</h2>
          <p className="muted">Đăng nhập để tiếp tục công việc của bạn.</p>
          <form method="post" onSubmit={submit} aria-busy={pending}>
            <label htmlFor="login-email">
              Email
              <Input
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
              <Input
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
            <Button loading={pending} type="submit">
              {!pending && <Icon name="arrow" size={16} />}
              {pending ? "Đang đăng nhập…" : "Đăng nhập"}
            </Button>
          </form>
          <p className="login-help">
            <Link href="/forgot-password">Quên mật khẩu?</Link>
          </p>
          <p className="login-help">
            Chưa có tài khoản? Liên hệ quản trị viên để được cấp quyền truy cập.
          </p>
        </div>
      </section>
    </main>
  );
}
